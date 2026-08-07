/**
 * Minimum quality bar for a reference image — one threshold, three consumers:
 * the ingest gate (server), the low-resolution notice in the lightbox (client),
 * and any future moderation surface.
 *
 * Why it exists: `extractImageFacts` already computes width/height BEFORE the
 * Mongo insert, and nothing ever compared them to anything. So a 110×140 thumb
 * scraped from a page landed in the library next to a 3000px poster and
 * rendered as a stamp lost in the lightbox.
 *
 * Deliberately generous. This is a floor for "can a designer actually read
 * this", not a curation opinion — curation is the moderation queue's job.
 */

/** Shortest side, in pixels. Below this an image cannot carry a design idea. */
export const MIN_SHORT_SIDE = 400;

/** Total pixels. Catches long, thin strips that pass the short-side test. */
export const MIN_PIXELS = 240_000; // ~= 600 × 400

export interface Pixels {
  width?: number;
  height?: number;
}

/**
 * True when the image is too small to be useful. Unknown dimensions are NOT
 * low-res — legacy rows predate `extractImageFacts`, and treating "unmeasured"
 * as "bad" would flag thousands of fine references.
 */
export function isLowResolution({ width, height }: Pixels): boolean {
  if (!width || !height) return false;
  return Math.min(width, height) < MIN_SHORT_SIDE || width * height < MIN_PIXELS;
}

/** Human explanation, for a rejection message or a moderation note. */
export function lowResolutionReason({ width, height }: Pixels): string | undefined {
  if (!width || !height) return undefined;
  if (Math.min(width, height) < MIN_SHORT_SIDE) {
    return `menor lado ${Math.min(width, height)}px (mínimo ${MIN_SHORT_SIDE}px)`;
  }
  if (width * height < MIN_PIXELS) {
    return `${width}×${height} = ${(width * height / 1000).toFixed(0)}k pixels (mínimo ${MIN_PIXELS / 1000}k)`;
  }
  return undefined;
}
