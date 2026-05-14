import React, { useRef, useEffect, useCallback } from 'react';
import { HalftoneRenderer } from './HalftoneRenderer';
import { useHalftoneStore } from '@/stores/halftoneStore';

interface HalftoneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const HalftoneCanvas: React.FC<HalftoneCanvasProps> = ({ onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HalftoneRenderer | null>(null);
  const store = useHalftoneStore();
  const settings = useHalftoneStore((s) => s.getSettings());

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new HalftoneRenderer(canvasRef.current);
    if (renderer.init()) {
      rendererRef.current = renderer;
      onCanvasReady(canvasRef.current);
    }
    return () => renderer.destroy();
  }, [onCanvasReady]);

  useEffect(() => {
    if (!store.imageUrl || !rendererRef.current) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      rendererRef.current!.setupTexture(img);
      rendererRef.current!.render(store.getSettings());
    };
    img.src = store.imageUrl;
  }, [store.imageUrl]);

  useEffect(() => {
    if (!rendererRef.current?.isImageLoaded) return;
    rendererRef.current.render(settings);
  }, [settings]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      store.setImageUrl(url, file.name);
    }
  }, [store]);

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-auto bg-neutral-950"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {!store.imageUrl ? (
        <label className="flex flex-col items-center gap-3 cursor-pointer text-neutral-600 hover:text-neutral-400 transition-colors">
          <span className="text-xs uppercase tracking-widest">Drop an image or click to upload</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                store.setImageUrl(url, file.name);
              }
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: 'auto' }}
        />
      )}
      {!store.imageUrl && <canvas ref={canvasRef} className="hidden" />}
    </div>
  );
};
