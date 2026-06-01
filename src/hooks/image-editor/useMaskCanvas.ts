import { useRef, useCallback } from 'react';
import { useImageEditorStore, type MaskOperation } from '@/stores/imageEditorStore';
import { getSvgPathFromStroke } from '@/utils/drawingUtils';
import { getStroke } from 'perfect-freehand';

export function useMaskCanvas(imageWidth: number, imageHeight: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = imageWidth;
      canvasRef.current.height = imageHeight;
    }
    return canvasRef.current;
  }, [imageWidth, imageHeight]);

  const renderMask = useCallback((operations: MaskOperation[]) => {
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, imageWidth, imageHeight);

    for (const op of operations) {
      if (op.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';

      switch (op.type) {
        case 'rect': {
          ctx.fillRect(
            op.x * imageWidth,
            op.y * imageHeight,
            op.w * imageWidth,
            op.h * imageHeight,
          );
          break;
        }
        case 'circle': {
          ctx.beginPath();
          ctx.ellipse(
            op.cx * imageWidth,
            op.cy * imageHeight,
            op.rx * imageWidth,
            op.ry * imageHeight,
            0, 0, Math.PI * 2,
          );
          ctx.fill();
          break;
        }
        case 'brush':
        case 'eraser': {
          const absPoints = op.points.map(([x, y]) => [x * imageWidth, y * imageHeight]);
          const strokeSize = op.size * imageWidth;
          const stroke = getStroke(absPoints, {
            size: strokeSize,
            thinning: 0,
            smoothing: 0.5,
            streamline: 0.5,
          });
          const pathData = getSvgPathFromStroke(stroke);
          const path = new Path2D(pathData);
          ctx.fill(path);
          break;
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }, [imageWidth, imageHeight, getCanvas]);

  const exportMaskBase64 = useCallback((operations: MaskOperation[]): string => {
    const canvas = renderMask(operations);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }, [renderMask]);

  const exportMaskRegion = useCallback((operations: MaskOperation[]) => {
    if (operations.length === 0) return null;

    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const op of operations) {
      if (op.type === 'eraser') continue;
      if (op.type === 'rect') {
        minX = Math.min(minX, op.x);
        minY = Math.min(minY, op.y);
        maxX = Math.max(maxX, op.x + op.w);
        maxY = Math.max(maxY, op.y + op.h);
      } else if (op.type === 'circle') {
        minX = Math.min(minX, op.cx - op.rx);
        minY = Math.min(minY, op.cy - op.ry);
        maxX = Math.max(maxX, op.cx + op.rx);
        maxY = Math.max(maxY, op.cy + op.ry);
      } else {
        for (const [x, y] of op.points) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, []);

  const getMaskPreviewPath = useCallback((operations: MaskOperation[]): string => {
    const rects: string[] = [];
    for (const op of operations) {
      if (op.type === 'rect') {
        rects.push(`M${op.x},${op.y} h${op.w} v${op.h} h${-op.w} Z`);
      }
    }
    return rects.join(' ');
  }, []);

  return {
    renderMask,
    exportMaskBase64,
    exportMaskRegion,
    getMaskPreviewPath,
  };
}
