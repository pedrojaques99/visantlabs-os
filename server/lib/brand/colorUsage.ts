/**
 * Color usage analysis — answers "how much is each brand color actually used
 * across the brand's own assets (media + logos)?".
 *
 * Pipeline: for every asset image we downsample with sharp, walk the pixels, and
 * assign each opaque pixel to its nearest brand color *within a tolerance* (so
 * photographic / background pixels far from any brand color don't count). The
 * accumulated counts are normalised to a 0..1 proportion and ranked.
 *
 * The resulting `usage`/`usageRank` are written back onto each color object so
 * the public/admin palette can size swatches by real-world prominence. sharp is
 * dynamically imported (same pattern as imageFlatten.ts) to stay off the hot
 * import path.
 */
import { safeFetch } from '../../utils/securityValidation.js';

export interface UsageColor {
  hex: string;
  [k: string]: unknown;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    // tolerate 3-digit shorthand
    const s = /^#?([0-9a-f]{3})$/i.exec(hex.trim());
    if (!s) return null;
    const [r, g, b] = s[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** Perceptual-ish weighted RGB distance ("redmean") — good enough, zero deps. */
export function colorDistance(a: RGB, b: RGB): number {
  const rmean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(
    (((512 + rmean) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rmean) * db * db) >> 8)
  );
}

// Pixels farther than this from every brand color are treated as "not brand".
// redmean distance ranges ~0..765; ~120 keeps near-matches, drops unrelated tones.
const MATCH_TOLERANCE = 120;
const SAMPLE_EDGE = 56; // downsample longest edge to this many px

/** A weighted analysis source — designed pieces count more than stock media. */
export interface AssetSource {
  url: string;
  weight: number;
}

/**
 * Return the per-color matched-pixel counts for a SINGLE image. The caller
 * normalizes these into a distribution so one large image can't outvote a small
 * logo by raw pixel volume.
 */
async function colorCountsFromImage(buffer: Buffer, brand: RGB[]): Promise<number[]> {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(buffer)
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Array(brand.length).fill(0);
  const channels = info.channels; // 4 (RGBA) after ensureAlpha
  for (let i = 0; i < data.length; i += channels) {
    const alpha = data[i + 3];
    if (alpha < 128) continue; // skip transparent (logo padding etc.)
    const px: RGB = { r: data[i], g: data[i + 1], b: data[i + 2] };

    let best = -1;
    let bestDist = Infinity;
    for (let c = 0; c < brand.length; c++) {
      const d = colorDistance(px, brand[c]);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best >= 0 && bestDist <= MATCH_TOLERANCE) counts[best] += 1;
  }
  return counts;
}

/**
 * Compute usage proportions and return a NEW colors array with `usage` (0..1)
 * and `usageRank` (1 = most used) merged onto each color.
 *
 * Each asset contributes its *internal* color distribution (normalized to 1),
 * scaled by an importance `weight`, so a single large stock photo can't dominate
 * a small logo. Colors that never matched keep `usage: 0`. Returns the input
 * unchanged if there are no valid colors or no assets to analyze.
 */
export async function computeColorUsage<T extends UsageColor>(
  colors: T[],
  assets: AssetSource[]
): Promise<T[]> {
  if (!Array.isArray(colors) || colors.length === 0) return colors;
  const brand = colors.map((c) => hexToRgb(c.hex));
  const valid = brand.every(Boolean);
  if (!valid || !Array.isArray(assets) || assets.length === 0) return colors;

  const weighted = new Array(colors.length).fill(0);

  // Bound the work: at most 40 assets, fetch in small concurrent batches.
  const sources = assets
    .filter((a) => a && typeof a.url === 'string' && /^https?:/i.test(a.url))
    .slice(0, 40);
  const BATCH = 6;
  for (let i = 0; i < sources.length; i += BATCH) {
    const batch = sources.slice(i, i + BATCH);
    const perAsset = await Promise.all(
      batch.map(async (src) => {
        try {
          const res = await safeFetch(src.url);
          if (!res.ok) return null;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length === 0) return null;
          const counts = await colorCountsFromImage(buf, brand as RGB[]);
          return { counts, weight: src.weight };
        } catch {
          return null; // unreachable / decode failure — skip this asset
        }
      })
    );
    for (const r of perAsset) {
      if (!r) continue;
      const sum = r.counts.reduce((a, b) => a + b, 0);
      if (sum === 0) continue; // no brand color present in this asset
      for (let c = 0; c < weighted.length; c++) {
        weighted[c] += (r.counts[c] / sum) * r.weight; // normalized distribution × weight
      }
    }
  }

  const total = weighted.reduce((a, b) => a + b, 0);
  if (total === 0) {
    // Nothing matched — clear any stale usage so the UI falls back to uniform.
    return colors.map((c) => ({ ...c, usage: 0, usageRank: undefined }));
  }

  const withUsage = colors.map((c, i) => ({ ...c, usage: weighted[i] / total }));
  // Rank by usage descending (1 = most used).
  const order = withUsage.map((c, i) => ({ i, usage: c.usage })).sort((a, b) => b.usage - a.usage);
  order.forEach((o, rank) => {
    (withUsage[o.i] as any).usageRank = rank + 1;
  });

  return withUsage;
}

// Importance weights: designed marks speak loudest about brand-color intent;
// stock/background imagery barely counts (it isn't "the brand using its colors").
const WEIGHT_LOGO = 1.0;
const WEIGHT_MEDIA_DEFAULT = 0.6;
const WEIGHT_MEDIA_BY_CATEGORY: Record<string, number> = {
  stock: 0.15,
  background: 0.4,
  texture: 0.4,
  product: 0.7,
  graphic: 0.8,
};

interface AssetWithAnalysis {
  url?: string;
  type?: string;
  category?: string;
  analysis?: { dimensions?: { medium?: string[] } } | null;
}

/**
 * Adjust an asset's weight by its LLM-detected `medium`: a photograph's colors
 * are incidental (scene/lighting, not brand intent) → down-weight; vector / flat /
 * illustration / 3d marks use color on purpose → up-weight. No analysis → ×1.
 */
function mediumFactor(asset: AssetWithAnalysis): number {
  const medium = (asset.analysis?.dimensions?.medium || []).map((m) => String(m).toLowerCase());
  if (medium.length === 0) return 1;
  if (medium.some((m) => m.includes('photo'))) return 0.5;
  if (medium.some((m) => /vector|flat|illustration|logo|3d|gradient|line/.test(m))) return 1.15;
  return 1;
}

/** Collect weighted analysis sources from a guideline's media + logos. */
export function collectAssetSources(guideline: {
  media?: AssetWithAnalysis[] | null;
  logos?: AssetWithAnalysis[] | null;
}): AssetSource[] {
  const sources: AssetSource[] = [];
  const clamp = (w: number) => Math.max(0.1, Math.min(1, w));
  for (const l of guideline.logos || []) {
    if (l?.url) sources.push({ url: l.url, weight: clamp(WEIGHT_LOGO * mediumFactor(l)) });
  }
  for (const m of guideline.media || []) {
    if (m?.url && m.type !== 'pdf') {
      const base = m.category
        ? (WEIGHT_MEDIA_BY_CATEGORY[m.category] ?? WEIGHT_MEDIA_DEFAULT)
        : WEIGHT_MEDIA_DEFAULT;
      sources.push({ url: m.url, weight: clamp(base * mediumFactor(m)) });
    }
  }
  return sources;
}
