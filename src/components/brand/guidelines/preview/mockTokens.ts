import type { BrandGuideline, BrandGuidelineGradient, BrandGuidelineShadow, BrandGuidelineBorder, BrandGuidelineMotion, BrandColorTheme } from '@/lib/figma-types';
import { extractBrandTheme, type BrandTheme } from '@/components/brand/BrandReadOnlyView';

export interface MockTokens {
  theme: BrandTheme;
  name: string;
  tagline?: string;
  description?: string;
  manifestoFirstLine?: string;
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
    .map(s => `${s.color} ${s.position}%`)
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
    colors.find(c => roles.some(r => c.role?.toUpperCase() === r || c.name?.toUpperCase() === r));
  const findMatch = (...keywords: string[]) =>
    colors.find(c => keywords.some(k => c.name?.toLowerCase().includes(k) || c.role?.toLowerCase().includes(k)));

  const primary = findRole('PRIMARY') || findMatch('primary', 'main') || colors[0];
  const secondary = findRole('SECONDARY') || findMatch('secondary') || colors[1];
  const accent = findRole('ACCENT') || findMatch('accent', 'highlight') || colors[2] || primary;

  const findFontByRole = (...roles: string[]) =>
    g?.typography?.find(t =>
      roles.some(r => t.role?.toLowerCase().includes(r.toLowerCase()))
    );
  const heading = findFontByRole('heading', 'display', 'title', 'primary', 'h1', 'h2') || g?.typography?.[0];
  const body = findFontByRole('body', 'text', 'paragraph', 'secondary', 'caption') || g?.typography?.[1] || heading;


  const findLogo = (variant: string) => g?.logos?.find(l => l.variant === variant);
  const primaryLogo = findLogo('primary') || g?.logos?.[0];

  const rawManifesto = g?.strategy?.manifesto;
  const manifestoText = typeof rawManifesto === 'string' ? rawManifesto : (rawManifesto?.full || [rawManifesto?.provocation, rawManifesto?.tension, rawManifesto?.promise].filter(Boolean).join('\n') || '');
  const manifestoFirstLine = manifestoText?.split('\n').filter(Boolean)[0];

  const fontStack = (family?: string, fb = FALLBACK.heading) =>
    family ? `'${family}', ${fb}` : fb;

  return {
    theme,
    name: g?.identity?.name || g?.name || 'Brand',
    tagline: g?.identity?.tagline || g?.tagline,
    description: g?.identity?.description || g?.description,
    manifestoFirstLine,
    primaryLogo: primaryLogo ? { url: primaryLogo.url, variant: primaryLogo.variant } : undefined,
    lightLogo: findLogo('light'),
    darkLogo: findLogo('dark'),
    iconLogo: findLogo('icon'),
    headingFamily: fontStack(heading?.family, FALLBACK.heading),
    bodyFamily: fontStack(body?.family, FALLBACK.body),
    primaryColor: primary?.hex || theme.accent || FALLBACK.primary,
    secondaryColor: secondary?.hex || theme.text || FALLBACK.secondary,
    accentColor: accent?.hex || theme.accent || FALLBACK.accent,
    palette: colors.map(c => ({ hex: c.hex, name: c.name, role: c.role })),
    gradients: g?.gradients || [],
    shadows: g?.shadows || [],
    borders: g?.borders || [],
    motion: g?.motion,
    colorThemes: g?.colorThemes || [],
    mediaByCategory: categorizeMedia(g?.media),
  };
}

function categorizeMedia(media: BrandGuideline['media']): MockTokens['mediaByCategory'] {
  const result = { background: [] as string[], graphic: [] as string[], stock: [] as string[], product: [] as string[] };
  for (const m of media || []) {
    if (m.type !== 'image') continue;
    const cat = m.category;
    if (cat && cat in result) (result as Record<string, string[]>)[cat].push(m.url);
  }
  return result;
}
