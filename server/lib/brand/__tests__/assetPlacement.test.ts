import { describe, it, expect } from 'vitest';
import {
  normalizePlacementSemantic,
  computeMechanics,
  parseAnalysisJson,
} from '../assetAnalysis.js';

describe('parseAnalysisJson (salvage on truncated description)', () => {
  it('parses well-formed JSON', () => {
    const j = parseAnalysisJson(
      '{"dimensions":{"vibe":["bold"]},"placement":{"kind":"logo"},"description":"a logo"}'
    );
    expect(j.placement.kind).toBe('logo');
  });

  it('salvages dimensions + placement when the trailing description is truncated', () => {
    // Description runs away and the response is cut mid-string (real Gemini failure).
    const truncated =
      '{"dimensions":{"vibe":["bold"]},"placement":{"kind":"logo","luminance":"dark"},"description":"this is a very long runaway description that never term';
    const j = parseAnalysisJson(truncated);
    expect(j.placement.kind).toBe('logo');
    expect(j.placement.luminance).toBe('dark');
    expect(j.dimensions.vibe).toEqual(['bold']);
  });

  it('throws when nothing is salvageable', () => {
    expect(() => parseAnalysisJson('{"dimensions":{"vibe":["bo')).toThrow();
  });
});

describe('normalizePlacementSemantic', () => {
  it('clamps kind/luminance to the valid union, drops junk', () => {
    const p = normalizePlacementSemantic({
      kind: 'LOGO',
      luminance: 'Dark',
      contrastSafeOn: ['light', 'DARK', 'purple'],
      hasText: true,
      text: '  Visant  ',
    });
    expect(p.kind).toBe('logo');
    expect(p.luminance).toBe('dark');
    expect(p.contrastSafeOn).toEqual(['light', 'dark']);
    expect(p.hasText).toBe(true);
    expect(p.text).toBe('Visant');
  });

  it('drops invalid kind/luminance rather than guessing', () => {
    const p = normalizePlacementSemantic({ kind: 'sticker', luminance: 'neon' });
    expect(p.kind).toBeUndefined();
    expect(p.luminance).toBeUndefined();
  });

  it('infers hasText from a non-empty text when the flag is missing', () => {
    expect(normalizePlacementSemantic({ text: 'Hello' }).hasText).toBe(true);
    expect(normalizePlacementSemantic({ text: '' }).hasText).toBeUndefined();
  });

  it('returns empty object for non-object input', () => {
    expect(normalizePlacementSemantic(null)).toEqual({});
    expect(normalizePlacementSemantic('nope')).toEqual({});
  });
});

describe('computeMechanics (sharp, deterministic)', () => {
  it('measures aspect ratio and reports opaque images as non-transparent', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 10, g: 20, b: 200 } },
    })
      .png()
      .toBuffer();
    const m = await computeMechanics(png);
    expect(m.aspectRatio).toBeCloseTo(2, 2);
    expect(m.hasTransparency).toBe(false);
    // dominant is histogram-bucketed (approximate), not the exact fill — assert the
    // hue: dominated by blue, with low red/green.
    const hex = m.dominantColor!;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(180);
    expect(r).toBeLessThan(60);
    expect(g).toBeLessThan(60);
  });

  it('detects real transparency (alpha channel with transparent pixels)', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const m = await computeMechanics(png);
    expect(m.hasTransparency).toBe(true);
    expect(m.aspectRatio).toBeCloseTo(1, 2);
  });

  it('returns empty object on a non-image buffer without throwing', async () => {
    const m = await computeMechanics(Buffer.from('not an image'));
    expect(m).toEqual({});
  });
});
