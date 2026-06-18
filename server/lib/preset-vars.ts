/**
 * Brand → web-preset variables + fonts. Reuses `compileFigmaVariables` (the single
 * brand-token mapper) and converts its RGB(0–1) values to CSS hex. One source of
 * truth: the Figma render and the web render theme off the exact same tokens.
 */
import type { BrandGuideline } from '../types/brandGuideline.js';
import { compileFigmaVariables } from './figma-variable-compiler.js';
import type { PresetVars } from './preset-html.js';
import { usableFamily, type BrandFontSpec } from './brand-fonts.js';

function hex(c: { r: number; g: number; b: number }): string {
  const ch = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`.toUpperCase();
}

export function brandToPresetVars(brand: BrandGuideline): PresetVars {
  const vals = compileFigmaVariables(brand).values;
  const get = (n: string) => vals.find((v) => v.name === n)?.value;
  const col = (n: string, fb: string): string => {
    const v = get(n);
    return v && typeof v === 'object' ? hex(v as any) : fb;
  };
  const accent = col('accent', '#7C3AED');
  const text = col('text', '#FFFFFF');
  const headingFamily =
    typeof get('heading-font') === 'string' ? (get('heading-font') as string) : 'Inter';
  const bodyFamily = typeof get('body-font') === 'string' ? (get('body-font') as string) : 'Inter';
  const radius = typeof get('radius-lg') === 'number' ? (get('radius-lg') as number) : 32;

  return {
    bg: col('bg', '#0F0F12'),
    surface: col('surface', '#1A1A1F'),
    text,
    heading: text,
    accent,
    accentText: col('accent-text', '#FFFFFF'),
    headingFont: usableFamily(headingFamily, false),
    bodyFont: usableFamily(bodyFamily, false),
    radius,
  };
}

/** The brand's font families for `buildFontCss` (default weights). */
export function brandToFonts(brand: BrandGuideline): BrandFontSpec[] {
  const vals = compileFigmaVariables(brand).values;
  const get = (n: string) => vals.find((v) => v.name === n)?.value;
  const families = new Set<string>();
  for (const n of ['heading-font', 'body-font']) {
    const v = get(n);
    if (typeof v === 'string' && v.trim()) families.add(v.trim());
  }
  if (!families.size) families.add('Inter');
  return [...families].map((family) => ({ family, weights: [400, 600, 700] }));
}
