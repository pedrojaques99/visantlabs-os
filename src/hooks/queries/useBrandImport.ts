import { useCallback } from 'react';
import { toast } from 'sonner';
import { useIngestGuideline, type BrandIngestPayload } from './useBrandGuidelines';
import { pdfToBase64 } from '@/utils/pdfUtils';
import { fileToBase64 } from '@/utils/fileUtils';

/**
 * Build the ingest payload from a raw File[] — handles PDF base64 + image
 * base64 conversion. Pure utility so non-hook callers (wizards doing custom
 * toast UX / create-then-ingest flows) can reuse without being forced into
 * the hook's toast + brandId contract.
 *
 * Returns null when no eligible files are present.
 */
export async function buildBrandIngestPayload(files: File[]): Promise<BrandIngestPayload | null> {
  const pdf = files.find(f => f.type === 'application/pdf');
  const images = files.filter(f => f.type.startsWith('image/'));
  if (!pdf && !images.length) return null;

  const payload: BrandIngestPayload = {
    source: pdf ? 'pdf' : 'images',
    filename: pdf?.name || `${images.length}_images`,
  };
  if (pdf) payload.data = await pdfToBase64(pdf);
  if (images.length) {
    payload.images = await Promise.all(images.map(async (f) => {
      const r = await fileToBase64(f);
      return `data:${r.mimeType};base64,${r.base64}`;
    }));
  }
  return payload;
}

/**
 * Orchestrates brand-guideline ingestion: detects file types, builds the
 * base64/URL payload, and dispatches the existing `useIngestGuideline`
 * mutation. Single source of truth for the extraction flow used by the
 * admin chat media panel, the mockup-machine wizard, and guideline detail.
 *
 * React Query cache invalidation (brand-guidelines list) is handled by the
 * underlying mutation, so callers don't need to refetch.
 */
export function useBrandImport(brandId: string | undefined) {
  const mutation = useIngestGuideline();

  const importFiles = useCallback(async (files: File[]) => {
    if (!brandId) {
      toast.error('Selecione uma marca antes de importar arquivos');
      return;
    }
    if (!files.length) return;

    try {
      const payload = await buildBrandIngestPayload(files);
      if (!payload) {
        toast.error('Apenas PDF ou imagens são aceitos');
        return;
      }
      toast.info('Extraindo marca — pode levar alguns segundos...');
      await mutation.mutateAsync({ id: brandId, payload });
    } catch (err: any) {
      toast.error(`Falha na extração: ${err?.message || 'erro'}`);
    }
  }, [brandId, mutation]);

  const importUrl = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!brandId || !trimmed) return;
    try {
      toast.info('Extraindo marca a partir da URL...');
      await mutation.mutateAsync({ id: brandId, payload: { source: 'url', url: trimmed } });
    } catch (err: any) {
      toast.error(`Falha na extração: ${err?.message || 'erro'}`);
    }
  }, [brandId, mutation]);

  /** Escape hatch for callers that already built the payload (rare). */
  const importData = useCallback(async (payload: BrandIngestPayload) => {
    if (!brandId) return;
    await mutation.mutateAsync({ id: brandId, payload });
  }, [brandId, mutation]);

  return {
    importFiles,
    importUrl,
    importData,
    isPending: mutation.isPending,
  };
}
