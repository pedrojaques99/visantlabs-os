import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { loadImage } from '@/utils/imageUtils';
import { HalftoneRenderer } from './HalftoneRenderer';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useImageLabStore } from '@/stores/imageLabStore';
import { useCanvasZoomPan } from '@/hooks/useCanvasZoomPan';
import { useVideoSource } from '@/hooks/useVideoSource';

export interface HalftoneCanvasHandle {
  getRenderer: () => HalftoneRenderer | null;
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

interface HalftoneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const HalftoneCanvas = forwardRef<HalftoneCanvasHandle, HalftoneCanvasProps>(
  ({ onCanvasReady }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<HalftoneRenderer | null>(null);
    const [webglFailed, setWebglFailed] = React.useState(false);

    const store = useHalftoneStore();
    const effectOpacity = useImageLabStore((s) => s.effectOpacity);
    const settingsJson = useHalftoneStore((s) => JSON.stringify(s.getSettings()));
    const zoom = useHalftoneStore((s) => s.zoom);
    const panX = useHalftoneStore((s) => s.panX);
    const panY = useHalftoneStore((s) => s.panY);
    const mediaType = useHalftoneStore((s) => s.mediaType);

    const { isPanning, handleMouseDown, handleMouseMove, handleMouseUp, bindWheelToRef } =
      useCanvasZoomPan({
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

    const onVideoFrame = useCallback((source: TexImageSource) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      if (!renderer.isImageLoaded) {
        renderer.setupTexture(source);
      } else {
        renderer.updateTexture(source);
      }
      renderer.render({
        ...useHalftoneStore.getState().getSettings(),
        effectOpacity: useImageLabStore.getState().effectOpacity,
      });
    }, []);

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
      loadImage(store.imageUrl).then((img) => {
        rendererRef.current!.setupTexture(img);
        rendererRef.current!.render({
          ...store.getSettings(),
          effectOpacity: useImageLabStore.getState().effectOpacity,
        });
      });
    }, [store.imageUrl, mediaType]);

    useEffect(() => {
      if (!rendererRef.current?.isImageLoaded || mediaType === 'video') return;
      rendererRef.current.render({ ...store.getSettings(), effectOpacity });
    }, [settingsJson, effectOpacity, mediaType]);

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
        className={cn(
          'w-full h-full flex items-center justify-center overflow-hidden bg-neutral-950',
          isPanning && 'cursor-grabbing'
        )}
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
  }
);
