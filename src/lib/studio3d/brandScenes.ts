/**
 * Brand-aware 3D Studio scenes.
 *
 * Given a brand guideline, produce a gallery of ready-to-apply scenes that pair a
 * real `SCENE_PRESETS` look (material finish + lighting + environment + animation +
 * FX — already renders well) with the brand's own colors (material color, rim/fresnel,
 * background). Mirrors the role-picking + WCAG-contrast logic of the server's
 * `figma-variable-compiler.ts`, kept client-local so we don't pull server code into
 * the bundle. Pure + dependency-free.
 */
import { SCENE_PRESETS } from '@/stores/studio3dStore';
import type { BrandGuideline, BrandColorTheme } from '@/lib/figma-types';

export interface BrandSceneConfig {
  material: string;
  color: string;
  roughness: number;
  metalness: number;
  animate: string;
  background: string;
  bgType: 'solid';
  transparentBg: false;
  lightIntensity: number;
  ambientIntensity: number;
  environment: string;
  customHdriUrl: '';
  envMapIntensity: number;
  fresnelColor: string;
  fresnelStrength: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
}

export interface BrandScene {
  key: string;
  label: string;
  /** [background, material color, accent] — for the swatch thumbnail. */
  swatches: [string, string, string];
  config: BrandSceneConfig;
}

// ── color math ───────────────────────────────────────────────────────────────

function hexToRgb(hex?: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** WCAG relative luminance, 0..1. */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const ch = [rgb.r, rgb.g, rgb.b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function isDark(hex: string): boolean {
  return luminance(hex) < 0.22;
}
function isLight(hex: string): boolean {
  return luminance(hex) > 0.7;
}

/** Plain RGB distance, 0..~441 — good enough to detect "same as background". */
function colorDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return 999;
  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
}

// ── palette derivation ─────────────────────────────────────────────────────────

interface Palette {
  accent: string;
  primary: string;
  secondary: string;
  neutral: string;
  darkBg: string;
  lightBg: string;
  all: string[];
}

const FALLBACK_DARK = '#0a0a0a';
const FALLBACK_LIGHT = '#f5f0eb';

/** First color whose role matches any keyword (substring, case-insensitive). */
function colorByRole(g: BrandGuideline, ...keywords: string[]): string | undefined {
  const colors = g.colors || [];
  for (const kw of keywords) {
    const hit = colors.find((c) => `${c.role || ''}`.toLowerCase().includes(kw));
    if (hit?.hex) return hit.hex;
  }
  return undefined;
}

function buildPalette(g: BrandGuideline): Palette | null {
  const colors = (g.colors || []).filter((c) => hexToRgb(c.hex));
  if (colors.length === 0) return null;

  // usageRank 1 = most used; fall back to usage proportion, then declared order.
  const sorted = [...colors].sort((a, b) => {
    if (a.usageRank != null && b.usageRank != null) return a.usageRank - b.usageRank;
    if (a.usage != null && b.usage != null) return b.usage - a.usage;
    return 0;
  });
  const hexes = sorted.map((c) => c.hex);

  const accent = colorByRole(g, 'accent', 'cta', 'primary') || hexes[0];
  const primary = colorByRole(g, 'primary') || hexes[0] || accent;
  const secondary = colorByRole(g, 'secondary') || hexes[1] || accent;

  // Background candidates: prefer declared bg/surface; else pick the darkest/lightest
  // brand color when it's dark/light enough, else a neutral fallback.
  const declaredBg = colorByRole(g, 'background', 'bg', 'surface');
  const darkest = [...hexes].sort((a, b) => luminance(a) - luminance(b))[0];
  const lightest = [...hexes].sort((a, b) => luminance(b) - luminance(a))[0];
  const darkBg = declaredBg && isDark(declaredBg) ? declaredBg : isDark(darkest) ? darkest : FALLBACK_DARK;
  const lightBg =
    declaredBg && isLight(declaredBg) ? declaredBg : isLight(lightest) ? lightest : FALLBACK_LIGHT;

  // Neutral for clay/matte looks: a muted/neutral role, else the lightest brand color.
  const neutral = colorByRole(g, 'neutral', 'muted', 'surface') || lightest || primary;

  return { accent, primary, secondary, neutral, darkBg, lightBg, all: hexes };
}

/**
 * Ensure the material color is visible against the background. If they're too close,
 * swap to the first contrasting brand color, else fall back to a readable brand tone.
 */
function ensureContrast(color: string, bg: string, palette: Palette): string {
  if (colorDistance(color, bg) >= 90) return color;
  const candidate = [palette.accent, palette.primary, palette.secondary, ...palette.all].find(
    (c) => colorDistance(c, bg) >= 110
  );
  if (candidate) return candidate;
  return isDark(bg) ? palette.lightBg : palette.darkBg;
}

// ── look definitions (reuse real presets, only recolor) ─────────────────────────

type ColorKey = 'primary' | 'accent' | 'secondary' | 'neutral';

interface LookDef {
  base: keyof typeof SCENE_PRESETS;
  /** Which palette color drives the material. */
  color: ColorKey;
  tone: 'dark' | 'light';
  /** Palette color for the rim/fresnel when the base look uses one. */
  rim?: ColorKey;
  /** Mood keywords that boost this look's priority. */
  moods: string[];
}

const LOOKS: LookDef[] = [
  { base: 'Product Shot', color: 'primary', tone: 'dark', moods: ['minimal', 'clean', 'simple', 'corporate'] },
  { base: 'Hero Banner', color: 'accent', tone: 'dark', rim: 'secondary', moods: ['luxur', 'premium', 'elegant', 'bold', 'tech'] },
  { base: 'Liquid Metal', color: 'primary', tone: 'dark', rim: 'accent', moods: ['luxur', 'premium', 'futur', 'tech', 'metal'] },
  { base: 'Dark Studio', color: 'accent', tone: 'dark', moods: ['tech', 'futur', 'cyber', 'elegant', 'mysterious'] },
  { base: 'Neon', color: 'accent', tone: 'dark', moods: ['vibrant', 'bold', 'cyber', 'play', 'energetic', 'tech'] },
  { base: 'Clay Render', color: 'neutral', tone: 'light', moods: ['minimal', 'soft', 'organic', 'calm', 'natural'] },
  { base: 'Y2K', color: 'accent', tone: 'dark', rim: 'secondary', moods: ['play', 'fun', 'vibrant', 'retro', 'bold'] },
];

/** Lowercased blob of every logo's visual analysis — robust to field-name drift. */
function moodBlob(g: BrandGuideline): string {
  try {
    return (g.logos || [])
      .map((l) => JSON.stringify((l as { analysis?: unknown }).analysis ?? ''))
      .join(' ')
      .toLowerCase();
  } catch {
    return '';
  }
}

function recolorLook(look: LookDef, palette: Palette): BrandScene {
  const preset = SCENE_PRESETS[look.base];
  const background = look.tone === 'light' ? palette.lightBg : palette.darkBg;
  const material = ensureContrast(palette[look.color], background, palette);
  const fresnelColor = look.rim ? palette[look.rim] : preset.fresnelColor ?? '';

  return {
    key: `look:${look.base}`,
    label: preset.label,
    swatches: [background, material, fresnelColor || palette.accent],
    config: {
      material: preset.material,
      color: material,
      roughness: preset.roughness,
      metalness: preset.metalness,
      animate: preset.animate,
      background,
      bgType: 'solid',
      transparentBg: false,
      lightIntensity: preset.lightIntensity,
      ambientIntensity: preset.ambientIntensity,
      environment: preset.environment,
      customHdriUrl: '',
      envMapIntensity: preset.envMapIntensity ?? 1,
      fresnelColor,
      fresnelStrength: preset.fresnelStrength ?? 0,
      bloomEnabled: preset.bloomEnabled ?? false,
      bloomIntensity: preset.bloomIntensity ?? 1,
      bloomThreshold: preset.bloomThreshold ?? 0.9,
    },
  };
}

function sceneFromTheme(theme: BrandColorTheme, palette: Palette): BrandScene | null {
  const bg = theme.bg;
  const color = ensureContrast(theme.primary || palette.primary, bg, palette);
  if (!hexToRgb(bg) || !hexToRgb(color)) return null;
  // A clean glossy look reads the brand's curated combo most faithfully.
  const preset = SCENE_PRESETS['Product Shot'];
  return {
    key: `theme:${theme.id || theme.name}`,
    label: theme.name || 'Theme',
    swatches: [bg, color, theme.accent || palette.accent],
    config: {
      material: 'plastic',
      color,
      roughness: preset.roughness,
      metalness: preset.metalness,
      animate: preset.animate,
      background: bg,
      bgType: 'solid',
      transparentBg: false,
      lightIntensity: preset.lightIntensity,
      ambientIntensity: preset.ambientIntensity,
      environment: preset.environment,
      customHdriUrl: '',
      envMapIntensity: 1,
      fresnelColor: theme.accent || '',
      fresnelStrength: theme.accent ? 0.3 : 0,
      bloomEnabled: false,
      bloomIntensity: 1,
      bloomThreshold: 0.9,
    },
  };
}

const MAX_SCENES = 10;

/**
 * Build the on-brand scene gallery. Curated color themes come first (highest signal),
 * then mood-ranked recolored looks. Returns [] when the brand has no usable colors.
 */
export function generateBrandScenes(guideline: BrandGuideline | null | undefined): BrandScene[] {
  if (!guideline) return [];
  const palette = buildPalette(guideline);
  if (!palette) return [];

  const scenes: BrandScene[] = [];
  const seen = new Set<string>();
  const push = (s: BrandScene | null) => {
    if (!s) return;
    const dedup = `${s.config.material}|${s.config.color}|${s.config.background}`;
    if (seen.has(dedup)) return;
    seen.add(dedup);
    scenes.push(s);
  };

  for (const theme of (guideline.colorThemes || []).slice(0, 3)) {
    push(sceneFromTheme(theme, palette));
  }

  const blob = moodBlob(guideline);
  const ranked = [...LOOKS]
    .map((look, i) => ({
      look,
      // higher = more on-brand; stable tiebreak by original order
      score: look.moods.reduce((acc, kw) => acc + (blob.includes(kw) ? 1 : 0), 0) - i * 0.001,
    }))
    .sort((a, b) => b.score - a.score);

  for (const { look } of ranked) push(recolorLook(look, palette));

  return scenes.slice(0, MAX_SCENES);
}
