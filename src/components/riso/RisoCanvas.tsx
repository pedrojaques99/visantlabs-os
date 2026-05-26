import React, { useRef, useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RisoRenderer, extractDominantColors } from './RisoRenderer';
import { useRisoStore } from '@/stores/risoStore';
import { rgbToHex } from '@/utils/colorUtils';
import { useCanvasZoomPan } from '@/hooks/useCanvasZoomPan';

interface RisoCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

const REGISTRATION_OFFSETS: [number, number][] = [
  [1, -1], [-1, 1], [1, 1], [-1, -1],
];

export const RisoCanvas: React.FC<RisoCanvasProps> = ({ onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RisoRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const store = useRisoStore();
  const settingsJson = useRisoStore((s) => JSON.stringify(s.getSettings()));
  const zoom = useRisoStore((s) => s.zoom);
  const panX = useRisoStore((s) => s.panX);
  const panY = useRisoStore((s) => s.panY);
  const isAnalyzing = useRisoStore((s) => s.isAnalyzing);

  const { isPanning, handleMouseDown, handleMouseMove, handleMouseUp, bindWheelToRef } = useCanvasZoomPan({
    getState: useRisoStore.getState,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new RisoRenderer(canvasRef.current);
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
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const renderer = rendererRef.current!;
      renderer.setupTexture(img);

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

  useEffect(() => {
    return bindWheelToRef(containerRef.current);
  }, [bindWheelToRef]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      store.setImageUrl(url, file.name);
      toast.success(`Loaded ${file.name}`);
    }
  }, [store]);

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
      onDrop={handleDrop}
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

      {isAnalyzing && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 pointer-events-none">
          <div className="flex items-center gap-2 text-neutral-300">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[10px] uppercase tracking-widest">Analyzing colors...</span>
          </div>
        </div>
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
