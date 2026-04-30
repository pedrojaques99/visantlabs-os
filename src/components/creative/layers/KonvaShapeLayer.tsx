import React, { useRef, useEffect } from 'react';
import { Rect } from 'react-konva';
import type Konva from 'konva';
import { useCreativeStore } from '../store/creativeStore';
import { normalizePoint, normalizeSize } from '@/lib/pixel';
import type { CreativeLayer, ShapeLayerData } from '../store/creativeTypes';

interface Props {
  layer: CreativeLayer & { data: ShapeLayerData };
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, extend: boolean) => void;
  onDragStart?: (id: string) => void;
  onSmartDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onSmartTransform?: (e: Konva.KonvaEventObject<Event>) => void;
  onSmartClear?: () => void;
}

const KonvaShapeLayerImpl: React.FC<Props> = ({
  layer,
  canvasWidth,
  canvasHeight,
  isSelected,
  registerNode,
  onSelect,
  onDragStart,
  onSmartDragMove,
  onSmartTransform,
  onSmartClear,
}) => {
  void isSelected; // kept in contract for symmetry — unused for Rect rendering
  const updateLayer = useCreativeStore((s) => s.updateLayer);
  const shapeRef = useRef<Konva.Rect>(null);
  const { data } = layer;

  // Register on mount, unregister on unmount / id-change
  useEffect(() => {
    registerNode(layer.id, shapeRef.current);
    return () => registerNode(layer.id, null);
  }, [layer.id, registerNode]);

  return (
    <Rect
      ref={shapeRef}
      x={data.position.x * canvasWidth}
      y={data.position.y * canvasHeight}
      width={data.size.w * canvasWidth}
      height={data.size.h * canvasHeight}
      rotation={data.rotation ?? 0}
      fill={data.color}
      cornerRadius={data.cornerRadius ?? 0}
      stroke={data.strokeWidth ? data.strokeColor : undefined}
      strokeWidth={data.strokeWidth ?? 0}
      opacity={data.opacity ?? 1}
      shadowColor={data.shadowColor}
      shadowBlur={data.shadowBlur ?? 0}
      shadowOffsetX={data.shadowOffsetX ?? 0}
      shadowOffsetY={data.shadowOffsetY ?? 0}
      draggable={!layer.locked}
      listening={!layer.locked}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = layer.locked ? 'not-allowed' : 'move';
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = '';
      }}
      onClick={(e) => onSelect(layer.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(layer.id, e.evt.shiftKey)}
      onDragStart={() => onDragStart?.(layer.id)}
      onDragMove={(e) => onSmartDragMove?.(e)}
      onTransform={(e) => onSmartTransform?.(e)}
      onDragEnd={(e) => {
        onSmartClear?.();
        updateLayer(layer.id, {
          position: normalizePoint(
            { x: e.target.x(), y: e.target.y() },
            { w: canvasWidth, h: canvasHeight }
          ),
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current!;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        // CRITICAL: reset scale to 1 and fold into width/height (Pitfall 1)
        node.scaleX(1);
        node.scaleY(1);
        onSmartClear?.();
        updateLayer(layer.id, {
          position: normalizePoint(
            { x: node.x(), y: node.y() },
            { w: canvasWidth, h: canvasHeight }
          ),
          size: normalizeSize(
            {
              w: Math.max(1, node.width() * scaleX),
              h: Math.max(1, node.height() * scaleY),
            },
            { w: canvasWidth, h: canvasHeight }
          ),
          rotation: node.rotation(),
        });
      }}
    />
  );
};

export const KonvaShapeLayer = React.memo(KonvaShapeLayerImpl, (prev, next) =>
  prev.layer === next.layer &&
  prev.isSelected === next.isSelected &&
  prev.canvasWidth === next.canvasWidth &&
  prev.canvasHeight === next.canvasHeight &&
  prev.registerNode === next.registerNode &&
  prev.onSelect === next.onSelect &&
  prev.onDragStart === next.onDragStart &&
  prev.onSmartDragMove === next.onSmartDragMove &&
  prev.onSmartTransform === next.onSmartTransform &&
  prev.onSmartClear === next.onSmartClear
);
