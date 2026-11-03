/**
 * Brand as input: maps a guideline onto the document. Ink and paper need contrast
 * to read at all, so when the roles do not provide it the pair is chosen by luminance.
 */
import type { BrandGuideline } from '@/lib/figma-types';
import { luminance } from './paper';
import type { InkDoc } from './types';

const MIN_CONTRAST = 3;

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function normalizeHex(hex: string | undefined): string | null {
  if (!hex) return null;
  const value = hex.startsWith('#') ? hex : `#${hex}`;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${[...value.slice(1)].map((c) => c + c).join('')}`.toLowerCase();
  }
  return null;
}

export function pickBrandColors(
  colors: { hex?: string; role?: string }[] | undefined
): { ink: string; paper: string } | null {
  const valid = (colors ?? []).flatMap((c) => {
    const hex = normalizeHex(c.hex);
    return hex ? [{ hex, role: (c.role ?? '').toLowerCase() }] : [];
  });
  if (!valid.length) return null;

  const byLuminance = [...valid].sort((a, b) => luminance(a.hex) - luminance(b.hex));
  const lightest = byLuminance[byLuminance.length - 1].hex;
  const darkest = byLuminance[0].hex;

  const withRole = (role: string) => valid.find((c) => c.role === role)?.hex;
  const background = withRole('background') ?? withRole('light');

  // Paper stays light unless the brand is dark-only: this is an ink-on-paper effect.
  const paper = background ?? (luminance(lightest) > 0.5 ? lightest : '#f4f1ea');
  // The role that means "ink" first, then the rest of the palette. Many brands have no
  // primary, and their first color is the background itself.
  const candidates = [
    withRole('primary'),
    withRole('text'),
    withRole('accent'),
    ...valid.map((c) => c.hex),
    darkest,
    lightest,
  ];
  const ink = candidates.find((hex) => hex && contrast(hex, paper) >= MIN_CONTRAST);
  return { ink: ink ?? (luminance(paper) > 0.18 ? '#171719' : '#f2f2ee'), paper };
}

export function brandHeadingFont(brand: BrandGuideline): string | null {
  const type = brand.typography ?? [];
  const heading = type.find((t) => t.role === 'heading' || t.role === 'display');
  return heading?.family ?? type[0]?.family ?? null;
}

export function brandName(brand: BrandGuideline): string | null {
  return brand.identity?.name || brand.name || null;
}

export function brandLogoUrl(brand: BrandGuideline): string | null {
  const logos = brand.logos ?? [];
  const logo =
    logos.find((l) => l.variant === 'primary') ??
    logos.find((l) => l.variant === 'icon') ??
    logos[0];
  return logo?.url ?? null;
}

/** Keeps the current texture of the ink: the brand sets identity, the style sets the print. */
export function applyBrandToDoc(doc: InkDoc, brand: BrandGuideline): InkDoc {
  const colors = pickBrandColors(brand.colors);
  const font = brandHeadingFont(brand);
  const name = brandName(brand);
  return {
    ...doc,
    presetId: null,
    brandLocked: true,
    ink: colors ? { ...doc.ink, inkColor: colors.ink } : doc.ink,
    paper:
      colors && doc.paper.paperType !== 'transparent'
        ? { ...doc.paper, baseColor: colors.paper }
        : doc.paper,
    typography: {
      ...doc.typography,
      fontFamily: font ?? doc.typography.fontFamily,
      text: name ?? doc.typography.text,
      uppercase: name ? false : doc.typography.uppercase,
    },
  };
}
