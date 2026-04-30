import type { BrandGuideline } from '@/lib/figma-types';
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
}

const FALLBACK = {
  heading: 'Inter, ui-sans-serif, system-ui, sans-serif',
  body: 'Inter, ui-sans-serif, system-ui, sans-serif',
  primary: '#00E5FF',
  secondary: '#888888',
  accent: '#FFFFFF',
};

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
  const heading = findFontByRole('heading', 'display', 'title') || g?.typography?.[0];
  const body = findFontByRole('body', 'text', 'paragraph') || g?.typography?.[1] || heading;

  const findLogo = (variant: string) => g?.logos?.find(l => l.variant === variant);
  const primaryLogo = findLogo('primary') || g?.logos?.[0];

  const manifesto = g?.strategy?.manifesto;
  const manifestoFirstLine = manifesto?.split('\n').filter(Boolean)[0];

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
  };
}
