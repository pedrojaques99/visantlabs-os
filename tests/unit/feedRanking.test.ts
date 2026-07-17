import { describe, it, expect } from 'vitest';
import {
  hashToUnit,
  recencyScore,
  scoreReference,
  rankReferences,
  type RankableRef,
  type RankContext,
} from '../../server/lib/references/feedRanking';

const NOW = Date.parse('2026-07-16T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function ref(id: string, extra: Partial<RankableRef> = {}): RankableRef {
  return { id, createdAt: daysAgo(1), dimensions: {}, tags: [], ...extra };
}

describe('hashToUnit', () => {
  it('is deterministic and within [0, 1)', () => {
    const a = hashToUnit('seed:ref_1');
    expect(a).toBe(hashToUnit('seed:ref_1'));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it('spreads different keys apart', () => {
    expect(hashToUnit('seed:a')).not.toBe(hashToUnit('seed:b'));
  });
});

describe('recencyScore', () => {
  it('is ~1 for now, ~0.5 at one half-life, 0 for missing dates', () => {
    expect(recencyScore(daysAgo(0), NOW, 30)).toBeCloseTo(1, 5);
    expect(recencyScore(daysAgo(30), NOW, 30)).toBeCloseTo(0.5, 5);
    expect(recencyScore(undefined, NOW)).toBe(0);
    expect(recencyScore('not-a-date', NOW)).toBe(0);
  });
});

describe('scoreReference', () => {
  const base: RankContext = { seed: 's', now: NOW };

  it('boosts references that match the active brand terms', () => {
    const brandTerms = new Set(['minimalist', 'premium']);
    const match = ref('a', { dimensions: { aesthetic: ['minimalist'], vibe: ['premium'] } });
    const miss = ref('a', { dimensions: { aesthetic: ['maximalist'] } }); // same id/date isolates brand
    expect(scoreReference(match, { ...base, brandTerms })).toBeGreaterThan(
      scoreReference(miss, { ...base, brandTerms })
    );
  });

  it('down-ranks already-saved references (novelty)', () => {
    const r = ref('saved-1', { tags: ['x'] });
    const seen = scoreReference(r, { ...base, savedIds: new Set(['saved-1']) });
    const fresh = scoreReference(r, { ...base, savedIds: new Set(['other']) });
    expect(fresh).toBeGreaterThan(seen);
  });

  it('ignores brand/taste weight entirely when no signal is provided', () => {
    // With no brand/taste, score = 0.2*recency + 0.15*jitter + 0.05*novelty ≤ 0.4.
    const r = ref('a', { createdAt: daysAgo(0) });
    expect(scoreReference(r, base)).toBeLessThanOrEqual(0.4 + 1e-9);
  });
});

describe('rankReferences', () => {
  const refs = [
    ref('r1', { dimensions: { vibe: ['premium'] } }),
    ref('r2', { dimensions: { vibe: ['playful'] } }),
    ref('r3', { dimensions: { vibe: ['premium'] } }),
    ref('r4', { tags: ['editorial'] }),
  ];

  it('is deterministic for identical inputs (paging stays consistent)', () => {
    const ctx: RankContext = { seed: 'sess-abc', now: NOW };
    const a = rankReferences(refs, ctx).map((r) => r.id);
    const b = rankReferences(refs, ctx).map((r) => r.id);
    expect(a).toEqual(b);
  });

  it('reshuffles when the seed changes', () => {
    const a = rankReferences(refs, { seed: 'seed-1', now: NOW }).map((r) => r.id);
    const b = rankReferences(refs, { seed: 'seed-2', now: NOW }).map((r) => r.id);
    // Not a guarantee for every pair, but these two seeds differ in practice.
    expect(a).not.toEqual(b);
  });

  it('floats brand-matching references toward the top', () => {
    const brandTerms = new Set(['premium']);
    const ordered = rankReferences(refs, { seed: 'x', now: NOW, brandTerms }).map((r) => r.id);
    // r1 and r3 both match 'premium' → both should outrank the non-matchers.
    expect(ordered.slice(0, 2).sort()).toEqual(['r1', 'r3']);
  });

  it('breaks ties by id for a fully stable order', () => {
    // No brand/taste, identical dates → jitter dominates but is id-seeded, so
    // the order is still deterministic and reproducible.
    const ctx: RankContext = { seed: 'tie', now: NOW };
    expect(rankReferences(refs, ctx)).toEqual(rankReferences([...refs].reverse(), ctx));
  });
});
