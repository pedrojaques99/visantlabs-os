import React, { forwardRef, useRef, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from 'react-konva';
import { KonvaTextLayer } from './layers/KonvaTextLayer';
import { KonvaLogoLayer } from './layers/KonvaLogoLayer';
import { KonvaShapeLayer } from './layers/KonvaShapeLayer';
import useImage from 'use-image';
import Konva from 'konva';
import { useCreativeStore } from './store/creativeStore';
import { LassoTool } from './LassoTool';
import { getProxiedUrl } from '@/utils/proxyUtils';

interface Props {
  width: number;
  height: number;
  accentColor: string;
  defaultFont: string;
}

export const KonvaCanvas = forwardRef<Konva.Stage, Props>(
  ({ width, height, accentColor, defaultFont }, ref) => {
    const {
      backgroundUrl,
      overlay,
      layers,
      selectedLayerIds,
      addLayer,
      setSelectedLayerIds,
      setBackgroundSelected,
    } = useCreativeStore();

    // Shared Transformer ref
    const trRef = useRef<Konva.Transformer>(null);

    // Per-layer node ref map (Wave 3 layer components write into this via registration callback)
    const shapeRefs = useRef<Map<string, Konva.Node>>(new Map());

    // Internal stage ref for drag-drop bounds calculation
    const stageRef = useRef<Konva.Stage>(null);

    // Double-ref forwarding: keep internal stageRef and also forward to caller
    const setStageRef = (node: Konva.Stage | null) => {
      stageRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<Konva.Stage | null>).current = node;
    };

    // Memoize proxied bg URL to prevent useImage re-render loop (RESEARCH Pitfall 5)
    const proxiedBgUrl = useMemo(
      () => (backgroundUrl ? getProxiedUrl(backgroundUrl) : ''),
      [backgroundUrl]
    );
    const [bgImage] = useImage(proxiedBgUrl, 'anonymous');

    // Sync selection -> Transformer (RESEARCH Pattern 2)
    useEffect(() => {
      if (!trRef.current) return;
      const nodes = selectedLayerIds
        .map((id) => shapeRefs.current.get(id))
        .filter((n): n is Konva.Node => !!n);
      trRef.current.nodes(nodes);
      trRef.current.getLayer()?.batchDraw();
    }, [selectedLayerIds, layers]);

    // Stable registerNode callback — layers write themselves into shapeRefs via this
    const registerNode = useCallback((id: string, node: Konva.Node | null) => {
      if (node) shapeRefs.current.set(id, node);
      else shapeRefs.current.delete(id);
    }, []);

    // Stable selection callback — defers to store
    const handleSelect = useCallback(
      (id: string, extend: boolean) => {
        setSelectedLayerIds([id], extend);
      },
      [setSelectedLayerIds]
    );

    // Drag-drop handler — ported verbatim from CreativeCanvas.tsx
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const url = e.dataTransfer.getData('application/vsn-asset-url');
      const type = e.dataTransfer.getData('application/vsn-asset-type') as
        | 'logo'
        | 'image'
        | 'text'
        | 'shape';

      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / width;
      const y = (e.clientY - rect.top) / height;

      if (type === 'text') {
        addLayer({
          type: 'text',
          content: 'Novo texto',
          role: 'body',
          position: { x: x - 0.2, y: y - 0.04 },
          size: { w: 0.4, h: 0.08 },
          align: 'left',
          fontSize: 48,
          fontFamily: defaultFont,
          color: '#ffffff',
          bold: false,
        });
      } else if (type === 'shape') {
        addLayer({
          type: 'shape',
          shape: 'rect',
          color: accentColor,
          position: { x: x - 0.075, y: y - 0.075 },
          size: { w: 0.15, h: 0.15 },
        });
      } else if (url) {
        addLayer({
          type: 'logo',
          url,
          position: { x: x - 0.1, y: y - 0.05 },
          size: type === 'logo' ? { w: 0.2, h: 0.1 } : { w: 0.4, h: 0.3 },
        });
      }
    };

    // Background-click -> setBackgroundSelected (preserves CreativeCanvas.tsx lines 94-98 behavior)
    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        setBackgroundSelected(true);
      }
    };

    // Overlay rendering logic — ported to Konva Rect (RESEARCH Pattern 7)
    const renderOverlay = () => {
      if (!overlay) return null;

      if (overlay.type === 'solid') {
        return (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={overlay.color ?? '#000000'}
            opacity={overlay.opacity}
            listening={false}
          />
        );
      }

      // Gradient — map direction to start/end points
      const dir = overlay.direction ?? 'bottom';
      let startPoint: { x: number; y: number };
      let endPoint: { x: number; y: number };

      switch (dir) {
        case 'bottom': // gradient from bottom (dark) to top (transparent)
          startPoint = { x: 0, y: height };
          endPoint = { x: 0, y: 0 };
          break;
        case 'top': // gradient from top (dark) to bottom (transparent)
          startPoint = { x: 0, y: 0 };
          endPoint = { x: 0, y: height };
          break;
        case 'left': // gradient from left (dark) to right (transparent)
          startPoint = { x: 0, y: 0 };
          endPoint = { x: width, y: 0 };
          break;
        case 'right': // gradient from right (dark) to left (transparent)
          startPoint = { x: width, y: 0 };
          endPoint = { x: 0, y: 0 };
          break;
        default:
          startPoint = { x: 0, y: height };
          endPoint = { x: 0, y: 0 };
      }

      const stop = overlay.color ?? '#000000';
      return (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fillLinearGradientStartPoint={startPoint}
          fillLinearGradientEndPoint={endPoint}
          fillLinearGradientColorStops={[0, stop, 1, 'rgba(0,0,0,0)']}
          opacity={overlay.opacity}
          listening={false}
        />
      );
    };

    return (
      <div
        className="relative shadow-2xl bg-black overflow-visible selection-none"
        style={{ width, height }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Stage ref={setStageRef} width={width} height={height} onClick={handleStageClick}>
          <Layer>
            {/* Background image — bottom of stack, listening disabled */}
            {bgImage && (
              <KonvaImage
                image={bgImage}
                x={0}
                y={0}
                width={width}
                height={height}
                listening={false}
              />
            )}

            {/* Overlay rect — above background, below layers */}
            {renderOverlay()}

            {/* Layer dispatch — type-routed to Konva*Layer components */}
            {layers.filter((l) => l.visible).map((layer) => {
              const common = {
                canvasWidth: width,
                canvasHeight: height,
                isSelected: selectedLayerIds.includes(layer.id),
                registerNode,
                onSelect: handleSelect,
              };
              if (layer.data.type === 'text') {
                return (
                  <KonvaTextLayer
                    key={layer.id}
                    layer={layer as any}
                    accentColor={accentColor}
                    {...common}
                  />
                );
              }
              if (layer.data.type === 'logo') {
                return <KonvaLogoLayer key={layer.id} layer={layer as any} {...common} />;
              }
              if (layer.data.type === 'shape') {
                return <KonvaShapeLayer key={layer.id} layer={layer as any} {...common} />;
              }
              // 'group' — out of scope for this phase; skip render
              return null;
            })}

            {/* Transformer — LAST child of Layer (RESEARCH Pitfall 3) */}
            <Transformer
              ref={trRef}
              keepRatio={false}
              rotateEnabled={false}
              anchorSize={8}
              borderStroke="rgba(0,229,255,0.8)"
              anchorStroke="rgba(0,229,255,0.8)"
              anchorFill="#0a0a0a"
            />
          </Layer>
        </Stage>

        {/* LassoTool — DOM overlay sibling of Stage, reads getBoundingClientRect() from parent div */}
        <LassoTool canvasWidth={width} canvasHeight={height} />
      </div>
    );
  }
);

KonvaCanvas.displayName = 'KonvaCanvas';
