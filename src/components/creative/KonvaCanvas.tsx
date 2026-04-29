import React, { forwardRef, useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Line } from 'react-konva';
import { KonvaTextLayer } from './layers/KonvaTextLayer';
import { KonvaLogoLayer } from './layers/KonvaLogoLayer';
import { KonvaShapeLayer } from './layers/KonvaShapeLayer';
import useImage from 'use-image';
import type Konva from 'konva';
import { useCreativeStore } from './store/creativeStore';
import { LassoTool } from './LassoTool';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { useSmartGuides } from './lib/useSmartGuides';
import { useCanvasViewport } from './lib/useCanvasViewport';
import { intersectingLayerIds } from './lib/marqueeIntersect';
import { CreativeContextMenu } from './CreativeContextMenu';
import { CameraControls } from './CameraControls';
import { SelectionHud } from './SelectionHud';

interface Props {
  width: number;
  height: number;
  accentColor: string;
  defaultFont: string;
  onOpenCheatsheet?: () => void;
}

export const KonvaCanvas = forwardRef<Konva.Stage, Props>(
  ({ width, height, accentColor, defaultFont, onOpenCheatsheet }, ref) => {
    const backgroundUrl = useCreativeStore((s) => s.backgroundUrl);
    const overlay = useCreativeStore((s) => s.overlay);
    const layers = useCreativeStore((s) => s.layers);
    const selectedLayerIds = useCreativeStore((s) => s.selectedLayerIds);
    const addLayer = useCreativeStore((s) => s.addLayer);
    const setSelectedLayerIds = useCreativeStore((s) => s.setSelectedLayerIds);
    const setBackgroundSelected = useCreativeStore((s) => s.setBackgroundSelected);
    const activeTool = useCreativeStore((s) => s.activeTool);
    const gridEnabled = useCreativeStore((s) => s.gridEnabled);
    const gridSize = useCreativeStore((s) => s.gridSize);

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

    // Smart guides — drag/transform snap to layer + canvas edges/centers,
    // plus optional grid snap (single source of truth: useCreativeStore.gridEnabled/gridSize)
    const { guides, onDragMove, onTransform, clear: clearGuides, setDraggingIds } =
      useSmartGuides({
        stageWidth: width,
        stageHeight: height,
        shapeRefs,
        gridSize: gridEnabled ? gridSize : 0,
      });

    // Resize is proportional by default; Ctrl/Cmd held = free distortion (side
    // anchors enabled, ratio unlocked). Mirrors Figma's Shift-to-toggle but
    // inverted per UX request — distortion should be the deliberate choice.
    const [allowDistort, setAllowDistort] = useState(false);
    useEffect(() => {
      const sync = (e: KeyboardEvent) => setAllowDistort(e.ctrlKey || e.metaKey);
      const reset = () => setAllowDistort(false);
      window.addEventListener('keydown', sync);
      window.addEventListener('keyup', sync);
      window.addEventListener('blur', reset);
      return () => {
        window.removeEventListener('keydown', sync);
        window.removeEventListener('keyup', sync);
        window.removeEventListener('blur', reset);
      };
    }, []);

    const handleDragStart = useCallback(
      (id: string) => {
        // Single-drag: only the dragged node is excluded from guide sources.
        // Multi-drag is uncommon in current UX and would need group-bounds snap;
        // out of scope for now.
        setDraggingIds([id]);
      },
      [setDraggingIds]
    );

    // Viewport: zoom + pan via wheel and Space-drag (Konva official pattern).
    const viewport = useCanvasViewport(stageRef);

    // Marquee selection — Figma-style drag in empty area to multi-select.
    const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
      null
    );
    const marqueeStartRef = useRef<{ x: number; y: number; movedFar: boolean } | null>(null);
    const blockNextClickRef = useRef(false);

    const lockedLookup = useCallback(
      (id: string) => layers.find((l) => l.id === id)?.locked ?? false,
      [layers]
    );

    /** Convert screen-stage pointer to creative-coords (undo viewport transform). */
    const stagePointer = useCallback(() => {
      const stage = stageRef.current;
      if (!stage) return null;
      const p = stage.getPointerPosition();
      if (!p) return null;
      const sx = stage.scaleX() || 1;
      return { x: (p.x - stage.x()) / sx, y: (p.y - stage.y()) / sx };
    }, []);

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

    // Background-click -> setBackgroundSelected. Skipped when a marquee just
    // committed a selection (otherwise the trailing click would deselect again).
    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (blockNextClickRef.current) {
        blockNextClickRef.current = false;
        return;
      }
      if (e.target === e.target.getStage()) {
        setBackgroundSelected(true);
      }
    };

    const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return;
      if (viewport.onPanStart(e)) return;
      if (activeTool !== 'select') return;
      if (e.target !== e.target.getStage()) return;
      const p = stagePointer();
      if (!p) return;
      marqueeStartRef.current = { x: p.x, y: p.y, movedFar: false };
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    };

    const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (viewport.isPanning) {
        viewport.onPanMove();
        return;
      }
      const start = marqueeStartRef.current;
      if (!start) return;
      const p = stagePointer();
      if (!p) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) start.movedFar = true;
      setMarquee({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      });
      // Smart-guide hover refresh when nothing is being dragged: not needed.
      void e;
    };

    const handleStageMouseUp = () => {
      if (viewport.isPanning) {
        viewport.onPanEnd();
        return;
      }
      const start = marqueeStartRef.current;
      marqueeStartRef.current = null;
      const rect = marquee;
      setMarquee(null);
      if (!start) return;
      if (!start.movedFar || !rect || rect.w < 3 || rect.h < 3) return;
      // Marquee is already in stage-inner (logical) coords; intersection helper
      // queries node bounds in the same space, so no conversion needed.
      const ids = intersectingLayerIds(
        { x: rect.x, y: rect.y, width: rect.w, height: rect.h },
        shapeRefs.current,
        lockedLookup
      );
      if (ids.length) {
        setSelectedLayerIds(ids);
        blockNextClickRef.current = true;
      } else {
        setSelectedLayerIds([]);
        blockNextClickRef.current = true;
      }
    };

    // Right-click context menu — resolve clicked layer by walking up to a node we registered.
    const [ctx, setCtx] = React.useState<{ x: number; y: number; layerId: string | null } | null>(
      null
    );
    const handleContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const target = e.target;
      let layerId: string | null = null;
      shapeRefs.current.forEach((node, id) => {
        if (node === target) layerId = id;
      });
      // If right-clicked on a layer not yet selected, select it (matches Figma/Canva).
      if (layerId && !selectedLayerIds.includes(layerId)) {
        setSelectedLayerIds([layerId]);
      }
      const pointer = stage.getPointerPosition();
      const box = stage.container().getBoundingClientRect();
      const screenX = (pointer?.x ?? 0) + box.left;
      const screenY = (pointer?.y ?? 0) + box.top;
      setCtx({ x: screenX, y: screenY, layerId });
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
        <Stage
          ref={setStageRef}
          width={width}
          height={height}
          onClick={handleStageClick}
          onContextMenu={handleContextMenu}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onWheel={viewport.onWheel}
        >
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
                onDragStart: handleDragStart,
                onSmartDragMove: onDragMove,
                onSmartTransform: onTransform,
                onSmartClear: clearGuides,
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
              keepRatio={!allowDistort}
              enabledAnchors={
                allowDistort
                  ? [
                      'top-left', 'top-center', 'top-right',
                      'middle-left', 'middle-right',
                      'bottom-left', 'bottom-center', 'bottom-right',
                    ]
                  : ['top-left', 'top-right', 'bottom-left', 'bottom-right']
              }
              rotateEnabled
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              rotationSnapTolerance={5}
              anchorSize={8}
              borderStroke="rgba(0,229,255,0.8)"
              anchorStroke="rgba(0,229,255,0.8)"
              anchorFill="#0a0a0a"
            />

            {/* Optional grid overlay — drawn above content, below transformer */}
            {gridEnabled && gridSize > 0 && (
              <>
                {Array.from({ length: Math.floor(width / gridSize) + 1 }, (_, i) => (
                  <Line
                    key={`gx${i}`}
                    points={[i * gridSize, 0, i * gridSize, height]}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                    listening={false}
                  />
                ))}
                {Array.from({ length: Math.floor(height / gridSize) + 1 }, (_, i) => (
                  <Line
                    key={`gy${i}`}
                    points={[0, i * gridSize, width, i * gridSize]}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                    listening={false}
                  />
                ))}
              </>
            )}

            {/* Smart guide overlay — magenta lines, drawn last so they sit above content */}
            {guides.map((g, i) => (
              <Line
                key={i}
                points={[g.start.x, g.start.y, g.end.x, g.end.y]}
                stroke="#ff00ff"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            ))}

            {/* Marquee rectangle — visible while dragging in empty area */}
            {marquee && (
              <Rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.w}
                height={marquee.h}
                fill="rgba(0,229,255,0.08)"
                stroke="rgba(0,229,255,0.8)"
                strokeWidth={1}
                listening={false}
              />
            )}
          </Layer>
        </Stage>

        {/* LassoTool — DOM overlay sibling of Stage, reads getBoundingClientRect() from parent div */}
        <LassoTool canvasWidth={width} canvasHeight={height} />

        {ctx && <CreativeContextMenu state={ctx} onClose={() => setCtx(null)} />}

        {/* Selection HUD — floating bar over selection with X/Y/W/H/° */}
        <SelectionHud
          canvasWidth={width}
          canvasHeight={height}
          viewportScale={viewport.viewport.scale}
          viewportX={viewport.viewport.x}
          viewportY={viewport.viewport.y}
          shapeRefs={shapeRefs}
        />

        {/* Distortion hint — only while Ctrl is held with a selection active */}
        {allowDistort && selectedLayerIds.length > 0 && (
          <div className="pointer-events-none absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-cyan-300 border border-cyan-400/30">
            Distort
          </div>
        )}

        <CameraControls
          scale={viewport.viewport.scale}
          onZoomIn={viewport.zoomIn}
          onZoomOut={viewport.zoomOut}
          onZoomReset={viewport.zoomTo100}
          onCheatsheet={() => onOpenCheatsheet?.()}
        />
      </div>
    );
  }
);

KonvaCanvas.displayName = 'KonvaCanvas';
