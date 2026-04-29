import { useCallback, useEffect, useRef, useState } from 'react';
import type Konva from 'konva';

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const SCALE_STEP = 1.1;

interface PanStart {
  pointerX: number;
  pointerY: number;
  vpX: number;
  vpY: number;
}

export interface UseCanvasViewport {
  viewport: ViewportState;
  isPanning: boolean;
  spaceHeld: boolean;
  onWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  onPanStart: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  onPanMove: () => void;
  onPanEnd: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo100: () => void;
  fitToScreen: () => void;
}

export function useCanvasViewport(
  stageRef: React.RefObject<Konva.Stage | null>
): UseCanvasViewport {
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStartRef = useRef<PanStart | null>(null);

  // Apply viewport state to the stage on every change.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: viewport.scale, y: viewport.scale });
    stage.position({ x: viewport.x, y: viewport.y });
    stage.batchDraw();
  }, [viewport, stageRef]);

  // Wheel zoom relative to pointer (Konva official pattern)
  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      setViewport((vp) => {
        const oldScale = vp.scale;
        const mousePointTo = {
          x: (pointer.x - vp.x) / oldScale,
          y: (pointer.y - vp.y) / oldScale,
        };
        // ctrlKey on wheel = pinch-zoom on trackpad; reverse axis to feel natural
        let direction = e.evt.deltaY > 0 ? -1 : 1;
        if (e.evt.ctrlKey) direction = -direction;
        const target = direction > 0 ? oldScale * SCALE_STEP : oldScale / SCALE_STEP;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, target));
        return {
          scale: newScale,
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        };
      });
    },
    [stageRef]
  );

  // Space-held pan: spaceHeld is the global flag, panStartRef is the
  // per-drag anchor. onPanStart returns true if it claimed the mousedown.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      setSpaceHeld(true);
      const stage = stageRef.current;
      if (stage) stage.container().style.cursor = 'grab';
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setSpaceHeld(false);
      setIsPanning(false);
      panStartRef.current = null;
      const stage = stageRef.current;
      if (stage) stage.container().style.cursor = '';
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [stageRef]);

  const onPanStart = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!spaceHeld) return false;
      const stage = stageRef.current;
      if (!stage) return false;
      const pointer = stage.getPointerPosition();
      if (!pointer) return false;
      panStartRef.current = {
        pointerX: pointer.x,
        pointerY: pointer.y,
        vpX: stage.x(),
        vpY: stage.y(),
      };
      setIsPanning(true);
      stage.container().style.cursor = 'grabbing';
      e.evt.preventDefault();
      return true;
    },
    [spaceHeld, stageRef]
  );

  const onPanMove = useCallback(() => {
    const start = panStartRef.current;
    if (!isPanning || !start) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const dx = pointer.x - start.pointerX;
    const dy = pointer.y - start.pointerY;
    setViewport((vp) => ({
      scale: vp.scale,
      x: start.vpX + dx,
      y: start.vpY + dy,
    }));
  }, [isPanning, stageRef]);

  const onPanEnd = useCallback(() => {
    if (!isPanning) return;
    setIsPanning(false);
    panStartRef.current = null;
    const stage = stageRef.current;
    if (stage) stage.container().style.cursor = spaceHeld ? 'grab' : '';
  }, [isPanning, spaceHeld, stageRef]);

  // Center-anchored zoom for buttons
  const zoomBy = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const cx = stage.width() / 2;
      const cy = stage.height() / 2;
      setViewport((vp) => {
        const target = vp.scale * factor;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, target));
        const mp = { x: (cx - vp.x) / vp.scale, y: (cy - vp.y) / vp.scale };
        return { scale: newScale, x: cx - mp.x * newScale, y: cy - mp.y * newScale };
      });
    },
    [stageRef]
  );

  const zoomIn = useCallback(() => zoomBy(SCALE_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / SCALE_STEP), [zoomBy]);
  const zoomTo100 = useCallback(() => setViewport({ scale: 1, x: 0, y: 0 }), []);
  const fitToScreen = useCallback(() => setViewport({ scale: 1, x: 0, y: 0 }), []);

  return {
    viewport,
    isPanning,
    spaceHeld,
    onWheel,
    onPanStart,
    onPanMove,
    onPanEnd,
    zoomIn,
    zoomOut,
    zoomTo100,
    fitToScreen,
  };
}
