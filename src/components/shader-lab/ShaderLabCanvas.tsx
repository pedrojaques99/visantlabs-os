import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { loadImage } from '@/utils/imageUtils';
import { useShaderLabStore } from '@/stores/shaderLabStore';
import { useImageLabStore } from '@/stores/imageLabStore';
import { PersistentShaderRenderer, type ShaderSettings } from '@/utils/shaders/shaderRenderer';
import { useCanvasZoomPan } from '@/hooks/useCanvasZoomPan';

export interface ShaderLabCanvasHandle {
  getVideoControls: () => null;
}

interface Props {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const ShaderLabCanvas = forwardRef<ShaderLabCanvasHandle, Props>(
  ({ onCanvasReady }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<PersistentShaderRenderer | null>(null);
    const sourceImgRef = useRef<HTMLImageElement | null>(null);

    const imageUrl = useShaderLabStore((s) => s.imageUrl);
    const shaderEnabled = useShaderLabStore((s) => s.shaderEnabled);
    const shaderType = useShaderLabStore((s) => s.shaderType);
    const shaderValues = useShaderLabStore((s) => s.shaderValues);
    const zoom = useShaderLabStore((s) => s.zoom);
    const panX = useShaderLabStore((s) => s.panX);
    const panY = useShaderLabStore((s) => s.panY);
    const effectOpacity = useImageLabStore((s) => s.effectOpacity);

    const { isPanning, handleMouseDown, handleMouseMove, handleMouseUp, bindWheelToRef } =
      useCanvasZoomPan({
        getState: useShaderLabStore.getState,
      });

    useImperativeHandle(ref, () => ({
      getVideoControls: () => null,
    }));

    useEffect(() => {
      try {
        rendererRef.current = new PersistentShaderRenderer();
      } catch {
        console.warn('WebGL not supported for shaders');
      }
      return () => {
        rendererRef.current?.dispose();
        rendererRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (containerRef.current) bindWheelToRef(containerRef.current);
    }, [bindWheelToRef]);

    useEffect(() => {
      if (!imageUrl) {
        sourceImgRef.current = null;
        return;
      }
      let cancelled = false;
      loadImage(imageUrl, null).then((img) => {
        if (cancelled) return;
        sourceImgRef.current = img;
        renderFrame();
      });
      return () => {
        cancelled = true;
      };
    }, [imageUrl]);

    const renderFrame = useCallback(async () => {
      const canvas = canvasRef.current;
      const img = sourceImgRef.current;
      if (!canvas || !img) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        onCanvasReady(canvas);
      }

      if (shaderEnabled && rendererRef.current) {
        const settings: ShaderSettings = useShaderLabStore.getState().getShaderSettings();
        try {
          const base64 = await rendererRef.current.render(img, imageUrl, w, h, settings);
          const resultImg = await loadImage(base64, null);
          ctx.clearRect(0, 0, w, h);

          if (effectOpacity < 1) {
            ctx.globalAlpha = 1;
            ctx.drawImage(img, 0, 0);
            ctx.globalAlpha = effectOpacity;
            ctx.drawImage(resultImg, 0, 0);
            ctx.globalAlpha = 1;
          } else {
            ctx.drawImage(resultImg, 0, 0);
          }
        } catch {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0);
        }
      } else {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
      }
    }, [imageUrl, shaderEnabled, effectOpacity, onCanvasReady]);

    useEffect(() => {
      renderFrame();
    }, [shaderType, shaderValues, shaderEnabled, effectOpacity, renderFrame]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden flex items-center justify-center bg-neutral-950"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        <canvas
          ref={canvasRef}
          className={cn('max-w-full max-h-full object-contain transition-transform duration-100')}
          style={{
            transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
          }}
        />
      </div>
    );
  }
);

ShaderLabCanvas.displayName = 'ShaderLabCanvas';
