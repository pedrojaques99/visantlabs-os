import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashToUnit } from '../../server/lib/references/feedRanking.js';

/**
 * The ranked feed must stay bounded (it ranks in memory) WITHOUT hiding old
 * content behind the "newest N" cliff. These tests shrink the candidate cap so
 * a handful of docs exercises the stratified selection that real scale needs.
 */

async function db() {
  const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');
  await connectToMongoDB();
  return getDb();
}

async function seed(overrides: Record<string, any>) {
  const d = await db();
  const doc = {
    category: 'reference',
    isAdminCurated: true,
    isApproved: true,
    isPublic: true,
    enriched: true,
    referenceImageUrl: 'https://cdn.example.com/x.png',
    dimensions: {},
    tags: [],
    createdAt: new Date(),
    ...overrides,
    // Deterministic shuffle key, matching the ingestor.
    shuffleKey: overrides.shuffleKey ?? hashToUnit(overrides.id),
  };
  await d.collection('community_presets').insertOne(doc);
  return doc;
}

describe('ranked feed — bounded but not truncated', () => {
  beforeEach(() => {
    process.env.REFERENCES_CANDIDATE_CAP = '4';
  });
  afterEach(() => {
    delete process.env.REFERENCES_CANDIDATE_CAP;
  });

  it('surfaces an OLD reference when its shuffle slot falls in the session window', async () => {
    const { searchReferences } = await import('../../server/lib/references/engine.js');
    const d = await db();

    // Many fresh refs — more than the cap — so a pure "newest N" pool would bury
    // anything older.
    for (let i = 0; i < 12; i++) {
      await seed({ id: `fresh-${i}`, createdAt: new Date(2024, 0, 1 + i) });
    }
    // One deliberately OLD ref, with a shuffleKey pinned low so a seed whose
    // window starts at 0 is guaranteed to include it.
    await seed({ id: 'old-gem', createdAt: new Date(2000, 0, 1), shuffleKey: 0.0001 });

    // hashToUnit('') = window start; find a seed whose start is ~0 so the window
    // begins at the low keys where old-gem lives. Empty seed hashes to a fixed
    // value; use a seed we can reason about: the window is [start, ...], and
    // wrap-around covers the rest, so old-gem (key 0.0001) is reachable for any
    // seed via the wrap. Assert it's in the pool regardless of start.
    const { loadRankingCandidates, buildReferenceFilter, PUBLIC_PROJECTION } = await import(
      '../../server/lib/references/engine.js'
    );
    const pool = await loadRankingCandidates(
      d.collection('community_presets'),
      buildReferenceFilter({ visibility: 'public' }),
      PUBLIC_PROJECTION as Record<string, 0 | 1>,
      'any-session-seed'
    );
    const ids = pool.map((r: any) => r.id);
    // The pool is bounded…
    expect(pool.length).toBeLessThanOrEqual(4);
    // …yet the old, low-key reference is reachable through the shuffle window,
    // which pure newest-N could never do.
    expect(ids).toContain('old-gem');

    void searchReferences; // (exercised indirectly; imported to assert it still binds)
  });

  it('keeps the pool stable within a session (same seed → same candidates)', async () => {
    const d = await db();
    for (let i = 0; i < 10; i++) await seed({ id: `r-${i}`, createdAt: new Date(2024, 0, i + 1) });

    const { loadRankingCandidates, buildReferenceFilter, PUBLIC_PROJECTION } = await import(
      '../../server/lib/references/engine.js'
    );
    const filter = buildReferenceFilter({ visibility: 'public' });
    const proj = PUBLIC_PROJECTION as Record<string, 0 | 1>;
    const a = await loadRankingCandidates(d.collection('community_presets'), filter, proj, 'seed-x');
    const b = await loadRankingCandidates(d.collection('community_presets'), filter, proj, 'seed-x');
    expect(a.map((r: any) => r.id).sort()).toEqual(b.map((r: any) => r.id).sort());
  });
});
