import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import {
  trace,
  tracePipeline,
  traceImage,
  parseBase64Image,
  TRACE_PRESETS,
  resolveTraceOptions,
} from '@visant/logo-trace';

// A tiny synthetic raster: a centered black square on a white background.
// Big enough that potrace yields a real path, small enough to trace instantly.
async function blackSquarePng(size = 32): Promise<Buffer> {
  const inset = Math.floor(size / 4);
  const side = size - inset * 2;
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="${inset}" y="${inset}" width="${side}" height="${side}" fill="#000"/></svg>`
  );
  return sharp({
    create: { width: size, height: size, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

describe('@visant/logo-trace — presets', () => {
  it('exposes the calibrated preset values unchanged', () => {
    expect(TRACE_PRESETS.logo).toEqual({
      turdSize: 3,
      optTolerance: 0.3,
      threshold: 'auto',
      alphaMax: 0.8,
    });
    expect(TRACE_PRESETS.lettering).toEqual({
      turdSize: 1,
      optTolerance: 0.15,
      threshold: 'auto',
      alphaMax: 0.5,
    });
    expect(TRACE_PRESETS.lineArt).toEqual({
      turdSize: 0,
      optTolerance: 0.1,
      threshold: 128,
      alphaMax: 1.0,
    });
    expect(TRACE_PRESETS.stamp).toEqual({
      turdSize: 5,
      optTolerance: 0.5,
      threshold: 'auto',
      alphaMax: 0.8,
    });
  });

  it('merges explicit options over the preset base', () => {
    const resolved = resolveTraceOptions({ preset: 'logo', turdSize: 9 });
    expect(resolved.turdSize).toBe(9); // explicit wins
    expect(resolved.optTolerance).toBe(0.3); // from preset
    expect(resolved.threshold).toBe('auto');
  });

  it('returns custom/unknown options untouched', () => {
    const opts = { preset: 'custom' as const, threshold: 100 };
    expect(resolveTraceOptions(opts)).toBe(opts);
  });
});

describe('@visant/logo-trace — parseBase64Image', () => {
  it('parses a valid base64 image data URI into a Buffer', () => {
    // 1x1 transparent PNG
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';
    const buf = parseBase64Image(`data:image/png;base64,${b64}`);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf!.length).toBeGreaterThan(0);
  });

  it('accepts MIME types with non-word chars (svg+xml)', () => {
    const buf = parseBase64Image('data:image/svg+xml;base64,PHN2Zy8+');
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('returns null for a non-image / prefix-less string', () => {
    expect(parseBase64Image('not-a-data-uri')).toBeNull();
    expect(parseBase64Image('data:text/plain;base64,aGk=')).toBeNull();
    // raw base64 without the data-uri prefix is intentionally rejected
    expect(parseBase64Image('iVBORw0KGgo=')).toBeNull();
  });
});

describe('@visant/logo-trace — trace', () => {
  let png: Buffer;
  beforeAll(async () => {
    png = await blackSquarePng(32);
  });

  it('traces a raster buffer to an SVG string with a path', async () => {
    const svg = await trace(png, { preset: 'logo' });
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    // the path should carry real geometry, not an empty d=""
    expect(/d="[^"]{5,}"/.test(svg)).toBe(true);
  });

  it('preserves the source dimensions in the SVG header', async () => {
    const svg = await trace(png, { preset: 'logo' });
    expect(svg).toMatch(/width="32"/);
    expect(svg).toMatch(/height="32"/);
  });

  it('trace is an alias of tracePipeline', () => {
    expect(trace).toBe(tracePipeline);
  });

  it('honors an explicit numeric threshold', async () => {
    const svg = await trace(png, { threshold: 128, turdSize: 1 });
    expect(svg).toContain('<path');
  });

  it('traceImage returns raw (uncleaned) potrace SVG with a path', async () => {
    const raw = await traceImage(png, { preset: 'logo' });
    expect(raw).toContain('<svg');
    expect(raw).toContain('<path');
  });
});
