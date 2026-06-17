import { describe, it, expect } from 'vitest';
import { hexToRgb, colorDistance, computeColorUsage, collectAssetUrls } from '../colorUsage.js';
import { inferGender } from '../personaPhotos.js';

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

  it('collectAssetUrls pulls image media + logos, skips pdfs', () => {
    const urls = collectAssetUrls({
      media: [
        { url: 'https://x/a.png', type: 'image' },
        { url: 'https://x/doc.pdf', type: 'pdf' },
      ],
      logos: [{ url: 'https://x/logo.svg' }, { url: undefined as any }],
    });
    expect(urls).toEqual(['https://x/a.png', 'https://x/logo.svg']);
  });

  it('computeColorUsage returns input unchanged when there are no assets', async () => {
    const colors = [{ hex: '#ff0000', name: 'Red' }];
    const out = await computeColorUsage(colors, []);
    expect(out).toEqual(colors);
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
