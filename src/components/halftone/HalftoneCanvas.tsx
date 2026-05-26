import React, { useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadImage } from '@/utils/imageUtils';
import { HalftoneRenderer } from './HalftoneRenderer';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useCanvasZoomPan } from '@/hooks/useCanvasZoomPan';

interface HalftoneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const HalftoneCanvas: React.FC<HalftoneCanvasProps> = ({ onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HalftoneRenderer | null>(null);
  const [webglFailed, setWebglFailed] = React.useState(false);

  const store = useHalftoneStore();
  const settingsJson = useHalftoneStore((s) => JSON.stringify(s.getSettings()));
  const zoom = useHalftoneStore((s) => s.zoom);
  const panX = useHalftoneStore((s) => s.panX);
  const panY = useHalftoneStore((s) => s.panY);

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
      {!store.imageUrl && (
        <label className="flex flex-col items-center justify-center gap-3 cursor-pointer text-neutral-600 hover:text-neutral-300 transition-colors group">
          <div className="w-16 h-16 rounded-2xl border border-dashed border-neutral-700 group-hover:border-neutral-500 flex items-center justify-center transition-colors">
            <Upload size={24} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
          </div>
          <span className="text-[10px] uppercase tracking-widest">Drop an image or click to upload</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                store.setImageUrl(url, file.name);
                toast.success(`Loaded ${file.name}`);
              }
              e.target.value = '';
            }}
          />
        </label>
      )}
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
};
