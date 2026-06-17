import { describe, it, expect } from 'vitest';
import { hexToRgb, colorDistance, computeColorUsage, collectAssetSources } from '../colorUsage.js';
import { inferGender, brandImageryHint } from '../personaPhotos.js';

describe('colorUsage helpers', () => {
  it('parses 6- and 3-digit hex (with/without #)', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('not-a-color')).toBeNull();
  });

  it('redmean distance is zero for identical colors and grows with difference', () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    expect(colorDistance(black, black)).toBe(0);
    expect(colorDistance(black, white)).toBeGreaterThan(colorDistance(black, { r: 10, g: 10, b: 10 }));
  });

  it('collectAssetSources weights logos > designed media > stock, skips pdfs', () => {
    const sources = collectAssetSources({
      media: [
        { url: 'https://x/stock.png', type: 'image', category: 'stock' },
        { url: 'https://x/graphic.png', type: 'image', category: 'graphic' },
        { url: 'https://x/plain.png', type: 'image' },
        { url: 'https://x/doc.pdf', type: 'pdf' },
      ],
      logos: [{ url: 'https://x/logo.svg' }, { url: undefined as any }],
    });
    // logo first at full weight, pdf dropped
    expect(sources.map((s) => s.url)).toEqual([
      'https://x/logo.svg',
      'https://x/stock.png',
      'https://x/graphic.png',
      'https://x/plain.png',
    ]);
    const w = Object.fromEntries(sources.map((s) => [s.url, s.weight]));
    expect(w['https://x/logo.svg']).toBe(1.0);
    expect(w['https://x/stock.png']).toBeLessThan(w['https://x/graphic.png']);
    expect(w['https://x/graphic.png']).toBeLessThanOrEqual(1.0);
  });

  it('computeColorUsage returns input unchanged when there are no assets', async () => {
    const colors = [{ hex: '#ff0000', name: 'Red' }];
    const out = await computeColorUsage(colors, []);
    expect(out).toEqual(colors);
  });
});

describe('brandImageryHint', () => {
  it('prefers the brand imagery direction (first sentence, capped)', () => {
    expect(
      brandImageryHint({ guidelines: { imagery: 'Warm, muted documentary tones. Avoid stock.' } })
    ).toBe('Warm, muted documentary tones');
  });

  it('falls back to tone-of-voice titles, then undefined', () => {
    expect(
      brandImageryHint({ strategy: { voiceValues: [{ title: 'Bold' }, { title: 'Human' }] } })
    ).toBe('Bold, Human');
    expect(brandImageryHint({})).toBeUndefined();
  });
});

describe('inferGender', () => {
  it('honors an explicit gender field (incl. PT synonyms)', () => {
    expect(inferGender({ gender: 'female' })).toBe('female');
    expect(inferGender({ gender: 'masculino' })).toBe('male');
    expect(inferGender({ gender: 'mulher' })).toBe('female');
  });

  it('matches common names case- and accent-insensitively', () => {
    expect(inferGender({ name: 'João Silva' })).toBe('male');
    expect(inferGender({ name: 'maria' })).toBe('female');
  });

  it('falls back to the PT ending heuristic, then neutral', () => {
    expect(inferGender({ name: 'Fernanda' })).toBe('female'); // ends in "a"
    expect(inferGender({ name: 'Rodrigo' })).toBe('male'); // ends in "o"
    expect(inferGender({ name: 'Kael' })).toBe('neutral');
    expect(inferGender({})).toBe('neutral');
  });
});
