import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { loadImage } from '@/utils/imageUtils';
import { useTextureFilterStore } from '@/stores/textureFilterStore';
import { useCanvasZoomPan } from '@/hooks/useCanvasZoomPan';

export interface TextureFilterCanvasHandle {
  renderAtScale: (scale: number) => HTMLCanvasElement | undefined;
}

interface TextureFilterCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const TextureFilterCanvas = forwardRef<TextureFilterCanvasHandle, TextureFilterCanvasProps>(({ onCanvasReady }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textureImgRef = useRef<HTMLImageElement | null>(null);
  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [textureLoaded, setTextureLoaded] = useState(false);

  const store = useTextureFilterStore();
  const settingsJson = JSON.stringify(store.getSettings());
  const zoom = useTextureFilterStore((s) => s.zoom);
  const panX = useTextureFilterStore((s) => s.panX);
  const panY = useTextureFilterStore((s) => s.panY);

  const drawTexture = useCallback((ctx: CanvasRenderingContext2D, texture: HTMLImageElement, sw: number, sh: number, settings: ReturnType<typeof store.getSettings>) => {
    const tw = texture.naturalWidth || texture.width;
    const th = texture.naturalHeight || texture.height;
    const scaledW = tw * settings.scale;
    const scaledH = th * settings.scale;

    let texSource: HTMLImageElement | HTMLCanvasElement = texture;

    if (!settings.useOriginalColor) {
      const offscreen = document.createElement('canvas');
      offscreen.width = tw;
      offscreen.height = th;
      const octx = offscreen.getContext('2d')!;
      octx.drawImage(texture, 0, 0);
      octx.globalCompositeOperation = 'source-in';
      octx.fillStyle = settings.textureColor;
      octx.fillRect(0, 0, tw, th);
      texSource = offscreen;
    }

    if (settings.tileMode) {
      const stepX = scaledW + settings.tileGapX * settings.scale;
      const stepY = scaledH + settings.tileGapY * settings.scale;
      for (let x = settings.offsetX % stepX - stepX; x < sw + stepX; x += stepX) {
        for (let y = settings.offsetY % stepY - stepY; y < sh + stepY; y += stepY) {
          ctx.drawImage(texSource, x, y, scaledW, scaledH);
        }
      }
    } else {
      ctx.drawImage(texSource, settings.offsetX, settings.offsetY, scaledW, scaledH);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    renderAtScale: (scale: number) => {
      const source = sourceImgRef.current;
      const texture = textureImgRef.current;
      if (!source || !texture || scale <= 1) return undefined;

      const sw = source.naturalWidth;
      const sh = source.naturalHeight;
      const w = Math.round(sw * scale);
      const h = Math.round(sh * scale);

      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d')!;
      ctx.scale(scale, scale);

      const settings = useTextureFilterStore.getState().getSettings();

      if (settings.maskMode) {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = w;
        maskCanvas.height = h;
        const mctx = maskCanvas.getContext('2d')!;
        mctx.scale(scale, scale);
        if (settings.maskInvert) {
          mctx.fillStyle = '#ffffff';
          mctx.fillRect(0, 0, sw, sh);
          mctx.globalCompositeOperation = 'destination-out';
        }
        if (settings.rotation !== 0) {
          mctx.translate(sw / 2, sh / 2);
          mctx.rotate((settings.rotation * Math.PI) / 180);
          mctx.translate(-sw / 2, -sh / 2);
        }
        drawTexture(mctx, texture, sw, sh, { ...settings, useOriginalColor: false, textureColor: '#ffffff' });

        ctx.drawImage(source, 0, 0, sw, sh);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(maskCanvas, 0, 0);
      } else {
        ctx.drawImage(source, 0, 0, sw, sh);
        ctx.globalCompositeOperation = settings.blendMode as GlobalCompositeOperation;
        ctx.globalAlpha = settings.opacity;
        if (settings.rotation !== 0) {
          ctx.translate(sw / 2, sh / 2);
          ctx.rotate((settings.rotation * Math.PI) / 180);
          ctx.translate(-sw / 2, -sh / 2);
        }
        drawTexture(ctx, texture, sw, sh, settings);
      }

      return out;
    },
  }), [drawTexture]);

  const { isPanning, handleMouseDown, handleMouseMove, handleMouseUp, bindWheelToRef } = useCanvasZoomPan({
    getState: useTextureFilterStore.getState,
  });

  const loadTexture = useCallback((src: string) => {
    setTextureLoaded(false);
    loadImage(src).then((img) => {
      textureImgRef.current = img;
      setTextureLoaded(true);
    });
  }, []);

  useEffect(() => {
    loadTexture(store.textureSrc);
  }, [store.textureSrc, loadTexture]);

  const renderFrame = useCallback((source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
    const canvas = canvasRef.current;
    const texture = textureImgRef.current;
    if (!canvas || !texture) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const settings = useTextureFilterStore.getState().getSettings();

    let sw: number, sh: number;
    if (source instanceof HTMLVideoElement) {
      sw = source.videoWidth; sh = source.videoHeight;
    } else if (source instanceof HTMLImageElement) {
      sw = source.naturalWidth; sh = source.naturalHeight;
    } else {
      sw = source.width; sh = source.height;
    }
    if (sw === 0 || sh === 0) return;

    canvas.width = sw;
    canvas.height = sh;
    ctx.clearRect(0, 0, sw, sh);

    if (settings.maskMode) {
      // Mask mode: texture acts as alpha mask for the image
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = sw;
      maskCanvas.height = sh;
      const mctx = maskCanvas.getContext('2d')!;

      if (settings.maskInvert) {
        mctx.fillStyle = '#ffffff';
        mctx.fillRect(0, 0, sw, sh);
        mctx.globalCompositeOperation = 'destination-out';
      }

      mctx.save();
      if (settings.rotation !== 0) {
        mctx.translate(sw / 2, sh / 2);
        mctx.rotate((settings.rotation * Math.PI) / 180);
        mctx.translate(-sw / 2, -sh / 2);
      }
      mctx.globalAlpha = 1;
      drawTexture(mctx, texture, sw, sh, { ...settings, useOriginalColor: false, textureColor: '#ffffff' });
      mctx.restore();

      ctx.drawImage(source, 0, 0, sw, sh);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.drawImage(source, 0, 0, sw, sh);

      ctx.save();
      ctx.globalCompositeOperation = settings.blendMode as GlobalCompositeOperation;
      ctx.globalAlpha = settings.opacity;

      if (settings.rotation !== 0) {
        ctx.translate(sw / 2, sh / 2);
        ctx.rotate((settings.rotation * Math.PI) / 180);
        ctx.translate(-sw / 2, -sh / 2);
      }

      drawTexture(ctx, texture, sw, sh, settings);
      ctx.restore();
    }
  }, [drawTexture]);

  useEffect(() => {
    if (!store.imageUrl) return;
    const state = useTextureFilterStore.getState();

    if (state.mediaType === 'video') {
      const video = videoRef.current;
      if (!video) return;
      video.src = store.imageUrl;
      video.muted = true;
      video.loop = true;
      video.play();
      const loop = () => {
        if (!video.paused && !video.ended) renderFrame(video);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      video.onloadeddata = () => {
        if (canvasRef.current) onCanvasReady(canvasRef.current);
        loop();
      };
      return () => cancelAnimationFrame(animFrameRef.current);
    } else {
      loadImage(store.imageUrl).then((img) => {
        sourceImgRef.current = img;
        renderFrame(img);
        if (canvasRef.current) onCanvasReady(canvasRef.current);
      });
    }
  }, [store.imageUrl, store.mediaType, onCanvasReady, renderFrame]);

  useEffect(() => {
    if (!sourceImgRef.current || store.mediaType !== 'image') return;
    if (!textureLoaded) return;
    renderFrame(sourceImgRef.current);
  }, [settingsJson, textureLoaded, renderFrame, store.mediaType]);

  useEffect(() => {
    return bindWheelToRef(containerRef.current);
  }, [bindWheelToRef, store.imageUrl]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full flex items-center justify-center overflow-hidden bg-neutral-950', isPanning && 'cursor-grabbing')}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        className={store.imageUrl ? '' : 'hidden'}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
          transformOrigin: 'center center',
        }}
      />
      <video ref={videoRef} className="hidden" playsInline />
    </div>
  );
});
