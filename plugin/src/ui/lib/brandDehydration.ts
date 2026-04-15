import type { ColorEntry, LogoSlot, TypographySlot, DesignTokens } from '../store/types';

/**
 * Inverse of brandHydration: store slices → server-shape patch.
 *
 * Mirrors the BrandGuidelineSchema so the resulting patch passes validation
 * on both PUT /api/brand-guidelines/:id and the shared zod contract.
 */

export interface DehydrateInput {
  selectedColors?: Map<string, ColorEntry>;
  logos?: LogoSlot[];
  typography?: TypographySlot[];
  designTokens?: DesignTokens;
}

export interface DehydratedPatch {
  colors?: Array<{ hex: string; name?: string; role?: string }>;
  logos?: Array<{
    id?: string;
    url?: string;
    variant: string;
    label?: string;
    source?: 'upload' | 'figma';
    thumbnailUrl?: string;
    format?: string;
    figmaKey?: string;
    figmaFileKey?: string;
    figmaNodeId?: string;
  }>;
  typography?: Array<{
    family?: string;
    role: string;
    style?: string;
    size?: number;
    weight?: number;
    lineHeight?: number;
  }>;
  tokens?: DesignTokens;
}

export function dehydrateBrand(input: DehydrateInput): DehydratedPatch {
  const patch: DehydratedPatch = {};

  if (input.selectedColors) {
    patch.colors = Array.from(input.selectedColors.values())
      .filter((c) => !!c.hex)
      .map((c) => ({ hex: c.hex, name: c.name, role: c.role }));
  }

  if (input.logos) {
    patch.logos = input.logos
      .filter((l) => !!(l.url || l.thumbnailUrl || l.src || l.figmaKey || l.figmaNodeId))
      .map((l) => ({
        id: l.id,
        url: l.url ?? l.src,
        variant: l.name,
        label: l.label ?? l.name,
        source: l.source,
        thumbnailUrl: l.thumbnailUrl,
        format: l.format,
        figmaKey: l.figmaKey,
        figmaFileKey: l.figmaFileKey,
        figmaNodeId: l.figmaNodeId
      }));
  }

  if (input.typography) {
    patch.typography = input.typography
      .filter((t) => !!t.fontFamily)
      .map((t) => ({
        family: t.fontFamily,
        role: t.name,
        style: t.fontStyle,
        size: t.fontSize,
        weight: t.fontWeight,
        lineHeight: t.lineHeight
      }));
  }

  if (input.designTokens && Object.keys(input.designTokens).length > 0) {
    // Strip `families` — it's a derived hydration artifact, not canonical.
    const { families, ...canonical } = input.designTokens as any;
    if (Object.keys(canonical).length > 0) patch.tokens = canonical;
  }

  return patch;
}
