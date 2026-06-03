import React, { useMemo } from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';
import { IMAGE_EDITOR } from '@/constants/imageEditorTokens';

interface Props {
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  panOffset: { x: number; y: number };
  drawPreview: {
    type: 'rect' | 'circle';
    x: number; y: number; w: number; h: number;
  } | null;
}

export const MaskPreview: React.FC<Props> = ({
  imageWidth,
  imageHeight,
  zoom,
  panOffset,
  drawPreview,
}) => {
  const maskOperations = useImageEditorStore((s) => s.maskOperations);
  const activeAction = useImageEditorStore((s) => s.activeAction);

  const hasMask = maskOperations.length > 0 || drawPreview;

  const clipPath = useMemo(() => {
    if (!hasMask) return undefined;

    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (const op of maskOperations) {
      if (op.type === 'rect') {
        rects.push({ x: op.x, y: op.y, w: op.w, h: op.h });
      } else if (op.type === 'circle') {
        rects.push({
          x: op.cx - op.rx,
          y: op.cy - op.ry,
          w: op.rx * 2,
          h: op.ry * 2,
        });
      } else if (op.type === 'brush') {
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const [px, py] of op.points) {
          minX = Math.min(minX, px - op.size);
          minY = Math.min(minY, py - op.size);
          maxX = Math.max(maxX, px + op.size);
          maxY = Math.max(maxY, py + op.size);
        }
        rects.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
      }
    }

    if (drawPreview) {
      rects.push({
        x: drawPreview.x / imageWidth,
        y: drawPreview.y / imageHeight,
        w: drawPreview.w / imageWidth,
        h: drawPreview.h / imageHeight,
      });
    }

    if (rects.length === 0) return undefined;

    const polygons = rects.map((r) => {
      const x1 = (r.x * 100).toFixed(2);
      const y1 = (r.y * 100).toFixed(2);
      const x2 = ((r.x + r.w) * 100).toFixed(2);
      const y2 = ((r.y + r.h) * 100).toFixed(2);
      return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${y1}%, ${x1}% ${y1}%, ${x1}% ${y2}%, ${x2}% ${y2}%, ${x2}% ${y1}%, 0% ${y1}%)`;
    });

    return polygons[0];
  }, [maskOperations, drawPreview, imageWidth, imageHeight, hasMask]);

  if (activeAction !== 'inpaint' || !hasMask) return null;

  return (
    <>
      {/* Dimmed overlay */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: panOffset.x,
          top: panOffset.y,
          width: imageWidth * zoom,
          height: imageHeight * zoom,
          backgroundColor: IMAGE_EDITOR.mask.dimOverlay,
          clipPath,
        }}
      />

      {/* Selection preview during drag */}
      {drawPreview && (
        <div
          className="absolute pointer-events-none border-2 border-dashed"
          style={{
            left: panOffset.x + drawPreview.x * zoom,
            top: panOffset.y + drawPreview.y * zoom,
            width: drawPreview.w * zoom,
            height: drawPreview.h * zoom,
            borderColor: IMAGE_EDITOR.selection.stroke,
            backgroundColor: IMAGE_EDITOR.selection.fill,
            borderRadius: drawPreview.type === 'circle' ? '50%' : 0,
          }}
        />
      )}

      {/* Existing mask regions highlight */}
      {maskOperations.map((op, i) => {
        if (op.type === 'rect') {
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: panOffset.x + op.x * imageWidth * zoom,
                top: panOffset.y + op.y * imageHeight * zoom,
                width: op.w * imageWidth * zoom,
                height: op.h * imageHeight * zoom,
                backgroundColor: IMAGE_EDITOR.mask.preview,
                border: `1px solid ${IMAGE_EDITOR.selection.stroke}`,
              }}
            />
          );
        }
        if (op.type === 'circle') {
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: panOffset.x + (op.cx - op.rx) * imageWidth * zoom,
                top: panOffset.y + (op.cy - op.ry) * imageHeight * zoom,
                width: op.rx * 2 * imageWidth * zoom,
                height: op.ry * 2 * imageHeight * zoom,
                backgroundColor: IMAGE_EDITOR.mask.preview,
                border: `1px solid ${IMAGE_EDITOR.selection.stroke}`,
                borderRadius: '50%',
              }}
            />
          );
        }
        return null;
      })}
    </>
  );
};
