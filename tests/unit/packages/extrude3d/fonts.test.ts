import { describe, it, expect } from 'vitest';
import opentype from 'opentype.js';
import { textToSvg } from '@visant/extrude3d/fonts';
import { parseShapesFromSVG } from '@visant/extrude3d';
import { JSDOM } from 'jsdom';
import { beforeAll } from 'vitest';

beforeAll(() => {
  if (typeof globalThis.DOMParser === 'undefined') {
    globalThis.DOMParser = new JSDOM('').window.DOMParser as unknown as typeof DOMParser;
  }
});

/**
 * Build a tiny synthetic opentype.js font with a single non-empty glyph (a
 * filled square for the letter "A"), plus the required .notdef. Avoids shipping
 * a TTF / hitting the network while still exercising the real opentype.js path
 * (getPath / stringToGlyphs / getKerningValue) that textToSvg uses.
 */
function squareFont(): opentype.Font {
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 650, path: new opentype.Path() });

  const path = new opentype.Path();
  path.moveTo(100, 0);
  path.lineTo(500, 0);
  path.lineTo(500, 700);
  path.lineTo(100, 700);
  path.close();

  const aGlyph = new opentype.Glyph({
    name: 'A',
    unicode: 'A'.charCodeAt(0),
    advanceWidth: 650,
    path,
  });

  return new opentype.Font({
    familyName: 'SquareTest',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: [notdef, aGlyph],
  });
}

describe('@visant/extrude3d — textToSvg', () => {
  it('renders glyphs into a centered SVG with path data', () => {
    const font = squareFont();
    const svg = textToSvg('A', font);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 200 200"');
    expect(svg).toMatch(/<path d="[^"]+"/);
  });

  it('produces an SVG that parses into extrudable shapes', () => {
    const font = squareFont();
    const svg = textToSvg('A', font);
    const shapes = parseShapesFromSVG(svg);
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('returns empty string for whitespace-only / empty text', () => {
    const font = squareFont();
    expect(textToSvg('', font)).toBe('');
  });
});
