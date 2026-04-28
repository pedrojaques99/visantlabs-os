import { useState, useCallback } from 'react';
import type { FigStreamState } from './useExtractFigStream';
import { buildBrandIngestPayload } from './queries/useBrandImport';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';

/**
 * Map a dryRun BrandGuideline preview into FigStreamState so BrandIngestModal
 * can render it identically to a .fig stream. Pass-through only — no defaults,
 * no schema reshaping. The server-side normalizer is the single source of truth
 * for canonicalising shapes on apply.
 */
function toFigState(preview: BrandGuideline, images?: string[]): FigStreamState {
  const p = preview as any;
  const radii: number[] = p.tokens?.radius
    ? Object.values(p.tokens.radius as Record<string, number>)
    : [];
  return {
    status: 'done',
    statusMessage: 'Complete',
    colors:     p.colors,
    typography: p.typography,
    gradients:  p.gradients,
    shadows:    p.shadows,
    borders:    p.borders,
    radii,
    components: [],
    images:     images || [],
    strategy: {
      manifesto:   p.strategy?.manifesto,
      tagline:     p.identity?.tagline,
      description: p.identity?.description,
      // strategy.positioning is the canonical field for claims/statements;
      // fall back to guidelines.dos only if positioning is empty
      claims:      p.strategy?.positioning?.length ? p.strategy.positioning : p.guidelines?.dos,
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
