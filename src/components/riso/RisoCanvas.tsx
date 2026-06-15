import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadImage } from '@/utils/imageUtils';
import { RisoRenderer, extractDominantColors } from './RisoRenderer';
import { useRisoStore } from '@/stores/risoStore';
import { useImageLabStore } from '@/stores/imageLabStore';
import { rgbToHex } from '@/utils/colorUtils';
import { useCanvasZoomPan } from '@/hooks/useCanvasZoomPan';
import { useVideoSource } from '@/hooks/useVideoSource';

export interface RisoCanvasHandle {
  getRenderer: () => RisoRenderer | null;
  getVideoControls: () => {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    duration: number;
    currentTime: number;
    play: () => void;
    pause: () => void;
    seek: (t: number) => void;
  } | null;
}

interface RisoCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

const REGISTRATION_OFFSETS: [number, number][] = [
  [1, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
];

export const RisoCanvas = forwardRef<RisoCanvasHandle, RisoCanvasProps>(
  ({ onCanvasReady }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<RisoRenderer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [webglFailed, setWebglFailed] = useState(false);

    const store = useRisoStore();
    const effectOpacity = useImageLabStore((s) => s.effectOpacity);
    const settingsJson = useRisoStore((s) => JSON.stringify(s.getSettings()));
    const zoom = useRisoStore((s) => s.zoom);
    const panX = useRisoStore((s) => s.panX);
    const panY = useRisoStore((s) => s.panY);
    const isAnalyzing = useRisoStore((s) => s.isAnalyzing);
    const mediaType = useRisoStore((s) => s.mediaType);
    const colorAnalyzedRef = useRef(false);

    const { isPanning, handleMouseDown, handleMouseMove, handleMouseUp, bindWheelToRef } =
      useCanvasZoomPan({
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

    const analyzeAndSetLayers = useCallback((source: TexImageSource) => {
      const store = useRisoStore.getState();
      store.setIsAnalyzing(true);
      const w =
        source instanceof HTMLVideoElement
          ? source.videoWidth
          : source instanceof HTMLImageElement
            ? source.naturalWidth || source.width
            : (source as HTMLCanvasElement).width;
      const h =
        source instanceof HTMLVideoElement
          ? source.videoHeight
          : source instanceof HTMLImageElement
            ? source.naturalHeight || source.height
            : (source as HTMLCanvasElement).height;
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.drawImage(source as CanvasImageSource, 0, 0);
      const imgData = tmpCtx.getImageData(0, 0, w, h);
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
      return layers;
    }, []);

    const onVideoFrame = useCallback(
      (source: TexImageSource) => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        if (!renderer.isImageLoaded) {
          renderer.setupTexture(source);
          const layers = analyzeAndSetLayers(source);
          colorAnalyzedRef.current = true;
          renderer.render({
            ...useRisoStore.getState().getSettings(),
            layers,
            effectOpacity: useImageLabStore.getState().effectOpacity,
          });
        } else {
          renderer.updateTexture(source);
          const s = useRisoStore.getState();
          if (s.layers.length > 0) {
            renderer.render({
              ...s.getSettings(),
              effectOpacity: useImageLabStore.getState().effectOpacity,
            });
          }
        }
      },
      [analyzeAndSetLayers]
    );

    const videoSource = useVideoSource({
      url: store.imageUrl,
      mediaType,
      onFrame: onVideoFrame,
    });

    useImperativeHandle(
      ref,
      () => ({
        getRenderer: () => rendererRef.current,
        getVideoControls: () => (videoSource.isVideo ? videoSource : null),
      }),
      [videoSource]
    );

    useEffect(() => {
      if (!store.imageUrl || !rendererRef.current || mediaType === 'video') return;
      colorAnalyzedRef.current = false;
      loadImage(store.imageUrl).then((img) => {
        const renderer = rendererRef.current!;
        renderer.setupTexture(img);
        const layers = analyzeAndSetLayers(img);
        renderer.render({
          ...store.getSettings(),
          layers,
          effectOpacity: useImageLabStore.getState().effectOpacity,
        });
      });
    }, [store.imageUrl, store.colorCount, mediaType, analyzeAndSetLayers]);

    useEffect(() => {
      if (!rendererRef.current?.isImageLoaded || store.layers.length === 0 || mediaType === 'video')
        return;
      rendererRef.current.render({ ...store.getSettings(), effectOpacity });
    }, [settingsJson, effectOpacity, mediaType]);

    useEffect(() => {
      return bindWheelToRef(containerRef.current);
    }, [bindWheelToRef]);

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
        className={cn(
          'w-full h-full flex items-center justify-center overflow-hidden bg-neutral-950',
          isPanning && 'cursor-grabbing'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
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
  }
);
