import type { OpenTypeFontLike } from './types.js';

/**
 * Render `text` with an opentype.js font into a centered, auto-fitted SVG
 * string whose `<path>` glyphs are ready for {@link buildExtrudedGeometry}.
 *
 * The font is fitted into a 200×200 viewBox (10px padding), shrinking the font
 * size in 4px steps until it fits, then centered. Per-glyph kerning is applied.
 * Returns `''` for empty/whitespace-only text or on any failure.
 *
 * Pure: the caller supplies an already-loaded font object (this package never
 * imports or depends on `opentype.js`).
 */
export function textToSvg(text: string, font: OpenTypeFontLike): string {
  try {
    return _textToSvg(text, font);
  } catch (err) {
    console.warn('textToSvg failed:', err);
    return '';
  }
}

function _textToSvg(text: string, font: OpenTypeFontLike): string {
  const size = 200;
  const available = size - 20;
  let fontSize = 180;
  let fullPath = font.getPath(text, 0, 0, fontSize);
  let bb = fullPath.getBoundingBox();
  let w = bb.x2 - bb.x1;
  let h = bb.y2 - bb.y1;

  while ((w > available || h > available) && fontSize > 8) {
    fontSize -= 4;
    fullPath = font.getPath(text, 0, 0, fontSize);
    bb = fullPath.getBoundingBox();
    w = bb.x2 - bb.x1;
    h = bb.y2 - bb.y1;
  }

  const offsetX = (size - w) / 2 - bb.x1;
  const offsetY = (size - h) / 2 - bb.y1;
  const glyphs = font.stringToGlyphs(text);
  let x = offsetX;
  const paths: string[] = [];
  const unitsPerEm = font.unitsPerEm || 1000;

  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const glyphPath = glyph.getPath(x, offsetY, fontSize);
    const d = glyphPath.toPathData(2);
    if (d) {
      paths.push(`<path d="${d}" fill="black" fill-rule="evenodd"/>`);
    }
    const advance = (glyph.advanceWidth || 0) * (fontSize / unitsPerEm);
    if (i < glyphs.length - 1) {
      const kerning = font.getKerningValue(glyphs[i], glyphs[i + 1]);
      x += advance + kerning * (fontSize / unitsPerEm);
    } else {
      x += advance;
    }
  }

  if (paths.length === 0) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths.join(
    ''
  )}</svg>`;
}
