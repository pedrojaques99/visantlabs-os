/**
 * Brand guideline → Figma variable VALUES (the deterministic theme layer).
 *
 * Mirrors `brand-token-compiler.ts` but instead of emitting CSS it emits the
 * semantic variable values a preset's `Brand` collection expects (see
 * `BRAND_TOKEN_VARS` in `figma-slots`). The plugin adds a per-brand MODE and
 * writes these via `setValueForMode` → switching the frame to that mode rethemes
 * the whole preset, zero hallucination. Pure + dependency-free → unit-testable.
 */
import type { BrandGuideline } from '../types/brandGuideline.js';
import { BRAND_TOKEN_VARS } from '../../src/lib/figma-slots.js';

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}
export interface FigmaVarValue {
  name: string;
  type: 'COLOR' | 'STRING' | 'FLOAT';
  value: FigmaColor | string | number;
}
export interface CompiledFigmaVariables {
  collectionName: string;
  /** Mode name = the brand — the per-brand library entry. */
  modeName: string;
  values: FigmaVarValue[];
}

function hexToFigmaColor(hex?: string): FigmaColor | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
    a: 1,
  };
}

// WCAG relative luminance (channels already 0–1) → pick #000/#fff like the brand
// page does, so `accent-text` is always readable on `accent`.
function luminance(c: FigmaColor): number {
  const ch = [c.r, c.g, c.b].map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function readableOn(bg: FigmaColor): FigmaColor {
  const lum = luminance(bg);
  const contrastWithBlack = (lum + 0.05) / 0.05;
  return contrastWithBlack >= 4.5 ? { r: 0, g: 0, b: 0, a: 1 } : { r: 1, g: 1, b: 1, a: 1 };
}

/** Find the first brand color whose role matches any of the given keywords. */
function colorByRole(bg: BrandGuideline, ...keywords: string[]): FigmaColor | null {
  const colors = bg.colors || [];
  for (const kw of keywords) {
    const hit = colors.find((c) => `${c.role || ''}`.toLowerCase().includes(kw));
    if (hit) return hexToFigmaColor(hit.hex);
  }
  return null;
}
function fontByRole(bg: BrandGuideline, ...keywords: string[]): string | null {
  const fonts = bg.typography || [];
  for (const kw of keywords) {
    const hit = fonts.find((f) => `${f.role || ''}`.toLowerCase().includes(kw));
    if (hit?.family) return hit.family;
  }
  return null;
}

/**
 * Compile a brand into the variable values its presets theme off of. Only emits
 * variables the brand actually provides (no fabricated tokens). `accent` falls
 * back to the first color; `accent-text` is computed for contrast.
 */
export function compileFigmaVariables(
  bg: BrandGuideline,
  opts: { collectionName?: string; modeName?: string } = {}
): CompiledFigmaVariables {
  const values: FigmaVarValue[] = [];
  const pushColor = (name: string, c: FigmaColor | null) => {
    if (c) values.push({ name, type: 'COLOR', value: c });
  };
  const firstColor = hexToFigmaColor(bg.colors?.[0]?.hex);

  const accent = colorByRole(bg, 'accent', 'cta', 'primary') || firstColor;
  pushColor('accent', accent);
  if (accent) pushColor('accent-text', readableOn(accent));
  pushColor('primary', colorByRole(bg, 'primary') || accent);
  pushColor('secondary', colorByRole(bg, 'secondary'));
  pushColor('bg', colorByRole(bg, 'background', 'bg'));
  pushColor('surface', colorByRole(bg, 'surface', 'background', 'bg'));
  pushColor('text', colorByRole(bg, 'text', 'foreground'));
  pushColor('text-muted', colorByRole(bg, 'muted', 'secondary'));

  const heading = fontByRole(bg, 'head', 'display', 'title');
  const body = fontByRole(bg, 'body', 'paragraph', 'text');
  if (heading) values.push({ name: 'heading-font', type: 'STRING', value: heading });
  if (body || heading) values.push({ name: 'body-font', type: 'STRING', value: body || heading! });

  const radius = (bg.tokens as any)?.radius as Record<string, number> | undefined;
  if (radius) {
    for (const [k, varName] of [
      ['sm', 'radius-sm'],
      ['md', 'radius-md'],
      ['lg', 'radius-lg'],
    ] as const) {
      if (typeof radius[k] === 'number')
        values.push({ name: varName, type: 'FLOAT', value: radius[k] });
    }
  }

  // Keep only the known vocabulary — guards against drift from BRAND_TOKEN_VARS.
  const known = new Set<string>([
    ...BRAND_TOKEN_VARS.color,
    ...BRAND_TOKEN_VARS.font,
    ...BRAND_TOKEN_VARS.number,
  ]);
  const filtered = values.filter((v) => known.has(v.name));

  return {
    collectionName: opts.collectionName || 'Brand',
    modeName: opts.modeName || bg.identity?.name || 'Brand',
    values: filtered,
  };
}
