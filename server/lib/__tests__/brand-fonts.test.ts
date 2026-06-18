import { describe, it, expect } from 'vitest';
import { fontSlug, buildFontCss, googleFontsHref } from '../brand-fonts.js';

describe('fontSlug', () => {
  it('slugifies families and maps the special cases', () => {
    expect(fontSlug('Open Sans')).toBe('open-sans');
    expect(fontSlug('Inter')).toBe('inter');
    expect(fontSlug('Geist')).toBe('geist-sans'); // not a plain slug
    expect(fontSlug('Geist Mono')).toBe('geist-mono');
  });
});

describe('buildFontCss', () => {
  it('inlines @font-face for an uploaded WOFF2 (R2)', () => {
    const { css, families } = buildFontCss([
      { family: 'Geist', weights: [700], woff2Url: 'https://r2/geist.woff2' },
    ]);
    expect(css).toContain('@font-face');
    expect(css).toContain("font-family:'Geist'");
    expect(css).toContain("url('https://r2/geist.woff2') format('woff2')");
    expect(css).toContain('font-weight:700');
    expect(families).toEqual(['Geist']);
  });

  it('uses @fontsource (jsDelivr) for non-uploaded fonts, imports first', () => {
    const { css, families } = buildFontCss([
      { family: 'Open Sans', weights: [400, 700] },
      { family: 'Geist', weights: [500] },
    ]);
    expect(css).toContain('@import url(');
    expect(css).toContain('@fontsource/open-sans/400.css');
    expect(css).toContain('@fontsource/open-sans/700.css');
    expect(css).toContain('@fontsource/geist-sans/500.css');
    // @import lines must come before any non-import rule
    const lines = css.split('\n').filter(Boolean);
    const lastImport = lines.map((l) => l.startsWith('@import')).lastIndexOf(true);
    const firstNonImport = lines.findIndex((l) => !l.startsWith('@import'));
    expect(firstNonImport === -1 || lastImport < firstNonImport).toBe(true);
    expect(families).toEqual(['Open Sans', 'Geist']);
  });

  it('builds a Google Fonts href for non-uploaded families', () => {
    const href = googleFontsHref([{ family: 'Open Sans', weights: [400, 700] }]);
    expect(href).toContain('fonts.googleapis.com/css2');
    expect(href).toContain('family=Open+Sans:wght@400;700');
    expect(href).toContain('display=swap');
  });
});
