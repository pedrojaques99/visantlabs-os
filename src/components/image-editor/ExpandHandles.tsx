import React from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';
import { useExpandDrag } from '@/hooks/image-editor/useExpandDrag';
import { IMAGE_EDITOR } from '@/constants/imageEditorTokens';

interface Props {
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  panOffset: { x: number; y: number };
}

export const ExpandHandles: React.FC<Props> = ({
  imageWidth,
  imageHeight,
  zoom,
  panOffset,
}) => {
  const activeAction = useImageEditorStore((s) => s.activeAction);
  const expandEdges = useImageEditorStore((s) => s.expandEdges);
  const isGenerating = useImageEditorStore((s) => s.isGenerating);
  const { handleEdgeDown } = useExpandDrag({ imageWidth, imageHeight, zoom });

  if (activeAction !== 'expand' || isGenerating) return null;

  const imgLeft = panOffset.x;
  const imgTop = panOffset.y;
  const imgW = imageWidth * zoom;
  const imgH = imageHeight * zoom;

  const t = expandEdges.top * zoom;
  const r = expandEdges.right * zoom;
  const b = expandEdges.bottom * zoom;
  const l = expandEdges.left * zoom;

  const thickness = IMAGE_EDITOR.expand.handleThickness;
  const hasExpansion = t > 0 || r > 0 || b > 0 || l > 0;

  const totalW = imgW + l + r;
  const totalH = imgH + t + b;

  return (
    <>
      {/* Expansion zones */}
      {t > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: imgLeft - l,
            top: imgTop - t,
            width: totalW,
            height: t,
            background: `repeating-conic-gradient(${IMAGE_EDITOR.expand.checkerLight} 0% 25%, ${IMAGE_EDITOR.expand.checkerDark} 0% 50%) 0 0 / ${IMAGE_EDITOR.expand.checkerSize}px ${IMAGE_EDITOR.expand.checkerSize}px`,
            border: `1px dashed ${IMAGE_EDITOR.expand.zoneBorder}`,
            borderBottom: 'none',
          }}
        />
      )}
      {b > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: imgLeft - l,
            top: imgTop + imgH,
            width: totalW,
            height: b,
            background: `repeating-conic-gradient(${IMAGE_EDITOR.expand.checkerLight} 0% 25%, ${IMAGE_EDITOR.expand.checkerDark} 0% 50%) 0 0 / ${IMAGE_EDITOR.expand.checkerSize}px ${IMAGE_EDITOR.expand.checkerSize}px`,
            border: `1px dashed ${IMAGE_EDITOR.expand.zoneBorder}`,
            borderTop: 'none',
          }}
        />
      )}
      {l > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: imgLeft - l,
            top: imgTop,
            width: l,
            height: imgH,
            background: `repeating-conic-gradient(${IMAGE_EDITOR.expand.checkerLight} 0% 25%, ${IMAGE_EDITOR.expand.checkerDark} 0% 50%) 0 0 / ${IMAGE_EDITOR.expand.checkerSize}px ${IMAGE_EDITOR.expand.checkerSize}px`,
            border: `1px dashed ${IMAGE_EDITOR.expand.zoneBorder}`,
            borderRight: 'none',
          }}
        />
      )}
      {r > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: imgLeft + imgW,
            top: imgTop,
            width: r,
            height: imgH,
            background: `repeating-conic-gradient(${IMAGE_EDITOR.expand.checkerLight} 0% 25%, ${IMAGE_EDITOR.expand.checkerDark} 0% 50%) 0 0 / ${IMAGE_EDITOR.expand.checkerSize}px ${IMAGE_EDITOR.expand.checkerSize}px`,
            border: `1px dashed ${IMAGE_EDITOR.expand.zoneBorder}`,
            borderLeft: 'none',
          }}
        />
      )}

      {/* Drag handles */}
      {/* Top */}
      <div
        className="absolute z-20 opacity-60 hover:opacity-100 hover:scale-y-150 active:opacity-100 transition-all duration-150"
        style={{
          left: imgLeft + imgW * 0.25,
          top: imgTop - t - thickness / 2,
          width: imgW * 0.5,
          height: thickness,
          cursor: 'ns-resize',
          backgroundColor: IMAGE_EDITOR.expand.zoneBorder,
          borderRadius: thickness / 2,
        }}
        onPointerDown={(e) => handleEdgeDown('top', e)}
      />
      {/* Bottom */}
      <div
        className="absolute z-20 opacity-60 hover:opacity-100 hover:scale-y-150 active:opacity-100 transition-all duration-150"
        style={{
          left: imgLeft + imgW * 0.25,
          top: imgTop + imgH + b - thickness / 2,
          width: imgW * 0.5,
          height: thickness,
          cursor: 'ns-resize',
          backgroundColor: IMAGE_EDITOR.expand.zoneBorder,
          borderRadius: thickness / 2,
        }}
        onPointerDown={(e) => handleEdgeDown('bottom', e)}
      />
      {/* Left */}
      <div
        className="absolute z-20 opacity-60 hover:opacity-100 hover:scale-x-150 active:opacity-100 transition-all duration-150"
        style={{
          left: imgLeft - l - thickness / 2,
          top: imgTop + imgH * 0.25,
          width: thickness,
          height: imgH * 0.5,
          cursor: 'ew-resize',
          backgroundColor: IMAGE_EDITOR.expand.zoneBorder,
          borderRadius: thickness / 2,
        }}
        onPointerDown={(e) => handleEdgeDown('left', e)}
      />
      {/* Right */}
      <div
        className="absolute z-20 opacity-60 hover:opacity-100 hover:scale-x-150 active:opacity-100 transition-all duration-150"
        style={{
          left: imgLeft + imgW + r - thickness / 2,
          top: imgTop + imgH * 0.25,
          width: thickness,
          height: imgH * 0.5,
          cursor: 'ew-resize',
          backgroundColor: IMAGE_EDITOR.expand.zoneBorder,
          borderRadius: thickness / 2,
        }}
        onPointerDown={(e) => handleEdgeDown('right', e)}
      />

      {/* Dimension label */}
      {hasExpansion && (
        <div
          className="absolute z-20 flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900/80 text-[10px] font-mono text-neutral-400 pointer-events-none"
          style={{
            left: imgLeft + imgW / 2 - 60,
            top: imgTop - t - 24,
          }}
        >
          {imageWidth}×{imageHeight}
          <span className="text-brand-cyan">→</span>
          {imageWidth + expandEdges.left + expandEdges.right}×
          {imageHeight + expandEdges.top + expandEdges.bottom}
        </div>
      )}
    </>
  );
};
