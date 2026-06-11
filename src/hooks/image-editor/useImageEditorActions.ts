import { useCallback, useEffect } from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';
import {
  imagelabApi,
  pollImageLabJob,
  type GenerativeExpandResult,
  type InpaintResult,
} from '@/services/imagelabApi';
import { useMaskCanvas } from './useMaskCanvas';
import { toast } from 'sonner';
interface Options {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

// ── Pending-job persistence (resume across reloads, like Content Studio) ──
// Keyed by the source image so a stale job is never applied to a different one.
const PENDING_JOB_KEY = 'imagelab:pending-job';

interface PendingJob {
  jobId: string;
  kind: 'expand' | 'inpaint';
  imageUrl: string;
}

function savePendingJob(job: PendingJob) {
  try {
    localStorage.setItem(PENDING_JOB_KEY, JSON.stringify(job));
  } catch {
    /* storage unavailable — async still works, just no reload-resume */
  }
}

function clearPendingJob() {
  try {
    localStorage.removeItem(PENDING_JOB_KEY);
  } catch {
    /* ignore */
  }
}

function readPendingJob(): PendingJob | null {
  try {
    const raw = localStorage.getItem(PENDING_JOB_KEY);
    return raw ? (JSON.parse(raw) as PendingJob) : null;
  } catch {
    return null;
  }
}

export function useImageEditorActions({ imageUrl, imageWidth, imageHeight }: Options) {
  const { exportMaskBase64 } = useMaskCanvas(imageWidth, imageHeight);

  const handleInpaint = useCallback(async () => {
    const state = useImageEditorStore.getState();
    if (state.maskOperations.length === 0) {
      toast.error('Select an area to edit first');
      return;
    }
    if (state.activeMode === 'replace' && !state.prompt.trim()) {
      toast.error('Enter a prompt describing what to generate');
      return;
    }

    state.setGenerating(true);

    try {
      const maskBase64 = exportMaskBase64(state.maskOperations);
      const { jobId } = await imagelabApi.inpaintAsync({
        imageUrl,
        mode: state.activeMode,
        prompt: state.prompt || undefined,
        maskBase64,
      });
      savePendingJob({ jobId, kind: 'inpaint', imageUrl });

      const result = await pollImageLabJob<InpaintResult>(jobId);
      clearPendingJob();

      useImageEditorStore.getState().setResult(result.imageUrl, result.base64);
      toast.success('Image edited successfully!');
    } catch (err: any) {
      clearPendingJob();
      toast.error(err?.message || 'Failed to edit image');
    } finally {
      useImageEditorStore.getState().setGenerating(false);
    }
  }, [imageUrl, exportMaskBase64]);

  const handleExpand = useCallback(async () => {
    const state = useImageEditorStore.getState();
    const { expandEdges } = state;
    const hasExpansion =
      expandEdges.top > 0 ||
      expandEdges.right > 0 ||
      expandEdges.bottom > 0 ||
      expandEdges.left > 0;

    if (!hasExpansion) {
      toast.error('Drag an edge to expand the image');
      return;
    }

    state.setGenerating(true);

    try {
      let direction: 'up' | 'down' | 'left' | 'right' | 'all' = 'all';
      const nonZero = Object.entries(expandEdges).filter(([, v]) => v > 0);
      if (nonZero.length === 1) {
        const edgeMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          top: 'up',
          bottom: 'down',
          left: 'left',
          right: 'right',
        };
        direction = edgeMap[nonZero[0][0]];
      }

      const maxExpand = Math.max(
        (imageWidth + expandEdges.left + expandEdges.right) / imageWidth,
        (imageHeight + expandEdges.top + expandEdges.bottom) / imageHeight
      );

      const { jobId } = await imagelabApi.generativeExpandAsync({
        imageUrl,
        direction,
        expandFactor: maxExpand,
        prompt: state.prompt || undefined,
      });
      savePendingJob({ jobId, kind: 'expand', imageUrl });

      const result = await pollImageLabJob<GenerativeExpandResult>(jobId);
      clearPendingJob();

      useImageEditorStore.getState().setResult(result.imageUrl, result.base64);
      toast.success('Image expanded!');
    } catch (err: any) {
      clearPendingJob();
      toast.error(err?.message || 'Failed to expand image');
    } finally {
      useImageEditorStore.getState().setGenerating(false);
    }
  }, [imageUrl, imageWidth, imageHeight]);

  const handleRemoveBackground = useCallback(async () => {
    const state = useImageEditorStore.getState();
    state.setGenerating(true);

    try {
      const result = await imagelabApi.removeBackground({ imageUrl });
      state.setResult(result.imageUrl);
      toast.success(`Background removed (${result.engine})`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove background');
    } finally {
      state.setGenerating(false);
    }
  }, [imageUrl]);

  // Resume a job left in-flight by a reload — only for the current image, so a
  // result is never applied to the wrong photo. Mirrors Content Studio's resume.
  useEffect(() => {
    const pending = readPendingJob();
    if (!pending || pending.imageUrl !== imageUrl) return;

    let cancelled = false;
    const state = useImageEditorStore.getState();
    state.setGenerating(true);
    toast.info('Resuming in-progress edit…');

    pollImageLabJob<GenerativeExpandResult | InpaintResult>(pending.jobId)
      .then((result) => {
        if (cancelled) return;
        clearPendingJob();
        useImageEditorStore.getState().setResult(result.imageUrl, result.base64);
        toast.success(pending.kind === 'expand' ? 'Image expanded!' : 'Image edited successfully!');
      })
      .catch((err: any) => {
        if (cancelled) return;
        clearPendingJob();
        toast.error(err?.message || 'Could not resume the previous edit');
      })
      .finally(() => {
        if (!cancelled) useImageEditorStore.getState().setGenerating(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const handleGenerate = useCallback(() => {
    const action = useImageEditorStore.getState().activeAction;
    switch (action) {
      case 'inpaint':
        return handleInpaint();
      case 'expand':
        return handleExpand();
      case 'remove-bg':
        return handleRemoveBackground();
    }
  }, [handleInpaint, handleExpand, handleRemoveBackground]);

  return { handleGenerate, handleInpaint, handleExpand, handleRemoveBackground };
}
