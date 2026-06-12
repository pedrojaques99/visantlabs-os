/**
 * seedReferences — populate the geo-tagged reference library from curated,
 * jury-selected award archives (the curation already exists; we just harvest it).
 *
 * COLLECTION is decoupled from INGESTION: a source scrapes a manifest of
 * `SeedItem`s (via Firecrawl), the ingest core writes them deterministically.
 * You can also skip scraping entirely and feed a pre-built JSON manifest.
 *
 * Usage:
 *   npx tsx server/scripts/seedReferences.ts --list
 *   npx tsx server/scripts/seedReferences.ts --source one-club --country Japan --limit 20 --dry-run
 *   npx tsx server/scripts/seedReferences.ts --source pentawards --limit 30
 *   npx tsx server/scripts/seedReferences.ts --from-json ./refs.json
 *   npx tsx server/scripts/seedReferences.ts --source all --limit 15
 *
 * Flags:
 *   --source <id|all>   which adapter to run (see --list)
 *   --country <name>    scope to a country (e.g. "Japan", "Russia", "Switzerland")
 *   --limit <n>         max items per source (default 20)
 *   --from-json <file>  ingest a manifest (SeedItem[] or {items:[...]}) — no scraping
 *   --dry-run           plan only; no scraping side effects, no DB/R2 writes
 *   --private           seed as non-public (default: public, browsable)
 *   --user <id>         ingestor userId (default env SEED_USER_ID or 'system-reference-seed')
 *   --list              list available sources and exit
 */

import dotenv from 'dotenv';
import path from 'path';
import { promises as fs } from 'fs';
import { Firecrawl } from './seed-references/firecrawl.js';
import { ingestSeedItems } from './seed-references/ingest.js';
import { SOURCES } from './seed-references/sources/index.js';
import type { SeedItem, Logger } from './seed-references/types.js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const log: Logger = {
  info: (m) => console.log(`  ${m}`),
  warn: (m) => console.warn(`  \x1b[33m${m}\x1b[0m`),
  ok: (m) => console.log(`  \x1b[32m${m}\x1b[0m`),
};

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function loadManifest(file: string): Promise<SeedItem[]> {
  const raw = await fs.readFile(path.resolve(file), 'utf-8');
  const parsed = JSON.parse(raw);
  const items: SeedItem[] = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error('manifest must be SeedItem[] or { items: SeedItem[] }');
  return items.filter((it) => it && it.imageUrl && it.sourceUrl);
}

async function main() {
  if (has('list')) {
    console.log('\n📚 Available sources:\n');
    for (const s of SOURCES) {
      console.log(`  • ${s.id.padEnd(20)} ${s.label}${s.hasNativeGeo ? '  [geo-native]' : ''}`);
    }
    console.log('');
    return;
  }

  const dryRun = has('dry-run');
  const isPublic = !has('private');
  const limit = Math.max(1, parseInt(flag('limit') || '20', 10));
  const country = flag('country');
  const userId = flag('user') || process.env.SEED_USER_ID || 'system-reference-seed';

  console.log(`\n🌱 Seeding references → ${dryRun ? 'DRY-RUN' : 'LIVE'} · ${isPublic ? 'public' : 'private'}\n`);

  // ── Path A: ingest a pre-built manifest (no scraping) ──────────────────────
  const fromJson = flag('from-json');
  if (fromJson) {
    const items = await loadManifest(fromJson);
    log.info(`manifest: ${items.length} item(s) from ${fromJson}`);
    const report = await ingestSeedItems(items, { dryRun, isPublic, userId, log });
    printReport('manifest', report);
    return;
  }

  // ── Path B: scrape award galleries via Firecrawl ───────────────────────────
  const sourceId = flag('source');
  if (!sourceId) {
    console.error('  ✗ Specify --source <id|all> or --from-json <file>. Use --list to see sources.');
    process.exitCode = 1;
    return;
  }

  let targets = sourceId === 'all' ? SOURCES : SOURCES.filter((s) => s.id === sourceId);
  if (targets.length === 0) {
    console.error(`  ✗ Unknown source "${sourceId}". Use --list.`);
    process.exitCode = 1;
    return;
  }

  // Firecrawl pre-flight only when a selected source actually needs it.
  const firecrawl = new Firecrawl();
  if (!dryRun && targets.some((s) => s.needsFirecrawl)) {
    const status = await firecrawl.status();
    if (!status.authenticated) {
      log.warn('Firecrawl not authenticated — skipping Firecrawl-based sources.');
      targets = targets.filter((s) => !s.needsFirecrawl);
    } else if (status.creditsRemaining <= 0) {
      log.warn(
        `Firecrawl has no credits — skipping ${targets
          .filter((s) => s.needsFirecrawl)
          .map((s) => s.id)
          .join(', ')}. Free sources continue.`
      );
      targets = targets.filter((s) => !s.needsFirecrawl);
    } else {
      log.info(`firecrawl: ${status.creditsRemaining.toLocaleString()} credits`);
    }
  }

  if (targets.length === 0) {
    console.error('  ✗ No runnable sources (Firecrawl unavailable). Try --source arena or --from-json.');
    process.exitCode = 1;
    return;
  }

  for (const source of targets) {
    console.log(`\n── ${source!.label} ─────────────────────────────`);
    try {
      const items = await source!.collect({ limit, country, firecrawl, log });
      log.info(`collected ${items.length} candidate(s)`);
      const report = await ingestSeedItems(items, { dryRun, isPublic, userId, log });
      printReport(source!.id, report);
    } catch (err: any) {
      log.warn(`source failed: ${err.message}`);
    }
  }
}

function printReport(label: string, r: { ingested: number; skipped: number; failed: number; total: number }) {
  console.log(
    `\n  ▸ ${label}: ${r.ingested} ingested · ${r.skipped} skipped · ${r.failed} failed (of ${r.total})`
  );
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error('\n💥 Fatal:', err);
    process.exit(1);
  });
