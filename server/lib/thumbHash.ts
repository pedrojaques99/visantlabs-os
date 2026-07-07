import { rgbaToThumbHash } from 'thumbhash';

/**
 * Compute a base64 thumbhash (instant LQIP placeholder) from any image buffer.
 * SSoT used by both the reference ingestor and the backfill script.
 * Returns '' on failure (callers treat it as "no placeholder").
 *
 * sharp is imported dynamically: top-level native imports crash Vercel Lambda
 * on cold-start (see scripts/check-serverless-imports.mjs).
 */
export async function computeThumbHash(input: Buffer): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(input)
      .resize(96, 96, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString('base64');
  } catch {
    return '';
  }
}
