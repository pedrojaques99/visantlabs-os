import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';

// ── Tool-specific default mappings ─────────────────────────────────────────

export interface CompressDefaults {
  quality: number;
  outputFormat: 'jpeg' | 'png' | 'webp';
}

export interface WatermarkDefaults {
  logoUrl: string | null;
  textColor: string;
}

export interface FaviconDefaults {
  logoUrl: string | null;
}

export interface OgImageDefaults {
  bgColor: string;
  textColor: string;
  fontFamily: string | null;
  logoUrl: string | null;
}

export type ToolDefaults = {
  compress: CompressDefaults;
  watermark: WatermarkDefaults;
  favicon: FaviconDefaults;
  'og-image': OgImageDefaults;
};

function getPrimaryLogo(brand: BrandGuideline): string | null {
  if (!brand.logos?.length) return null;
  const primary = brand.logos.find((l) => l.variant === 'primary');
  const icon = brand.logos.find((l) => l.variant === 'icon');
  return primary?.url ?? icon?.url ?? brand.logos[0]?.url ?? null;
}

function getPrimaryColor(brand: BrandGuideline): string {
  if (!brand.colors?.length) return '#000000';
  const primary = brand.colors.find((c) => c.role === 'primary');
  return primary?.hex ?? brand.colors[0]?.hex ?? '#000000';
}

function getContrastColor(brand: BrandGuideline): string {
  if (!brand.colors?.length) return '#ffffff';
  const light = brand.colors.find((c) => c.role === 'background' || c.role === 'light');
  return light?.hex ?? '#ffffff';
}

function getHeadingFont(brand: BrandGuideline): string | null {
  if (!brand.typography?.length) return null;
  const heading = brand.typography.find((t) => t.role === 'heading' || t.role === 'display');
  return heading?.family ?? brand.typography[0]?.family ?? null;
}

function deriveDefaults<T extends keyof ToolDefaults>(
  toolId: T,
  brand: BrandGuideline
): ToolDefaults[T] {
  switch (toolId) {
    case 'compress':
      return {
        quality: 85,
        outputFormat: 'webp',
      } as ToolDefaults[T];

    case 'watermark':
      return {
        logoUrl: getPrimaryLogo(brand),
        textColor: getPrimaryColor(brand),
      } as ToolDefaults[T];

    case 'favicon':
      return {
        logoUrl: getPrimaryLogo(brand),
      } as ToolDefaults[T];

    case 'og-image':
      return {
        bgColor: getPrimaryColor(brand),
        textColor: getContrastColor(brand),
        fontFamily: getHeadingFont(brand),
        logoUrl: getPrimaryLogo(brand),
      } as ToolDefaults[T];

    default:
      return {} as ToolDefaults[T];
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

interface UseBrandDefaultsReturn<T extends keyof ToolDefaults> {
  brandId: string | null;
  setBrandId: (id: string | null) => void;
  brand: BrandGuideline | null;
  defaults: ToolDefaults[T] | null;
  isLoading: boolean;
}

export function useBrandDefaults<T extends keyof ToolDefaults>(
  toolId: T
): UseBrandDefaultsReturn<T> {
  const [brandId, setBrandId] = useState<string | null>(null);

  const { data: brand = null, isLoading } = useQuery({
    queryKey: ['brand-guidelines', brandId],
    queryFn: () => brandGuidelineApi.getById(brandId!),
    enabled: !!brandId,
  });

  const defaults = useMemo(() => (brand ? deriveDefaults(toolId, brand) : null), [toolId, brand]);

  const handleSetBrandId = useCallback((id: string | null) => {
    setBrandId(id);
  }, []);

  return {
    brandId,
    setBrandId: handleSetBrandId,
    brand,
    defaults,
    isLoading,
  };
}
