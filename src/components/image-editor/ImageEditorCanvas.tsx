import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';
import { IMAGE_EDITOR } from '@/constants/imageEditorTokens';
import { MaskPreview } from './MaskPreview';
import { ExpandHandles } from './ExpandHandles';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

export const ImageEditorCanvas: React.FC<Props> = ({
  imageUrl,
  imageWidth,
  imageHeight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const zoom = useImageEditorStore((s) => s.zoom);
  const panOffset = useImageEditorStore((s) => s.panOffset);
  const setZoom = useImageEditorStore((s) => s.setZoom);
  const setPanOffset = useImageEditorStore((s) => s.setPanOffset);
  const activeAction = useImageEditorStore((s) => s.activeAction);
  const activeTool = useImageEditorStore((s) => s.activeTool);
  const brushSize = useImageEditorStore((s) => s.brushSize);
  const addMaskOperation = useImageEditorStore((s) => s.addMaskOperation);
  const maskOperations = useImageEditorStore((s) => s.maskOperations);

  // Drawing state refs (not in store — ephemeral per stroke)
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const brushPointsRef = useRef<number[][]>([]);
  const [drawPreview, setDrawPreview] = useState<{
    type: 'rect' | 'circle';
    x: number; y: number; w: number; h: number;
  } | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Fit image to container on load
  useEffect(() => {
    if (!imageLoaded || !containerRef.current) return;
    const container = containerRef.current;
    const pad = IMAGE_EDITOR.canvas.padding;
    const scaleX = (container.clientWidth - pad * 2) / imageWidth;
    const scaleY = (container.clientHeight - pad * 2) / imageHeight;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    setZoom(fitZoom);
    setPanOffset({
      x: (container.clientWidth - imageWidth * fitZoom) / 2,
      y: (container.clientHeight - imageHeight * fitZoom) / 2,
    });
  }, [imageLoaded, imageWidth, imageHeight]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !containerRef.current) return;

    const container = containerRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = `${container.clientWidth}px`;
    canvas.style.height = `${container.clientHeight}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, container.clientWidth, container.clientHeight);

    // Draw image
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
    ctx.restore();
  }, [imageLoaded, zoom, panOffset, imageWidth, imageHeight, maskOperations]);

  // Mouse → image coordinates
  const screenToImage = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom,
    };
  }, [zoom, panOffset]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
    const scale = newZoom / zoom;
    setPanOffset({
      x: mx - (mx - panOffset.x) * scale,
      y: my - (my - panOffset.y) * scale,
    });
    setZoom(newZoom);
  }, [zoom, panOffset, setZoom, setPanOffset]);

  // Pointer events for mask drawing
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (activeAction !== 'inpaint') return;
    if (e.button !== 0) return;

    const pos = screenToImage(e.clientX, e.clientY);
    isDrawingRef.current = true;
    drawStartRef.current = pos;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      brushPointsRef.current = [[pos.x, pos.y]];
    }
  }, [activeAction, activeTool, screenToImage]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || activeAction !== 'inpaint') return;

    const pos = screenToImage(e.clientX, e.clientY);
    const start = drawStartRef.current!;

    if (activeTool === 'rect' || activeTool === 'circle') {
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      setDrawPreview({ type: activeTool, x, y, w, h });
    } else if (activeTool === 'brush' || activeTool === 'eraser') {
      brushPointsRef.current.push([pos.x, pos.y]);
    }
  }, [activeAction, activeTool, screenToImage]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const start = drawStartRef.current;
    if (!start) return;

    if (activeTool === 'rect' && drawPreview) {
      if (drawPreview.w > imageWidth * 0.02 && drawPreview.h > imageHeight * 0.02) {
        addMaskOperation({
          type: 'rect',
          x: drawPreview.x / imageWidth,
          y: drawPreview.y / imageHeight,
          w: drawPreview.w / imageWidth,
          h: drawPreview.h / imageHeight,
        });
      }
    } else if (activeTool === 'circle' && drawPreview) {
      if (drawPreview.w > imageWidth * 0.02 && drawPreview.h > imageHeight * 0.02) {
        addMaskOperation({
          type: 'circle',
          cx: (drawPreview.x + drawPreview.w / 2) / imageWidth,
          cy: (drawPreview.y + drawPreview.h / 2) / imageHeight,
          rx: (drawPreview.w / 2) / imageWidth,
          ry: (drawPreview.h / 2) / imageHeight,
        });
      }
    } else if (activeTool === 'brush' || activeTool === 'eraser') {
      const pts = brushPointsRef.current;
      if (pts.length > 1) {
        addMaskOperation({
          type: activeTool,
          points: pts.map(([x, y]) => [x / imageWidth, y / imageHeight]),
          size: brushSize / imageWidth,
        });
      }
    }

    setDrawPreview(null);
    drawStartRef.current = null;
    brushPointsRef.current = [];
  }, [activeTool, drawPreview, imageWidth, imageHeight, brushSize, addMaskOperation]);

  // Cursor style
  const getCursor = () => {
    if (activeAction !== 'inpaint') return 'default';
    if (activeTool === 'brush' || activeTool === 'eraser') return 'none';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: getCursor() }}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Mask preview overlay */}
      <MaskPreview
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        zoom={zoom}
        panOffset={panOffset}
        drawPreview={drawPreview}
      />

      {/* Expand handles */}
      <ExpandHandles
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        zoom={zoom}
        panOffset={panOffset}
      />

      {/* Custom brush cursor */}
      {activeAction === 'inpaint' && (activeTool === 'brush' || activeTool === 'eraser') && (
        <div
          className="pointer-events-none fixed rounded-full border"
          style={{
            width: brushSize * zoom,
            height: brushSize * zoom,
            borderColor: activeTool === 'eraser'
              ? 'rgba(255, 100, 100, 0.6)'
              : IMAGE_EDITOR.brush.cursorColor,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  );
};
