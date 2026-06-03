import { useCallback } from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';
import { imagelabApi } from '@/services/imagelabApi';
import { useMaskCanvas } from './useMaskCanvas';
import { toast } from 'sonner';
interface Options {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
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
      const result = await imagelabApi.inpaint({
        imageUrl,
        mode: state.activeMode,
        prompt: state.prompt || undefined,
        maskBase64,
      });

      state.setResult(result.imageUrl, result.base64);
      toast.success('Image edited successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to edit image');
    } finally {
      state.setGenerating(false);
    }
  }, [imageUrl, exportMaskBase64]);

  const handleExpand = useCallback(async () => {
    const state = useImageEditorStore.getState();
    const { expandEdges } = state;
    const hasExpansion = expandEdges.top > 0 || expandEdges.right > 0
      || expandEdges.bottom > 0 || expandEdges.left > 0;

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
          top: 'up', bottom: 'down', left: 'left', right: 'right',
        };
        direction = edgeMap[nonZero[0][0]];
      }

      const maxExpand = Math.max(
        (imageWidth + expandEdges.left + expandEdges.right) / imageWidth,
        (imageHeight + expandEdges.top + expandEdges.bottom) / imageHeight,
      );

      const result = await imagelabApi.generativeExpand({
        imageUrl,
        direction,
        expandFactor: maxExpand,
        prompt: state.prompt || undefined,
      });

      state.setResult(result.imageUrl, result.base64);
      toast.success('Image expanded!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to expand image');
    } finally {
      state.setGenerating(false);
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

  const handleGenerate = useCallback(() => {
    const action = useImageEditorStore.getState().activeAction;
    switch (action) {
      case 'inpaint': return handleInpaint();
      case 'expand': return handleExpand();
      case 'remove-bg': return handleRemoveBackground();
    }
  }, [handleInpaint, handleExpand, handleRemoveBackground]);

  return { handleGenerate, handleInpaint, handleExpand, handleRemoveBackground };
}
