import { describe, it, expect } from 'vitest';
import { createNodeAdapter } from '@visant/psd-engine/adapters/node';

describe('node adapter', () => {
  it('createNodeAdapter exposes createCanvas / loadImage / toBuffer', async () => {
    const adapter = await createNodeAdapter();
    expect(typeof adapter.createCanvas).toBe('function');
    expect(typeof adapter.loadImage).toBe('function');
    expect(typeof adapter.toBuffer).toBe('function');
  });

  it('createCanvas + toBuffer round-trips through a PNG buffer', async () => {
    const { createCanvas, toBuffer, loadImage } = await createNodeAdapter();
    const canvas = createCanvas(16, 16);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 16, 16);

    const png = toBuffer(canvas, 'image/png');
    // PNG magic number
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png.length).toBeGreaterThan(0);

    // loadImage should decode the buffer we just produced
    const img = await loadImage(png);
    expect(img.width).toBe(16);
    expect(img.height).toBe(16);
  });

  it('toBuffer supports JPEG with options', async () => {
    const { createCanvas, toBuffer } = await createNodeAdapter();
    const canvas = createCanvas(8, 8);
    const jpeg = toBuffer(canvas, 'image/jpeg', { quality: 0.8 });
    // JPEG magic number
    expect(jpeg[0]).toBe(0xff);
    expect(jpeg[1]).toBe(0xd8);
  });
});
