/**
 * Objective facts about a reference image: pixel size + dominant palette.
 *
 * These are cheap, deterministic things an LLM should never be asked for. The
 * ingestor already spends 3 AI calls per image on *semantics* (what the design
 * IS); size and colour are arithmetic.
 *
 * Why not node-vibrant (the usual pick): it pulls its own decode backend, and
 * all we need is a histogram over pixels sharp already hands us — sharp and
 * colord are both existing deps. If palette quality ever needs to rival
 * Vibrant's swatch model (vibrant/muted/dark variants), swap this internal —
 * `extractImageFacts` is the only exported surface.
 *
 * sharp is imported dynamically: top-level native imports crash Vercel Lambda
 * on cold-start (see scripts/check-serverless-imports.mjs and lib/thumbHash.ts).
 */

import { colord } from 'colord';

export interface ImageFacts {
  width?: number;
  height?: number;
  /** Dominant colours as hex, most-frequent first. */
  palette?: string[];
  /** width / height, rounded to 3dp — lets the client reserve space. */
  aspectRatio?: number;
}

/** Bits per channel kept when bucketing. 4 → 16 levels/channel, 4096 bins. */
const QUANT_BITS = 4;
const SHIFT = 8 - QUANT_BITS;
/** Sample grid — big enough to catch accents, small enough to be instant. */
const SAMPLE_SIZE = 48;
const MAX_SWATCHES = 5;

/**
 * Near-white/near-black pixels dominate photos (paper, studio backdrops) and
 * say nothing about a brand's palette, so they only survive if nothing else does.
 */
function isNeutral(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 244 || max < 12 || max - min < 10;
}

/**
 * Extract pixel dimensions + a dominant-colour palette. Never throws — returns
 * `{}` on failure, matching computeThumbHash's contract (callers treat missing
 * facts as "unknown", never as an error).
 */
export async function extractImageFacts(input: Buffer): Promise<ImageFacts> {
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(input);
    const meta = await image.metadata();

    const facts: ImageFacts = {};
    if (meta.width && meta.height) {
      facts.width = meta.width;
      facts.height = meta.height;
      facts.aspectRatio = Math.round((meta.width / meta.height) * 1000) / 1000;
    }

    const { data, info } = await sharp(input)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Bucket pixels into a coarse RGB histogram, tracking each bin's true mean
    // so the swatch is an actual colour from the image, not the bin's corner.
    const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
    const neutrals = new Map<number, { n: number; r: number; g: number; b: number }>();
    const stride = info.channels;

    for (let i = 0; i < data.length; i += stride) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> SHIFT) << (QUANT_BITS * 2)) | ((g >> SHIFT) << QUANT_BITS) | (b >> SHIFT);
      const target = isNeutral(r, g, b) ? neutrals : bins;
      const cur = target.get(key);
      if (cur) {
        cur.n++;
        cur.r += r;
        cur.g += g;
        cur.b += b;
      } else {
        target.set(key, { n: 1, r, g, b });
      }
    }

    const source = bins.size > 0 ? bins : neutrals;
    const palette = [...source.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, MAX_SWATCHES)
      .map(({ n, r, g, b }) =>
        colord({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }).toHex()
      );

    if (palette.length) facts.palette = palette;
    return facts;
  } catch (err) {
    console.warn('[imageFacts] extraction failed:', err);
    return {};
  }
}
