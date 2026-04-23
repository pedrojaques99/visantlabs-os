import type { ColorEntry, LogoSlot, TypographySlot, DesignTokens } from '../store/types';

/**
 * Pure transform: server-shape BrandGuideline → store slice.
 *
 * Maps each domain (colors, logos, typography, tokens) into the shape the
 * brand sections already render from. No side effects — safe to unit-test.
 */
export interface HydratedBrand {
  selectedColors: Map<string, ColorEntry>;
  logos: LogoSlot[];
  typography: TypographySlot[];
  designTokens: DesignTokens;
  linkedGuideline: string | null;
  brandGuideline: any;
}

const LOGO_SLOTS = ['light', 'dark', 'accent'] as const;
const TYPE_SLOTS = ['primary', 'secondary'] as const;

// Common role aliases returned by the server / extraction pipelines
const TYPE_ROLE_ALIASES: Record<string, 'primary' | 'secondary'> = {
  primary: 'primary',
  heading: 'primary',
  headings: 'primary',
  title: 'primary',
  display: 'primary',
  h1: 'primary',
  secondary: 'secondary',
  body: 'secondary',
  text: 'secondary',
  paragraph: 'secondary',
  subtitle: 'secondary'
};

const LOGO_VARIANT_ALIASES: Record<string, 'light' | 'dark' | 'accent'> = {
  light: 'light',
  white: 'light',
  'on-dark': 'light',
  dark: 'dark',
  black: 'dark',
  'on-light': 'dark',
  accent: 'accent',
  color: 'accent',
  colored: 'accent',
  primary: 'accent'
};

function toColorsMap(raw: any): Map<string, ColorEntry> {
  const map = new Map<string, ColorEntry>();
  if (!Array.isArray(raw)) return map;
  raw.forEach((c: any, i: number) => {
    if (!c?.hex) return;
    const role = c.role || c.name || `color-${i}`;
    map.set(role, { role, hex: c.hex, name: c.name });
  });
  return map;
}

function resolveLogoSlot(l: any): 'light' | 'dark' | 'accent' | null {
  const key = (l?.variant || l?.label || l?.role || '').toString().toLowerCase().trim();
  return LOGO_VARIANT_ALIASES[key] ?? null;
}

function toLogoSlots(raw: any): LogoSlot[] {
  const list: any[] = Array.isArray(raw) ? raw : [];
  const bySlot = new Map<'light' | 'dark' | 'accent', any>();
  // First pass: explicit matches via alias table
  list.forEach((l) => {
    const slot = resolveLogoSlot(l);
    if (slot && !bySlot.has(slot)) bySlot.set(slot, l);
  });
  // Second pass: positional fallback for unclaimed slots
  const leftover = list.filter((l) => !resolveLogoSlot(l));
  LOGO_SLOTS.forEach((slot, i) => {
    if (!bySlot.has(slot) && leftover[i]) bySlot.set(slot, leftover[i]);
  });
  return LOGO_SLOTS.map((slot) => {
    const m = bySlot.get(slot);
    if (!m) return { name: slot, loaded: false };
    const src = m.thumbnailUrl || m.url;
    return {
      name: slot,
      src,
      loaded: !!src,
      id: m.id,
      source: m.source,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      format: m.format,
      figmaKey: m.figmaKey,
      figmaFileKey: m.figmaFileKey,
      figmaNodeId: m.figmaNodeId,
      label: m.label
    };
  });
}

function resolveTypeSlot(t: any): 'primary' | 'secondary' | null {
  const key = (t?.role || t?.name || t?.label || '').toString().toLowerCase().trim();
  return TYPE_ROLE_ALIASES[key] ?? null;
}

function toTypographySlots(raw: any): TypographySlot[] {
  const list: any[] = Array.isArray(raw) ? raw : [];
  const bySlot = new Map<'primary' | 'secondary', any>();
  list.forEach((t) => {
    const slot = resolveTypeSlot(t);
    if (slot && !bySlot.has(slot)) bySlot.set(slot, t);
  });
  // Positional fallback: first unclaimed entry → primary, next → secondary
  const leftover = list.filter((t) => !resolveTypeSlot(t));
  TYPE_SLOTS.forEach((slot, i) => {
    if (!bySlot.has(slot) && leftover[i]) bySlot.set(slot, leftover[i]);
  });
  return TYPE_SLOTS.map((slot) => {
    const m = bySlot.get(slot);
    return {
      name: slot,
      fontFamily: m?.family || m?.fontFamily,
      fontStyle: m?.style || m?.fontStyle,
      fontSize: m?.size ?? m?.fontSize,
      lineHeight: m?.lineHeight,
      fontWeight: m?.weight ?? m?.fontWeight
    };
  });
}

/**
 * Extract all distinct font families from a guideline so the datalist in
 * BrandTypographySection can suggest them even when `tokens.families` is empty.
 */
function collectFontFamilies(guideline: any): string[] {
  const out = new Set<string>();
  const typo: any[] = Array.isArray(guideline?.typography) ? guideline.typography : [];
  typo.forEach((t) => {
    const fam = t?.family || t?.fontFamily || t?.name;
    if (fam && typeof fam === 'string') out.add(fam);
  });
  const existing = guideline?.tokens?.families;
  if (Array.isArray(existing)) existing.forEach((f: any) => { if (f) out.add(String(f)); });
  return Array.from(out);
}

export function hydrateBrandGuideline(guideline: any): HydratedBrand {
  const families = collectFontFamilies(guideline);
  const tokens: DesignTokens = {
    ...((guideline?.tokens as DesignTokens) || {}),
    families
  };
  return {
    brandGuideline: guideline,
    linkedGuideline: guideline?.id ?? guideline?._id ?? null,
    selectedColors: toColorsMap(guideline?.colors),
    logos: toLogoSlots(guideline?.logos),
    typography: toTypographySlots(guideline?.typography),
    designTokens: tokens
  };
}

export function getGuidelineLabel(g: any): string {
  return g?.identity?.name || g?.name || 'Untitled guideline';
}

export function getGuidelineId(g: any): string | undefined {
  return g?.id ?? g?._id;
}
