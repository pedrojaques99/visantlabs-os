/**
 * brandRankingTerms — distill an active brand into a small set of descriptive
 * tokens used to RANK (not filter) the reference feed. The strongest signal is
 * the visual-tag vocabulary (vibe/aesthetic/theme/mood/medium) that brand asset
 * analysis shares with reference dimensions, so intersecting them is meaningful.
 *
 * Pure + defensive: brands are partially filled, so every field is optional.
 * Returns a comma-joined, lowercased, de-duped, capped list (empty string = no
 * usable signal → the server falls back to the neutral seed+recency feed).
 */
import type { BrandGuideline } from '@/lib/figma-types';

const MAX_TERMS = 24;

/** Normalize a raw token: lowercase, trim, collapse whitespace. Drop junk. */
function norm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (t.length < 2 || t.length > 40) return null;
  return t;
}

export function brandRankingTerms(brand?: BrandGuideline | null): string {
  if (!brand) return '';
  const out = new Set<string>();
  const add = (v: unknown) => {
    const t = norm(v);
    if (t) out.add(t);
  };

  // 1. Aggregated brand visual tags (Record<string, string[]>).
  for (const vals of Object.values(brand.tags || {})) {
    if (Array.isArray(vals)) vals.forEach(add);
  }

  // 2. Per-asset analysis dimensions — same vocab as reference dimensions.
  const assets = [...(brand.logos || []), ...(brand.media || [])];
  for (const a of assets) {
    const d = a?.analysis?.dimensions;
    if (!d) continue;
    [d.vibe, d.aesthetic, d.theme, d.mood, d.medium].forEach((arr) => {
      if (Array.isArray(arr)) arr.forEach(add);
    });
  }

  // 3. Strategic archetype names (single, brandy signal).
  for (const arc of brand.strategy?.archetypes || []) {
    add((arc as { name?: string })?.name);
  }

  return [...out].slice(0, MAX_TERMS).join(',');
}
