import React, { useRef, useEffect, useMemo } from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { useCreativeStore } from '../store/creativeStore';
import { normalizePoint, normalizeSize } from '@/lib/pixel';
import { getProxiedUrl } from '@/utils/proxyUtils';
import type { CreativeLayer, LogoLayerData } from '../store/creativeTypes';

interface Props {
  layer: CreativeLayer & { data: LogoLayerData };
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, extend: boolean) => void;
}

export const KonvaLogoLayer: React.FC<Props> = ({
  layer,
  canvasWidth,
  canvasHeight,
  isSelected,
  registerNode,
  onSelect,
}) => {
  void isSelected; // kept in contract for symmetry
  const updateLayer = useCreativeStore((s) => s.updateLayer);
  const shapeRef = useRef<Konva.Image>(null);
  const { data } = layer;

  // Memoize proxied URL — Pitfall 5: getProxiedUrl returns a new string per render
  const proxiedUrl = useMemo(() => getProxiedUrl(data.url), [data.url]);
  // 'anonymous' REQUIRED for stage.toDataURL export (Pitfall 2)
  const [image] = useImage(proxiedUrl, 'anonymous');

  // Register on mount, unregister on unmount / id-change
  useEffect(() => {
    registerNode(layer.id, shapeRef.current);
    return () => registerNode(layer.id, null);
  }, [layer.id, registerNode]);

  return (
    <KonvaImage
      ref={shapeRef}
      image={image}
      x={data.position.x * canvasWidth}
      y={data.position.y * canvasHeight}
      width={data.size.w * canvasWidth}
      height={data.size.h * canvasHeight}
      opacity={data.opacity ?? 1}
      shadowColor={data.shadowColor}
      shadowBlur={data.shadowBlur ?? 0}
      shadowOffsetX={data.shadowOffsetX ?? 0}
      shadowOffsetY={data.shadowOffsetY ?? 0}
      draggable
      onClick={(e) => onSelect(layer.id, e.evt.shiftKey)}
      onTap={(e) => onSelect(layer.id, e.evt.shiftKey)}
      onDragEnd={(e) => {
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
        });
      }}
    />
  );
};
