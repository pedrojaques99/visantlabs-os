import React, { useRef, useEffect, useState } from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import { useCreativeStore } from '../store/creativeStore';
import { stripAccent } from '../lib/parseAccent';
import { normalizePoint, normalizeSize } from '@/lib/pixel';
import type { CreativeLayer, TextLayerData } from '../store/creativeTypes';

interface Props {
  layer: CreativeLayer & { data: TextLayerData };
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  accentColor: string; // accepted for future use — accent rendering deferred
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, extend: boolean) => void;
  onDragStart?: (id: string) => void;
  onSmartDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onSmartTransform?: (e: Konva.KonvaEventObject<Event>) => void;
  onSmartClear?: () => void;
}

const KonvaTextLayerImpl: React.FC<Props> = ({
  layer,
  canvasWidth,
  canvasHeight,
  isSelected,
  accentColor,
  registerNode,
  onSelect,
  onDragStart,
  onSmartDragMove,
  onSmartTransform,
  onSmartClear,
}) => {
  void isSelected; // kept in contract — unused for Text rendering at this stage
  void accentColor; // accent rendering deferred per RESEARCH.md scope decision
  const updateLayer = useCreativeStore((s) => s.updateLayer);
  const shapeRef = useRef<Konva.Text>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  void isEditing; // state is used only to track internal edit lifecycle
  const { data } = layer;

  // fontSize stored at 1080px reference height — same scaling rule as DOM TextLayer.tsx
  const scaledFontSize = (data.fontSize / 1080) * canvasHeight;
  const displayText = stripAccent(data.content); // accent rendering deferred

  // Register on mount, unregister on unmount / id-change
  useEffect(() => {
    registerNode(layer.id, shapeRef.current);
    return () => registerNode(layer.id, null);
  }, [layer.id, registerNode]);

  // Cleanup textarea if component unmounts mid-edit
  useEffect(() => {
    return () => {
      if (textareaRef.current && textareaRef.current.parentNode) {
        textareaRef.current.parentNode.removeChild(textareaRef.current);
        textareaRef.current = null;
      }
    };
  }, []);

  const handleDblClick = () => {
    const textNode = shapeRef.current;
    if (!textNode) return;
    const stage = textNode.getStage();
    if (!stage) return;

    const stageBox = stage.container().getBoundingClientRect();
    const absPos = textNode.absolutePosition();

    textNode.hide();
    setIsEditing(true);

    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    textareaRef.current = ta;

    ta.value = displayText;
    ta.style.position = 'absolute';
    ta.style.top = `${stageBox.top + absPos.y + window.scrollY}px`;
    ta.style.left = `${stageBox.left + absPos.x + window.scrollX}px`;
    ta.style.width = `${textNode.width() - textNode.padding() * 2}px`;
    ta.style.height = `${textNode.height() - textNode.padding() * 2 + 5}px`;
    ta.style.fontSize = `${scaledFontSize}px`;
    ta.style.fontFamily = data.fontFamily;
    ta.style.fontWeight = data.bold ? '700' : '400';
    ta.style.color = data.color;
    ta.style.background = 'transparent';
    ta.style.border = '1px solid rgba(0,229,255,0.4)';
    ta.style.padding = '0';
    ta.style.margin = '0';
    ta.style.overflow = 'hidden';
    ta.style.outline = 'none';
    ta.style.resize = 'none';
    ta.style.lineHeight = '1.05';
    ta.style.textAlign = data.align;
    ta.style.zIndex = '9999';
    ta.style.transformOrigin = 'left top';
    ta.focus();
    ta.select();

    const commit = (cancel = false) => {
      if (textareaRef.current !== ta) return; // already cleaned up
      if (!cancel) {
        updateLayer(layer.id, { content: ta.value } as Partial<TextLayerData>);
      }
      ta.removeEventListener('keydown', onKeyDown);
      ta.removeEventListener('blur', onBlur);
      if (ta.parentNode) ta.parentNode.removeChild(ta);
      textareaRef.current = null;
      textNode.show();
      setIsEditing(false);
      textNode.getLayer()?.batchDraw();
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        commit(true);
      } else if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        commit(false);
      }
    };
    const onBlur = () => commit(false);

    ta.addEventListener('keydown', onKeyDown);
    ta.addEventListener('blur', onBlur);
  };

  return (
    <Text
      ref={shapeRef}
      text={displayText}
      x={data.position.x * canvasWidth}
      y={data.position.y * canvasHeight}
      width={data.size.w * canvasWidth}
      height={data.size.h * canvasHeight}
      rotation={data.rotation ?? 0}
      fontSize={scaledFontSize}
      fontFamily={data.fontFamily}
      fontStyle={data.bold ? 'bold' : 'normal'}
      textDecoration={
        [data.underline ? 'underline' : '', data.strikethrough ? 'line-through' : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
      fill={data.color}
      align={data.align}
      lineHeight={1.05}
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
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
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
              w: Math.max(20, node.width() * scaleX),
              h: Math.max(20, node.height() * scaleY),
            },
            { w: canvasWidth, h: canvasHeight }
          ),
          rotation: node.rotation(),
        });
      }}
    />
  );
};

// Layer ref equality is enough — store updates via .map preserve identity for
// untouched layers, so memoization skips re-render when sibling layers change.
export const KonvaTextLayer = React.memo(KonvaTextLayerImpl, (prev, next) =>
  prev.layer === next.layer &&
  prev.isSelected === next.isSelected &&
  prev.canvasWidth === next.canvasWidth &&
  prev.canvasHeight === next.canvasHeight &&
  prev.accentColor === next.accentColor &&
  prev.registerNode === next.registerNode &&
  prev.onSelect === next.onSelect &&
  prev.onDragStart === next.onDragStart &&
  prev.onSmartDragMove === next.onSmartDragMove &&
  prev.onSmartTransform === next.onSmartTransform &&
  prev.onSmartClear === next.onSmartClear
);
