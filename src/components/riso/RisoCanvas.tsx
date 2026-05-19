import React, { useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RisoRenderer, extractDominantColors } from './RisoRenderer';
import { useRisoStore } from '@/stores/risoStore';

interface RisoCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

const REGISTRATION_OFFSETS: [number, number][] = [
  [1, -1], [-1, 1], [1, 1], [-1, -1],
];

export const RisoCanvas: React.FC<RisoCanvasProps> = ({ onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RisoRenderer | null>(null);
  const store = useRisoStore();
  const settingsJson = useRisoStore((s) => JSON.stringify(s.getSettings()));

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new RisoRenderer(canvasRef.current);
    rendererRef.current = renderer;
    onCanvasReady(canvasRef.current);
    return () => renderer.destroy();
  }, [onCanvasReady]);

  useEffect(() => {
    if (!store.imageUrl || !rendererRef.current) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const renderer = rendererRef.current!;
      renderer.setupImage(img);

      // Auto-extract dominant colors
      store.setIsAnalyzing(true);
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = img.naturalWidth || img.width;
      tmpCanvas.height = img.naturalHeight || img.height;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.drawImage(img, 0, 0);
      const imgData = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
      const colors = extractDominantColors(imgData, store.colorCount);

      const layers = colors.map((color, i) => ({
        color,
        hex: rgbToHex(color[0], color[1], color[2]),
        visible: true,
        alpha: 0.85,
        angle: i * 22.5,
        offsetX: REGISTRATION_OFFSETS[i % REGISTRATION_OFFSETS.length][0],
        offsetY: REGISTRATION_OFFSETS[i % REGISTRATION_OFFSETS.length][1],
      }));

      store.setLayers(layers);
      store.setIsAnalyzing(false);

      renderer.render({ ...store.getSettings(), layers });
    };
    img.src = store.imageUrl;
  }, [store.imageUrl, store.colorCount]);

  useEffect(() => {
    if (!rendererRef.current?.isImageLoaded || store.layers.length === 0) return;
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
