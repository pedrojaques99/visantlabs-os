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
  onDragStart?: (id: string) => void;
  onSmartDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onSmartTransform?: (e: Konva.KonvaEventObject<Event>) => void;
  onSmartClear?: () => void;
}

const KonvaLogoLayerImpl: React.FC<Props> = ({
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

  // Filters require node.cache(). Re-apply when filter values, image, or
  // node dimensions change — without size deps, resizing a filtered logo
  // would render a stretched copy of the stale cache.
  const filters = data.filters;
  const filterKey = useMemo(
    () => JSON.stringify(filters ?? {}) + (image ? '_img' : '_no'),
    [filters, image]
  );
  useEffect(() => {
    const node = shapeRef.current;
    if (!node || !image) return;
    if (!filters || (
      !filters.brightness && !filters.contrast && !filters.blur && !filters.grayscale
    )) {
      node.clearCache();
      node.filters([]);
      node.getLayer()?.batchDraw();
      return;
    }
    // Konva.Filters.* runtime values are Filter functions; TS types use the
    // exported Filter alias. Casting through unknown[] keeps the assignment
    // honest without dragging the alias into our store types.
    const list: unknown[] = [];
    if (filters.brightness) list.push(Konva.Filters.Brighten);
    if (filters.contrast) list.push(Konva.Filters.Contrast);
    if (filters.blur) list.push(Konva.Filters.Blur);
    if (filters.grayscale) list.push(Konva.Filters.Grayscale);
    node.cache();
    node.filters(list as Parameters<typeof node.filters>[0]);
    node.getLayer()?.batchDraw();
  }, [filterKey, filters, image, data.size.w, data.size.h]);

  // Crop is normalized 0-1 of source image; convert to pixels expected by Konva.
  const cropPx = useMemo(() => {
    const c = data.crop;
    if (!c || !image) return undefined;
    return {
      x: c.x * image.width,
      y: c.y * image.height,
      width: c.w * image.width,
      height: c.h * image.height,
    };
  }, [data.crop, image]);

  return (
    <KonvaImage
      ref={shapeRef}
      image={image}
      x={data.position.x * canvasWidth}
      y={data.position.y * canvasHeight}
      width={data.size.w * canvasWidth}
      height={data.size.h * canvasHeight}
      rotation={data.rotation ?? 0}
      opacity={data.opacity ?? 1}
      crop={cropPx}
      brightness={data.filters?.brightness ?? 0}
      contrast={data.filters?.contrast ?? 0}
      blurRadius={data.filters?.blur ?? 0}
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

export const KonvaLogoLayer = React.memo(KonvaLogoLayerImpl, (prev, next) =>
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
