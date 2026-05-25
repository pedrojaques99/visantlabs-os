import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';

export interface UseExportCanvasOptions {
  filenamePrefix: string;
  getShaderSettings?: () => ShaderSettings | undefined;
  setIsExporting?: (v: boolean) => void;
  scale?: number;
  successMessage?: string;
}

export function useExportCanvas(options: UseExportCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const exportPng = useCallback(async () => {
    if (!canvasRef.current) return;
    options.setIsExporting?.(true);
    try {
      let exportCanvas: HTMLCanvasElement = canvasRef.current;
      const shader = options.getShaderSettings?.();
      if (shader) {
        exportCanvas = await applyShaderToCanvas(exportCanvas, shader);
      }
      const blob = await new Promise<Blob>((resolve) => {
        exportCanvas.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${options.filenamePrefix}_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(options.successMessage || 'PNG exported');
    } catch {
      toast.error('Export failed — try again');
    } finally {
      options.setIsExporting?.(false);
    }
  }, [options]);

  const exportScaled = useCallback(async (sourceCanvas: HTMLCanvasElement, scale = 2) => {
    options.setIsExporting?.(true);
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = sourceCanvas.width * scale;
      offscreen.height = sourceCanvas.height * scale;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);

      const blob = await new Promise<Blob>((resolve) => {
        offscreen.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${options.filenamePrefix}_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(options.successMessage || 'PNG exported');
    } catch {
      toast.error('Export failed — try again');
    } finally {
      options.setIsExporting?.(false);
    }
  }, [options]);

  return { canvasRef, onCanvasReady, exportPng, exportScaled };
}
