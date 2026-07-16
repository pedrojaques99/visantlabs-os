/**
 * Reference feed ranking — a lightweight, deterministic content-based ranker.
 *
 * Replaces the frozen `sort({ createdAt: -1 })` with a blended score so the
 * library feels alive and personal without any ML infra:
 *   - session seed  → fresh order per visit, stable within a session (paging OK)
 *   - recency       → newly curated refs keep surfacing
 *   - brand affinity→ refs matching the ACTIVE brand's descriptor tokens
 *   - taste affinity→ refs matching what the USER has saved
 *   - novelty       → down-rank what the user already saved
 *
 * Deterministic given (seed, tasteValues, brandTerms, savedIds, now): the same
 * inputs always produce the same order, which is what keeps offset pagination
 * consistent across infinite-scroll pages within a session.
 */

export interface RankableRef {
  id: string;
  createdAt?: string | Date;
  dimensions?: Record<string, string[]>;
  tags?: string[];
}

export interface RankContext {
  seed: string;
  /** Values the user tends to save (from their collections' dimensions). */
  tasteValues?: Set<string>;
  /** Descriptive tokens of the active brand (already normalized, lowercased). */
  brandTerms?: Set<string>;
  /** Reference ids the user already saved — down-ranked as "seen". */
  savedIds?: Set<string>;
  /** Reference timestamp for recency decay (ms). Pass in — never call Date.now in tests. */
  now: number;
  /** Recency half-life in days (older than this scores ~0.5). */
  halfLifeDays?: number;
}

const WEIGHTS = { brand: 0.35, taste: 0.25, recency: 0.2, jitter: 0.15, novelty: 0.05 };

/** FNV-1a hash → a stable float in [0, 1). Cheap, well-distributed, seedable. */
export function hashToUnit(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 → unsigned; divide by 2^32 for [0, 1)
  return (h >>> 0) / 4294967296;
}

/** Exponential recency decay → 1 (now) … 0.5 (one half-life ago) … →0 (old). */
export function recencyScore(createdAt: string | Date | undefined, now: number, halfLifeDays = 30) {
  if (!createdAt) return 0;
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (now - t) / 86_400_000);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/** Lowercased set of a ref's matchable tokens (dimension values + tags). */
function refTokens(ref: RankableRef): Set<string> {
  const out = new Set<string>();
  for (const vals of Object.values(ref.dimensions || {})) {
    if (Array.isArray(vals)) for (const v of vals) out.add(String(v).toLowerCase());
  }
  for (const t of ref.tags || []) out.add(String(t).toLowerCase());
  return out;
}

function intersectCount(a: Set<string>, b?: Set<string>): number {
  if (!b || b.size === 0) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

/** Compute the blended score for one reference (higher = ranked earlier). */
export function scoreReference(ref: RankableRef, ctx: RankContext): number {
  const tokens = refTokens(ref);
  const hasBrand = !!ctx.brandTerms && ctx.brandTerms.size > 0;
  const hasTaste = !!ctx.tasteValues && ctx.tasteValues.size > 0;

  // Match counts saturate quickly so a few strong matches ≈ full affinity.
  const brandAffinity = hasBrand ? Math.min(1, intersectCount(tokens, ctx.brandTerms) / 3) : 0;
  const tasteAffinity = hasTaste ? Math.min(1, intersectCount(tokens, ctx.tasteValues) / 2) : 0;
  const recency = recencyScore(ref.createdAt, ctx.now, ctx.halfLifeDays);
  const jitter = hashToUnit(`${ctx.seed}:${ref.id}`);
  const novelty = ctx.savedIds?.has(ref.id) ? 0 : 1;

  return (
    WEIGHTS.brand * brandAffinity +
    WEIGHTS.taste * tasteAffinity +
    WEIGHTS.recency * recency +
    WEIGHTS.jitter * jitter +
    WEIGHTS.novelty * novelty
  );
}

/**
 * Rank references by descending blended score. Stable: ties break by id so the
 * order is fully deterministic (no reliance on input order or sort stability).
 */
export function rankReferences<T extends RankableRef>(refs: T[], ctx: RankContext): T[] {
  return refs
    .map((ref) => ({ ref, score: scoreReference(ref, ctx) }))
    .sort((a, b) => b.score - a.score || (a.ref.id < b.ref.id ? -1 : 1))
    .map((x) => x.ref);
}
