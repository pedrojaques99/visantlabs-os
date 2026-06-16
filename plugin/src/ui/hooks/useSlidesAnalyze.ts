import { useCallback, useRef, useState } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';
import { useApi } from './useApi';
import { hydrateBrandGuideline } from '../lib/brandHydration';
import type { SlidesAnalysisResult } from '../../handlers/slidesAnalyze';

export interface SlidesPreview {
  extracted: any; // raw ExtractedBrandData from server
  totalFrames: number;
  pages: number;
}

/**
 * Two-phase slides → brand flow:
 *  Phase 1 (scan):  sandbox exports frames → POST /ingest dryRun:true → preview
 *  Phase 2 (apply): user approves → POST /ingest (real, same images) → re-hydrate
 *
 * Images are cached in a ref so the sandbox only runs once.
 * Gemini runs twice — once for preview, once to save. Acceptable for a one-time manual import.
 */
export function useSlidesAnalyze() {
  const [isScanning, setIsScanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [preview, setPreview] = useState<SlidesPreview | null>(null);

  const imagesRef = useRef<string[]>([]);
  const textRef = useRef<string>('');

  const { send } = useFigmaMessages();
  const { call } = useApi();
  const showToast = usePluginStore((s) => s.showToast);

  const scan = useCallback(async () => {
    const { linkedGuideline } = usePluginStore.getState();
    if (!linkedGuideline) {
      showToast('Carregue uma brand guideline primeiro', 'warning');
      return;
    }

    setIsScanning(true);
    setPreview(null);
    setProgress('Exportando slides…');

    try {
      // Phase 1a: sandbox scans all pages and exports frames
      const result = await new Promise<SlidesAnalysisResult | null>((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handler);
          resolve(null);
        }, 120000);
        function handler(event: MessageEvent) {
          const msg = event.data?.pluginMessage;
          if (msg?.type === 'SLIDES_ANALYSIS_RESULT') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(msg.result ?? null);
          }
        }
        window.addEventListener('message', handler);
        send({ type: 'SCAN_SLIDES_FOR_BRAND', maxWidth: 800 } as any);
      });

      if (!result || result.pages.length === 0) {
        showToast('Nenhum slide encontrado neste documento', 'warning');
        return;
      }

      const allImages = result.pages.flatMap((p) => p.frames.map((f) => f.png)).slice(0, 100);
      const allText = result.pages
        .filter((p) => p.text.trim())
        .map((p) => `## ${p.pageName}\n\n${p.text}`)
        .join('\n\n---\n\n');

      imagesRef.current = allImages;
      textRef.current = allText;

      // Phase 1b: dry run — Gemini analyzes images, server returns preview without saving
      setProgress(`Analisando ${result.totalFrames} slides com IA…`);

      const dryResult = await call(`/api/brand-guidelines/${linkedGuideline}/ingest`, {
        method: 'POST',
        body: JSON.stringify({
          source: 'images',
          images: allImages,
          filename: 'slides-export.png',
          dryRun: true,
        }),
      });

      if (!dryResult?.extracted) {
        showToast('IA não encontrou dados de marca nos slides', 'warning');
        return;
      }

      setPreview({
        extracted: dryResult.extracted,
        totalFrames: result.totalFrames,
        pages: result.pages.length,
      });
    } catch (err: any) {
      showToast(err.message || 'Falha ao analisar slides', 'error');
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, [send, call, showToast]);

  const apply = useCallback(async () => {
    const { linkedGuideline } = usePluginStore.getState();
    if (!linkedGuideline || !imagesRef.current.length) return;

    setIsApplying(true);
    try {
      // Real ingest — same images, Gemini re-runs and saves the result
      await call(`/api/brand-guidelines/${linkedGuideline}/ingest`, {
        method: 'POST',
        body: JSON.stringify({
          source: 'images',
          images: imagesRef.current,
          filename: 'slides-export.png',
        }),
      });

      // Text ingest for strategy depth
      if (textRef.current.trim()) {
        await call(`/api/brand-guidelines/${linkedGuideline}/ingest`, {
          method: 'POST',
          body: JSON.stringify({
            source: 'text',
            data: textRef.current,
            filename: 'slides-text.md',
          }),
        });
      }

      // Re-fetch and hydrate store
      const fresh = await call(`/api/brand-guidelines/${linkedGuideline}`, { method: 'GET' });
      if (fresh?.guideline) {
        const slice = hydrateBrandGuideline(fresh.guideline);
        const prev = usePluginStore.getState().brandHydrationTick || 0;
        usePluginStore.setState({
          ...(slice as any),
          brandHydrationTick: prev + 1,
          brandHydrationAtMs: Date.now(),
        });
      }

      showToast('Brand populado com sucesso!', 'success');
      setPreview(null);
      imagesRef.current = [];
      textRef.current = '';
    } catch (err: any) {
      showToast(err.message || 'Falha ao aplicar', 'error');
    } finally {
      setIsApplying(false);
    }
  }, [call, showToast]);

  const dismiss = useCallback(() => {
    setPreview(null);
    imagesRef.current = [];
    textRef.current = '';
  }, []);

  return { scan, apply, dismiss, isScanning, isApplying, progress, preview };
}
