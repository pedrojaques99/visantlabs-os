import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { loadImage } from '@/utils/imageUtils';
import { HalftoneRenderer } from './HalftoneRenderer';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useCanvasZoomPan } from '@/hooks/useCanvasZoomPan';

export interface HalftoneCanvasHandle {
  getRenderer: () => HalftoneRenderer | null;
}

interface HalftoneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const HalftoneCanvas = forwardRef<HalftoneCanvasHandle, HalftoneCanvasProps>(({ onCanvasReady }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HalftoneRenderer | null>(null);
  const [webglFailed, setWebglFailed] = React.useState(false);

  const store = useHalftoneStore();
  const settingsJson = useHalftoneStore((s) => JSON.stringify(s.getSettings()));
  const zoom = useHalftoneStore((s) => s.zoom);
  const panX = useHalftoneStore((s) => s.panX);
  const panY = useHalftoneStore((s) => s.panY);

  useImperativeHandle(ref, () => ({
    getRenderer: () => rendererRef.current,
  }), []);

  const { isPanning, handleMouseDown, handleMouseMove, handleMouseUp, bindWheelToRef } = useCanvasZoomPan({
    getState: useHalftoneStore.getState,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new HalftoneRenderer(canvasRef.current);
    if (renderer.init()) {
      rendererRef.current = renderer;
      onCanvasReady(canvasRef.current);
    } else {
      setWebglFailed(true);
    }
    return () => renderer.destroy();
  }, [onCanvasReady]);

  useEffect(() => {
    if (!store.imageUrl || !rendererRef.current) return;
    loadImage(store.imageUrl).then((img) => {
      rendererRef.current!.setupTexture(img);
      rendererRef.current!.render(store.getSettings());
    });
  }, [store.imageUrl]);

  useEffect(() => {
    if (!rendererRef.current?.isImageLoaded) return;
    rendererRef.current.render(store.getSettings());
  }, [settingsJson]);

  useEffect(() => {
    return bindWheelToRef(containerRef.current);
  }, [bindWheelToRef, store.imageUrl]);

  if (webglFailed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-950">
        <p className="text-neutral-500 text-[10px] uppercase tracking-widest">
          WebGL not supported — please use a modern browser
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full flex items-center justify-center overflow-hidden bg-neutral-950', isPanning && 'cursor-grabbing')}
      onDragOver={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        <canvas
          ref={canvasRef}
          className={cn('max-w-full max-h-full object-contain', !store.imageUrl && 'hidden')}
          style={{ imageRendering: 'auto' }}
        />
      </div>
    </div>
  );
});
