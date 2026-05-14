import React, { useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HalftoneRenderer } from './HalftoneRenderer';
import { useHalftoneStore } from '@/stores/halftoneStore';

interface HalftoneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const HalftoneCanvas: React.FC<HalftoneCanvasProps> = ({ onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HalftoneRenderer | null>(null);
  const store = useHalftoneStore();
  const settingsJson = useHalftoneStore((s) => JSON.stringify(s.getSettings()));

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
    rendererRef.current.render(store.getSettings());
  }, [settingsJson]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      store.setImageUrl(url, file.name);
      toast.success(`Loaded ${file.name}`);
    }
  }, [store]);

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-auto bg-neutral-950"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {!store.imageUrl && (
        <label className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer text-neutral-600 hover:text-neutral-300 transition-colors z-10 group">
          <div className="w-16 h-16 rounded-2xl border border-dashed border-neutral-700 group-hover:border-neutral-500 flex items-center justify-center transition-colors">
            <Upload size={24} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
          </div>
          <span className="text-[10px] uppercase tracking-widest">Drop an image or click to upload</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
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
      <canvas
        ref={canvasRef}
        className={cn('max-w-full max-h-full object-contain', !store.imageUrl && 'hidden')}
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
};
