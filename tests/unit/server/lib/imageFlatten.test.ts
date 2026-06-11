import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { flattenAlphaIfNeeded } from '../../../../server/lib/imageFlatten.js';

// Unit tests for flattenAlphaIfNeeded — image-gen providers reject/degrade RGBA,
// so reference images with an alpha channel must be flattened to a white bg
// before they reach a provider. Opaque images and non-PNG/WebP types pass through.

async function makePng(opts: { alpha: boolean }): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: opts.alpha ? 4 : 3,
      background: opts.alpha
        ? { r: 255, g: 0, b: 0, alpha: 0.5 }
        : { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

describe('flattenAlphaIfNeeded', () => {
  it('flattens a PNG that has an alpha channel', async () => {
    const input = await makePng({ alpha: true });
    expect((await sharp(input).metadata()).hasAlpha).toBe(true);

    const out = await flattenAlphaIfNeeded(input, 'image/png');
    expect(out.mimeType).toBe('image/png');

    const meta = await sharp(out.buffer).metadata();
    expect(meta.hasAlpha).toBe(false);
  });

  it('leaves an opaque PNG untouched (returns same buffer)', async () => {
    const input = await makePng({ alpha: false });
    expect((await sharp(input).metadata()).hasAlpha).toBe(false);

    const out = await flattenAlphaIfNeeded(input, 'image/png');
    expect(out.buffer).toBe(input); // identity — no re-encode
    expect(out.mimeType).toBe('image/png');
  });

  it('skips non-PNG/WebP mime types without touching the buffer', async () => {
    const input = Buffer.from('not-an-image');
    const out = await flattenAlphaIfNeeded(input, 'image/jpeg');
    expect(out.buffer).toBe(input);
    expect(out.mimeType).toBe('image/jpeg');
  });
});
