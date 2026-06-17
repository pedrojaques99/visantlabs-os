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

async function accumulateFromImage(
  buffer: Buffer,
  brand: RGB[],
  counts: number[]
): Promise<void> {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(buffer)
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

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
}

/**
 * Compute usage proportions and return a NEW colors array with `usage` (0..1)
 * and `usageRank` (1 = most used) merged onto each color. Colors that never
 * matched keep `usage: 0`. Returns the input unchanged if there are no valid
 * colors or no assets to analyze.
 */
export async function computeColorUsage<T extends UsageColor>(
  colors: T[],
  assetUrls: string[]
): Promise<T[]> {
  if (!Array.isArray(colors) || colors.length === 0) return colors;
  const brand = colors.map((c) => hexToRgb(c.hex));
  const valid = brand.every(Boolean);
  if (!valid || assetUrls.length === 0) return colors;

  const counts = new Array(colors.length).fill(0);

  // Bound the work: at most 40 assets, fetch in small concurrent batches.
  const urls = assetUrls.filter((u) => typeof u === 'string' && /^https?:/i.test(u)).slice(0, 40);
  const BATCH = 6;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const res = await safeFetch(url);
          if (!res.ok) return;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length === 0) return;
          await accumulateFromImage(buf, brand as RGB[], counts);
        } catch {
          /* unreachable / decode failure — skip this asset */
        }
      })
    );
  }

  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    // Nothing matched — clear any stale usage so the UI falls back to uniform.
    return colors.map((c) => ({ ...c, usage: 0, usageRank: undefined }));
  }

  const withUsage = colors.map((c, i) => ({ ...c, usage: counts[i] / total }));
  // Rank by usage descending (1 = most used).
  const order = withUsage
    .map((c, i) => ({ i, usage: c.usage }))
    .sort((a, b) => b.usage - a.usage);
  order.forEach((o, rank) => {
    (withUsage[o.i] as any).usageRank = rank + 1;
  });

  return withUsage;
}

/** Collect analyzable image URLs from a guideline's media + logos. */
export function collectAssetUrls(guideline: {
  media?: Array<{ url?: string; type?: string }> | null;
  logos?: Array<{ url?: string }> | null;
}): string[] {
  const urls: string[] = [];
  for (const m of guideline.media || []) {
    if (m?.url && m.type !== 'pdf') urls.push(m.url);
  }
  for (const l of guideline.logos || []) {
    if (l?.url) urls.push(l.url);
  }
  return urls;
}
