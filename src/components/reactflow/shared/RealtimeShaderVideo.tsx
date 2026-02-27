import React, { useEffect, useRef, useCallback } from 'react';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';
import { PersistentShaderRenderer } from '@/utils/shaders/shaderRenderer';

interface RealtimeShaderVideoProps {
  videoSrc: string;
  settings: ShaderSettings;
  className?: string;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
}

// Global renderer instance (reused across all instances)
let globalRenderer: PersistentShaderRenderer | null = null;

const getRenderer = (): PersistentShaderRenderer => {
  if (!globalRenderer) {
    globalRenderer = new PersistentShaderRenderer();
  }
  return globalRenderer;
};

export const RealtimeShaderVideo: React.FC<RealtimeShaderVideoProps> = ({
  videoSrc,
  settings,
  className,
  loop = true,
  muted = true,
  playsInline = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<PersistentShaderRenderer | null>(null);
  const isRenderingRef = useRef(false);

  // Initialize renderer
  useEffect(() => {
    rendererRef.current = getRenderer();
  }, []);

  // Render frame function
  const renderFrame = useCallback(async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const renderer = rendererRef.current;

    if (!canvas || !video || !renderer || video.readyState < 2) {
      // Video not ready, try again next frame
      if (isRenderingRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
      return;
    }

    try {
      // Get video dimensions
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width === 0 || height === 0) {
        // Video dimensions not available yet
        if (isRenderingRef.current) {
          animationFrameRef.current = requestAnimationFrame(renderFrame);
        }
        return;
      }

      // Resize canvas to match video
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Render shader effect on current video frame
      // Create a temporary canvas to capture current video frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(video, 0, 0, width, height);
      }

      // Render shader effect on the frame
      const resultDataUrl = await renderer.render(
        tempCanvas,
        videoSrc,
        width,
        height,
        settings
      );

      // Draw result to canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = reject;
          img.src = resultDataUrl;
        });
      }

      // Continue rendering
      if (isRenderingRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
    } catch (error) {
      console.error('[RealtimeShaderVideo] Error rendering frame:', error);
      // Continue rendering even on error
      if (isRenderingRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
    }
  }, [videoSrc, settings]);

  // Start/stop rendering based on video state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startRendering = () => {
      if (!isRenderingRef.current) {
        isRenderingRef.current = true;
        renderFrame();
      }
    };

    const stopRendering = () => {
      isRenderingRef.current = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const handleLoadedMetadata = () => {
      // Auto-play video when metadata is loaded
      if (loop && muted) {
        video.play().catch((e) => {
          console.debug('[RealtimeShaderVideo] Auto-play prevented:', e);
        });
      }
    };

    video.addEventListener('play', startRendering);
    video.addEventListener('pause', stopRendering);
    video.addEventListener('ended', stopRendering);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Start if video is already playing
    if (!video.paused && !video.ended) {
      startRendering();
    }

    // Try to start if metadata is already loaded
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('play', startRendering);
      video.removeEventListener('pause', stopRendering);
      video.removeEventListener('ended', stopRendering);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      stopRendering();
    };
  }, [renderFrame, loop, muted]);

  // Restart rendering when settings change
  useEffect(() => {
    if (isRenderingRef.current && videoRef.current && !videoRef.current.paused) {
      // Settings changed, continue rendering with new settings
      renderFrame();
    }
  }, [settings, renderFrame]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Hidden video element for source */}
      <video
        ref={videoRef}
        src={videoSrc}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        className="hidden"
        crossOrigin="anonymous"
        preload="auto"
      />
      {/* Canvas for rendered output */}
      <canvas
        ref={canvasRef}
        className={className || 'w-full h-full object-contain rounded'}
      />
    </div>
  );
};

