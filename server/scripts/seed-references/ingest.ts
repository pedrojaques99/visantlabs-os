/**
 * Seed ingest core — deterministic, idempotent, dry-run-able.
 *
 * Takes source-agnostic `SeedItem`s and turns them into curated references:
 *   1. normalize provenance (country/region) via the taxonomy SSoT
 *   2. dedup against prior runs (reference_seed_log) and the live library
 *   3. download the source image and re-host a compressed copy on R2
 *      (we never hotlink — the library owns its bytes; sourceUrl keeps attribution)
 *   4. run the existing ingestReference() pipeline (AI tags + multimodal vector)
 *
 * This module has ZERO dependency on how items were collected — scraping,
 * a JSON manifest, or a future API all feed the same path.
 */

import { connectToMongoDB, getDb } from '../../db/mongodb.js';
import { normalizeCountry, regionForCountry } from '../../../src/lib/references/taxonomy.js';
import type { SeedItem, Logger } from './types.js';

const SEED_LOG = 'reference_seed_log';

export interface IngestOptions {
  /** Don't write anything — just log the plan. */
  dryRun: boolean;
  /** Make the seeded references publicly browsable (default true for curated seeds). */
  isPublic: boolean;
  /** userId stamped as the ingestor (a system/curator account). */
  userId: string;
  log: Logger;
}

export interface IngestReport {
  total: number;
  ingested: number;
  skipped: number;
  failed: number;
  errors: Array<{ sourceUrl: string; error: string }>;
}

/** Stable dedup key — the source page is the natural identity of a reference. */
function dedupKey(item: SeedItem): string {
  return (item.sourceUrl || item.imageUrl).trim().toLowerCase();
}

async function fetchAsBase64(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'VisantLabs-ReferenceSeeder/1.0 (+https://visantlabs.com)' },
  });
  if (!resp.ok) throw new Error(`fetch ${resp.status} for ${url}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.length < 1024) throw new Error(`image too small (${buffer.length}B), likely not real`);
  return buffer.toString('base64');
}

export async function ingestSeedItems(
  items: SeedItem[],
  opts: IngestOptions
): Promise<IngestReport> {
  const { dryRun, isPublic, userId, log } = opts;
  const report: IngestReport = { total: items.length, ingested: 0, skipped: 0, failed: 0, errors: [] };

  await connectToMongoDB();
  const db = getDb();
  const presets = db.collection('community_presets');
  const seedLog = db.collection(SEED_LOG);

  // Lazy-load side-effecting deps so --dry-run stays pure
  let ingestReference: typeof import('../../lib/mockup/referenceIngestor.js').ingestReference;
  let uploadMockupPresetReference: typeof import('../../../src/services/r2Service.js').uploadMockupPresetReference;
  if (!dryRun) {
    const r2 = await import('../../../src/services/r2Service.js');
    if (!r2.isR2Configured()) throw new Error('R2 storage is not configured (check .env.local)');
    uploadMockupPresetReference = r2.uploadMockupPresetReference;
    ingestReference = (await import('../../lib/mockup/referenceIngestor.js')).ingestReference;
  }

  const seenInBatch = new Set<string>();

  for (const item of items) {
    const key = dedupKey(item);

    // 1) in-batch dedup
    if (seenInBatch.has(key)) {
      report.skipped++;
      continue;
    }
    seenInBatch.add(key);

    // 2) cross-run + live-library dedup
    const [alreadySeeded, alreadyLive] = await Promise.all([
      seedLog.findOne({ key }),
      presets.findOne({
        category: 'reference',
        $or: [{ sourceUrl: item.sourceUrl }, { 'provenance.sourceUrl': item.sourceUrl }],
      }),
    ]);
    if (alreadySeeded || alreadyLive) {
      log.info(`↺ skip (já existe): ${item.title || item.sourceUrl}`);
      report.skipped++;
      continue;
    }

    const country = normalizeCountry(item.country);
    const region = item.region || regionForCountry(country);
    const label = `${item.title || 'untitled'} · ${country || '—'} · ${item.awardSource}`;

    if (dryRun) {
      log.info(`◌ [dry] ${label}`);
      report.ingested++;
      continue;
    }

    try {
      const base64 = await fetchAsBase64(item.imageUrl);
      const presetId = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const r2Url = await uploadMockupPresetReference!(base64, presetId);

      const result = await ingestReference!({
        imageBase64: base64,
        imageUrl: r2Url,
        name: item.title,
        studio: item.studio,
        userId,
        tags: item.tags,
        country,
        region,
        designer: item.designer,
        sourceUrl: item.sourceUrl,
        awardSource: item.awardSource,
        year: item.year,
        isAdminCurated: true, // jury-curated, world-class → trusted, public-eligible
        isPublic,
      });

      await seedLog.insertOne({
        key,
        referenceId: result.id,
        sourceUrl: item.sourceUrl,
        awardSource: item.awardSource,
        country: result.provenance.country,
        seededAt: new Date(),
      });

      log.ok(`✓ ${label}`);
      report.ingested++;

      // Be a good citizen — gentle pacing between source hits
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      log.warn(`✗ ${label} — ${err.message}`);
      report.failed++;
      report.errors.push({ sourceUrl: item.sourceUrl, error: err.message });
    }
  }

  return report;
}
