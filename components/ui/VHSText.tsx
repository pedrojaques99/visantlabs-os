import React, { useEffect, useRef, useCallback } from 'react';
import type { ShaderSettings } from '../../utils/shaders/shaderRenderer';
import { PersistentShaderRenderer } from '../../utils/shaders/shaderRenderer';

interface VHSTextProps {
  children: string;
  className?: string;
  fontSize?: string;
  color?: string;
  theme?: 'dark' | 'light';
}

// Global renderer instance (reused across all instances)
let globalRenderer: PersistentShaderRenderer | null = null;

const getRenderer = (): PersistentShaderRenderer => {
  if (!globalRenderer) {
    globalRenderer = new PersistentShaderRenderer();
  }
  return globalRenderer;
};

export const VHSText: React.FC<VHSTextProps> = ({
  children,
  className = '',
  fontSize = 'text-8xl md:text-[10rem] lg:text-[12rem]',
  color = '#brand-cyan',
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<PersistentShaderRenderer | null>(null);
  const isRenderingRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFullHeight = className.includes('h-full');
  const textCanvasCacheRef = useRef<{ canvas: HTMLCanvasElement; width: number; height: number } | null>(null);
  const lastRenderTimeRef = useRef<number>(0);
  const dimensionsRef = useRef<{ width: number; height: number } | null>(null);

  // Target FPS: 30fps for lighter loop (33ms per frame)
  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  // Initialize renderer
  useEffect(() => {
    rendererRef.current = getRenderer();
    startTimeRef.current = performance.now() / 1000;

    return () => {
      // Clear cache on unmount
      textCanvasCacheRef.current = null;
      dimensionsRef.current = null;
    };
  }, []);

  // Clear cache when children or color changes
  useEffect(() => {
    textCanvasCacheRef.current = null;
  }, [children, color]);

  // Create text canvas with text rendered (cached when dimensions don't change)
  const getTextCanvas = useCallback((width: number, height: number): HTMLCanvasElement => {
    // Reuse cached canvas if dimensions match
    if (textCanvasCacheRef.current &&
      textCanvasCacheRef.current.width === width &&
      textCanvasCacheRef.current.height === height) {
      return textCanvasCacheRef.current.canvas;
    }

    const textCanvas = document.createElement('canvas');
    textCanvas.width = width;
    textCanvas.height = height;
    const ctx = textCanvas.getContext('2d');

    if (!ctx) return textCanvas;

    // Fill canvas with black background (required for shader to process correctly)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Set text style - use a large font size that scales with width
    ctx.fillStyle = color;
    const fontSize = Math.max(100, Math.floor(width * 0.4));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw text
    ctx.fillText(children, width / 2, height / 2);

    // Cache the canvas
    textCanvasCacheRef.current = { canvas: textCanvas, width, height };

    return textCanvas;
  }, [children, color]);

  // Render frame function (optimized for lighter loop)
  const renderFrame = useCallback(async () => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;

    if (!canvas || !renderer) {
      if (isRenderingRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
      return;
    }

    // Throttle to target FPS
    const now = performance.now();
    const elapsed = now - lastRenderTimeRef.current;
    if (elapsed < FRAME_INTERVAL) {
      if (isRenderingRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
      return;
    }
    lastRenderTimeRef.current = now;

    try {
      // Get container dimensions from computed style
      const container = containerRef.current;
      if (!container) {
        if (isRenderingRef.current) {
          animationFrameRef.current = requestAnimationFrame(renderFrame);
        }
        return;
      }

      const rect = container.getBoundingClientRect();
      let displayWidth = Math.floor(rect.width);
      let displayHeight = Math.floor(rect.height);

      // If container has full height but rect.height is 0, use viewport height
      if (displayHeight === 0 && isFullHeight) {
        displayHeight = window.innerHeight;
      }
      if (displayWidth === 0) {
        displayWidth = window.innerWidth;
      }

      if (displayWidth === 0 || displayHeight === 0) {
        if (isRenderingRef.current) {
          animationFrameRef.current = requestAnimationFrame(renderFrame);
        }
        return;
      }

      // Use lower resolution for background (lighter rendering)
      // 1x resolution is enough for background effect
      const renderWidth = Math.min(1920, displayWidth);
      const renderHeight = Math.min(1080, displayHeight);

      // Only resize canvas if dimensions changed
      const dimensionsChanged = !dimensionsRef.current ||
        dimensionsRef.current.width !== renderWidth ||
        dimensionsRef.current.height !== renderHeight;

      if (dimensionsChanged) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        dimensionsRef.current = { width: renderWidth, height: renderHeight };
        // Clear cache when dimensions change
        textCanvasCacheRef.current = null;
      }

      // Get cached or create text canvas
      const textCanvas = getTextCanvas(renderWidth, renderHeight);

      // Calculate time for animation
      const currentTime = (performance.now() / 1000) - startTimeRef.current;

      // VHS shader settings (subtle effect, less neon)
      const settings: ShaderSettings = {
        shaderType: 'vhs',
        time: currentTime,
        tapeWaveIntensity: 0.25,
        tapeCreaseIntensity: 0.15,
        switchingNoiseIntensity: 0.1,
        bloomIntensity: 0.15,
        acBeatIntensity: 0.2,
      };

      // Render shader effect
      const resultDataUrl = await renderer.render(
        textCanvas,
        `vhs-text-${children}`,
        renderWidth,
        renderHeight,
        settings
      );

      // Draw result to canvas and make black background transparent
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // Get image data to process pixels
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Make black pixels transparent while preserving VHS effect on colored text
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];

              // If pixel is very dark (almost black), make it transparent
              // Threshold: if all RGB values are below 30, make transparent
              if (r < 30 && g < 30 && b < 30) {
                data[i + 3] = 0; // Set alpha to 0 (transparent)
              }
            }

            ctx.putImageData(imageData, 0, 0);
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
      console.error('[VHSText] Error rendering frame:', error);
      // Continue rendering even on error
      if (isRenderingRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
    }
  }, [children, getTextCanvas, isFullHeight]);

  // Start/stop rendering
  useEffect(() => {
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

    // Start rendering
    startRendering();

    return () => {
      stopRendering();
    };
  }, [renderFrame]);

  // Determine drop shadow based on theme (reduced neon effect)
  const dropShadowClass = theme === 'dark'
    ? 'drop-shadow-[0_0_15px_rgba(82,221,235,0.3)]'
    : 'drop-shadow-[0_0_10px_rgba(82,221,235,0.2)]';

  return (
    <div
      ref={containerRef}
      className={`${fontSize} font-bold font-mono leading-none tracking-tight ${dropShadowClass} ${className}`}
      style={{
        width: '100%',
        height: isFullHeight ? '100%' : '179px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: '0px',
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
        borderRadius: '0px',
        boxSizing: 'content-box',
        verticalAlign: 'middle',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '550px',
          height: '232px',
          display: 'block',
          objectFit: 'contain',
          margin: 0,
          paddingTop: '29px',
          paddingBottom: '29px',
        }}
      />
    </div>
  );
};

