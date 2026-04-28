import { useState, useCallback } from 'react';
import type { FigStreamState } from './useExtractFigStream';
import { buildBrandIngestPayload } from './queries/useBrandImport';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';

/**
 * Normalise a dryRun BrandGuideline preview into FigStreamState so that
 * BrandIngestModal can render it exactly like a .fig stream — one UI, any source.
 */
function toFigState(preview: BrandGuideline, images?: string[]): FigStreamState {
  const p = preview as any;
  const radii: number[] = p.tokens?.radius
    ? Object.values(p.tokens.radius as Record<string, number>)
    : [];
  return {
    status: 'done',
    statusMessage: 'Complete',
    colors: p.colors,
    typography: p.typography,
    gradients: p.gradients?.map((g: any) => ({
      name: g.name || 'Gradient',
      css: g.css,
      stops: g.stops || [],
    })),
    shadows: p.shadows?.map((s: any) => ({ name: s.name || 'Shadow', css: s.css })),
    borders: p.borders?.map((b: any) => ({
      name: b.name || 'Border',
      width: b.width,
      color: b.color,
      style: (b.style as 'solid') || 'solid',
    })),
    radii,
    components: [],
    images: images || [],
    strategy: {
      manifesto: p.strategy?.manifesto,
      tagline: p.identity?.tagline,
      description: p.identity?.description,
      claims: p.guidelines?.dos,
    },
  };
}

/**
 * Drop-in companion to useExtractFigStream for non-.fig sources (PDF, images).
 * Calls /ingest with dryRun:true, converts the preview to FigStreamState, and
 * lets BrandIngestModal handle approval + apply — no code duplication.
 */
export function useIngestAsStream(guidelineId: string) {
  const [state, setState] = useState<FigStreamState>({ status: 'idle', statusMessage: '' });

  const ingest = useCallback(async (files: File[]) => {
    setState({ status: 'streaming', statusMessage: 'Extracting…' });
    try {
      const payload = await buildBrandIngestPayload(files);
      if (!payload) {
        setState({ status: 'error', statusMessage: '', error: 'No supported files (PDF or images)' });
        return;
      }

      const result = await brandGuidelineApi.ingest(guidelineId, { ...payload, dryRun: true });

      if (!result.preview) {
        setState({ status: 'error', statusMessage: '', error: 'Server returned no preview' });
        return;
      }

      // Input images become selectable Assets in the modal;
      // for PDFs the server may return embedded images via extracted.images.
      const images: string[] = payload.images ?? result.extracted?.images ?? [];
      setState(toFigState(result.preview, images));
    } catch (err: any) {
      setState({ status: 'error', statusMessage: '', error: err?.message || 'Extraction failed' });
    }
  }, [guidelineId]);

  const reset = useCallback(() => setState({ status: 'idle', statusMessage: '' }), []);

  return { state, ingest, reset };
}
