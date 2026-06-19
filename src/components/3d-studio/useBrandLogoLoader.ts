/**
 * useBrandLogoLoader — drops a brand's logo into the 3D model.
 *
 * Shared by any panel that wants to pull a brand asset into the studio. SVGs go
 * straight in (vector, no tracing); raster logos (PNG/JPG) are traced to SVG via
 * the same pipeline as a manual upload. `pickPrimaryLogo` chooses the best asset:
 * SVG first (sharpest extrusion), primary variant preferred, else the first one.
 */
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { BrandGuideline } from '@/lib/figma-types';

type BrandLogo = NonNullable<BrandGuideline['logos']>[number];

function isSvgUrl(url?: string): boolean {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.svg');
}

/** Best logo to extrude: SVG first (no tracing needed), primary variant preferred. */
export function pickPrimaryLogo(g?: BrandGuideline | null): BrandLogo | null {
  const logos = g?.logos ?? [];
  if (!logos.length) return null;
  const svgs = logos.filter((l) => isSvgUrl(l.url));
  const pool = svgs.length ? svgs : logos;
  return pool.find((l) => l.variant === 'primary') ?? pool[0];
}

export function useBrandLogoLoader() {
  const { t } = useTranslation();

  const loadBrandLogo = useCallback(
    async (logoUrl: string, fileName: string, guidelineId?: string) => {
      const store = useStudio3DStore.getState();
      if (guidelineId) store.setBrandGuidelineId(guidelineId);
      store.setIsLoading(true);
      try {
        const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(logoUrl)}`;
        const res = await fetch(proxyUrl);
        const { base64, mimeType } = (await res.json()) as { base64: string; mimeType: string };

        if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
          store.setSvgData(atob(base64), fileName);
          store.setInputMode('svg');
        } else {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const file = new File([bytes], fileName, { type: mimeType });
          const { tracePng } = await import('@/services/svgPipeline');
          const s = useStudio3DStore.getState();
          const svg = await tracePng(file, {
            turdSize: s.traceTurdSize,
            optTolerance: s.traceOptTolerance,
            threshold: s.traceThreshold,
            alphaMax: s.traceAlphaMax,
            preset: s.tracePreset,
          });
          store.setSvgData(svg, fileName);
          store.setInputMode('svg');
        }
        toast.success(t('studio3d.input.loaded', { fileName }));
      } catch (err) {
        console.error('Failed to load brand logo:', err);
        toast.error(t('studio3d.input.processFailed'));
      } finally {
        useStudio3DStore.getState().setIsLoading(false);
      }
    },
    [t]
  );

  /** Load a brand's primary logo automatically. Returns false if it has no logos. */
  const loadPrimaryBrandLogo = useCallback(
    (g?: BrandGuideline | null): boolean => {
      const logo = pickPrimaryLogo(g);
      if (!logo?.url) return false;
      const ext = logo.url.split('.').pop()?.split('?')[0] || 'svg';
      const name = logo.label || `${g?.identity?.name || 'brand'}-${logo.variant}.${ext}`;
      void loadBrandLogo(logo.url, name, g?.id);
      return true;
    },
    [loadBrandLogo]
  );

  return { loadBrandLogo, loadPrimaryBrandLogo };
}
