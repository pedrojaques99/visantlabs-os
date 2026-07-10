import type {
  BrandGuideline,
  BrandGuidelineGradient,
  BrandGuidelineShadow,
  BrandGuidelineBorder,
  BrandGuidelineMotion,
  BrandColorTheme,
} from '@/lib/figma-types';
import { extractBrandTheme, type BrandTheme } from '@/components/brand/BrandReadOnlyView';

export interface MockTokens {
  theme: BrandTheme;
  name: string;
  tagline?: string;
  description?: string;
  manifestoFirstLine?: string;
  /** Full manifesto text (multi-sentence) for editorial layouts. */
  manifesto?: string;
  /** Punchy single-word brand keywords (from values/aesthetic tags). */
  keywords: string[];
  primaryLogo?: { url: string; variant: string };
  lightLogo?: { url: string; variant: string };
  darkLogo?: { url: string; variant: string };
  iconLogo?: { url: string; variant: string };
  headingFamily: string;
  bodyFamily: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  /** All defined colors (for swatches) */
  palette: Array<{ hex: string; name?: string; role?: string }>;
  /** Brand gradients for hero/decorative backgrounds */
  gradients: BrandGuidelineGradient[];
  /** Brand shadows for card/element elevation */
  shadows: BrandGuidelineShadow[];
  /** Brand border tokens */
  borders: BrandGuidelineBorder[];
  /** Brand motion tokens (easing, durations) */
  motion?: BrandGuidelineMotion;
  /** User-defined color themes (explicit bg/text/primary/accent combos) */
  colorThemes: BrandColorTheme[];
  /** Categorized media from the library */
  mediaByCategory: {
    background: string[];
    graphic: string[];
    stock: string[];
    product: string[];
  };
}

const FALLBACK = {
  heading: 'Inter, ui-sans-serif, system-ui, sans-serif',
  body: 'Inter, ui-sans-serif, system-ui, sans-serif',
  primary: '#888888',
  secondary: '#666666',
  accent: '#AAAAAA',
};

/** Build a CSS gradient string from a BrandGuidelineGradient */
export function gradientToCSS(g: BrandGuidelineGradient): string {
  if (g.css) return g.css;
  const stops = g.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ');
  if (g.type === 'radial') return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

/** Build a CSS box-shadow string from a BrandGuidelineShadow */
export function shadowToCSS(s: BrandGuidelineShadow): string {
  if (s.css) return s.css;
  const inset = s.type === 'inner' ? 'inset ' : '';
  const c = s.color.startsWith('#') ? hexToRgba(s.color, s.opacity) : s.color;
  return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${c}`;
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function buildMockTokens(g: BrandGuideline | null | undefined): MockTokens {
  const theme = extractBrandTheme(g, 'brand');
  const colors = g?.colors || [];

  const findRole = (...roles: string[]) =>
    colors.find((c) =>
      roles.some((r) => c.role?.toUpperCase() === r || c.name?.toUpperCase() === r)
    );
  const findMatch = (...keywords: string[]) =>
    colors.find((c) =>
      keywords.some((k) => c.name?.toLowerCase().includes(k) || c.role?.toLowerCase().includes(k))
    );

  const primary = findRole('PRIMARY') || findMatch('primary', 'main') || colors[0];
  const secondary = findRole('SECONDARY') || findMatch('secondary') || colors[1];
  const accent = findRole('ACCENT') || findMatch('accent', 'highlight') || colors[2] || primary;

  // Data drift: the API/DB serializes typography as { fontFamily, name } while the TS
  // type says { family, role }. Read both so the real brand font resolves instead of
  // silently falling back to Inter (which made previews render off-brand).
  const fontField = (t: unknown): string | undefined =>
    (t as { family?: string; fontFamily?: string })?.family ||
    (t as { fontFamily?: string })?.fontFamily;
  const fontKey = (t: unknown): string =>
    `${(t as { role?: string; name?: string })?.role || (t as { name?: string })?.name || ''}`;
  const findFontByRole = (...roles: string[]) =>
    g?.typography?.find((t) => roles.some((r) => fontKey(t).toLowerCase().includes(r.toLowerCase())));
  const heading =
    findFontByRole('heading', 'display', 'title', 'primary', 'h1', 'h2') || g?.typography?.[0];
  const body =
    findFontByRole('body', 'text', 'paragraph', 'secondary', 'caption') ||
    g?.typography?.[1] ||
    heading;

  const findLogo = (variant: string) => g?.logos?.find((l) => l.variant === variant);
  const primaryLogo = findLogo('primary') || g?.logos?.[0];

  const rawManifesto = g?.strategy?.manifesto;
  const manifestoText =
    typeof rawManifesto === 'string'
      ? rawManifesto
      : rawManifesto?.full ||
        [rawManifesto?.provocation, rawManifesto?.tension, rawManifesto?.promise]
          .filter(Boolean)
          .join('\n') ||
        '';
  const manifestoFirstLine = manifestoText?.split('\n').filter(Boolean)[0];

  // Punchy single-word keywords from brand values/aesthetic tags (dedup, cased),
  // falling back to distinct tagline words — used by editorial/manifesto layouts.
  const rawTags = ((g as { tags?: { brand_values?: string[]; aesthetic?: string[] } })?.tags ||
    {}) as { brand_values?: string[]; aesthetic?: string[] };
  const kwPool = [...(rawTags.brand_values || []), ...(rawTags.aesthetic || [])]
    .map((s) => `${s}`.trim())
    .filter((s) => s.length > 2 && s.split(/\s+/).length === 1);
  const taglineWords = (g?.identity?.tagline || g?.tagline || '')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const seenKw = new Set<string>();
  const keywords = [...kwPool, ...taglineWords]
    .filter((w) => {
      const lc = w.toLowerCase();
      if (seenKw.has(lc)) return false;
      seenKw.add(lc);
      return true;
    })
    .slice(0, 4);

  const fontStack = (family?: string, fb = FALLBACK.heading) =>
    family ? `'${family}', ${fb}` : fb;

  return {
    theme,
    name: g?.identity?.name || g?.name || 'Brand',
    tagline: g?.identity?.tagline || g?.tagline,
    description: g?.identity?.description || g?.description,
    manifestoFirstLine,
    manifesto: manifestoText || undefined,
    keywords,
    primaryLogo: primaryLogo ? { url: primaryLogo.url, variant: primaryLogo.variant } : undefined,
    lightLogo: findLogo('light'),
    darkLogo: findLogo('dark'),
    iconLogo: findLogo('icon'),
    headingFamily: fontStack(fontField(heading), FALLBACK.heading),
    bodyFamily: fontStack(fontField(body), FALLBACK.body),
    primaryColor: primary?.hex || theme.accent || FALLBACK.primary,
    secondaryColor: secondary?.hex || theme.text || FALLBACK.secondary,
    accentColor: accent?.hex || theme.accent || FALLBACK.accent,
    palette: colors.map((c) => ({ hex: c.hex, name: c.name, role: c.role })),
    gradients: g?.gradients || [],
    shadows: g?.shadows || [],
    borders: g?.borders || [],
    motion: g?.motion,
    colorThemes: g?.colorThemes || [],
    mediaByCategory: categorizeMedia(g?.media),
  };
}

/**
 * Unified role theme — mirrors `server/lib/figma-variable-compiler.ts`
 * `compileFigmaVariables` EXACTLY, so the DOM mocks resolve the same colors as the
 * Figma `Brand` variable seed. accent = first of accent/cta/primary; accent-text is
 * WCAG-readable on accent; the rest map by role with light/dark fallbacks so no field
 * is ever undefined (the Figma compiler simply omits missing ones).
 */
export interface RoleTheme {
  accent: string;
  accentText: string;
  primary: string;
  secondary: string;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
}

function luminanceHex(hex: string): number {
  const h = hex.replace('#', '').padEnd(6, '0');
  const ch = [0, 2, 4]
    .map((i) => parseInt(h.substring(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** #000 or #fff, whichever reads better on `hex` — same rule as the Figma compiler. */
export function readableOn(hex: string): string {
  return (luminanceHex(hex) + 0.05) / 0.05 >= 4.5 ? '#000000' : '#ffffff';
}

/** The canonical role-based theme (mirrors `compileFigmaVariables` / Figma seed). */
function baseRoleTheme(tokens: MockTokens): RoleTheme {
  const palette = tokens.palette;
  const byRole = (...kw: string[]): string | undefined =>
    palette.find((c) => kw.some((k) => `${c.role || ''}`.toLowerCase().includes(k)))?.hex;
  const first = palette[0]?.hex;

  const accent = byRole('accent', 'cta', 'primary') || first || FALLBACK.accent;
  const bg = byRole('background', 'bg') || '#F5F3EE';
  const text = byRole('text', 'foreground') || readableOn(bg);
  return {
    accent,
    accentText: readableOn(accent),
    primary: byRole('primary') || accent,
    secondary: byRole('secondary') || byRole('primary') || accent,
    bg,
    surface: byRole('surface', 'background', 'bg') || bg,
    text,
    textMuted: byRole('muted', 'secondary') || text,
  };
}

/**
 * Algorithmic color COMBINATIONS derived from the brand palette — the "trocar cores por
 * combinação" lever. Each is a valid, contrast-safe re-assignment of the same brand
 * colors (never invented). Cycle with the `variant` index. All keep accent-text WCAG-readable.
 */
export function buildThemeCombos(tokens: MockTokens): RoleTheme[] {
  const base = baseRoleTheme(tokens);

  // Dark: swap bg/text (brand's own text color becomes the canvas).
  const dark: RoleTheme = {
    ...base,
    bg: base.text,
    surface: base.text,
    text: base.bg,
    textMuted: base.bg,
    accentText: readableOn(base.accent),
  };

  // Accent-forward: the accent becomes the canvas — a bold, saturated combo.
  const accentBg: RoleTheme = {
    ...base,
    bg: base.accent,
    surface: base.accent,
    text: base.accentText,
    textMuted: base.accentText,
    accent: base.primary,
    accentText: readableOn(base.primary),
    primary: base.text,
  };

  // Primary/secondary swap on a soft surface — same palette, different emphasis.
  const swapped: RoleTheme = {
    ...base,
    accent: base.secondary,
    accentText: readableOn(base.secondary),
    primary: base.accent,
  };

  // De-dup combos that collapse to the same look (e.g. accent === primary).
  const seen = new Set<string>();
  return [base, dark, accentBg, swapped].filter((t) => {
    const key = `${t.bg}|${t.text}|${t.accent}|${t.primary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildRoleTheme(tokens: MockTokens, variant = 0): RoleTheme {
  const combos = buildThemeCombos(tokens);
  const i = ((variant % combos.length) + combos.length) % combos.length;
  return combos[i];
}

function categorizeMedia(media: BrandGuideline['media']): MockTokens['mediaByCategory'] {
  const result = {
    background: [] as string[],
    graphic: [] as string[],
    stock: [] as string[],
    product: [] as string[],
  };
  for (const m of media || []) {
    if (m.type !== 'image') continue;
    const cat = m.category;
    if (cat && cat in result) (result as Record<string, string[]>)[cat].push(m.url);
  }
  return result;
}
