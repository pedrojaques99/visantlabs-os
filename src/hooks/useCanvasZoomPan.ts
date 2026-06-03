import { useCallback, useRef, useState, useEffect } from 'react';

interface ZoomPanStore {
  zoom: number;
  panX: number;
  panY: number;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
}

interface UseCanvasZoomPanOptions {
  getState: () => ZoomPanStore;
  minZoom?: number;
  maxZoom?: number;
  zoomFactor?: number;
}

export function useCanvasZoomPan({
  getState,
  minZoom = 0.1,
  maxZoom = 10,
  zoomFactor = 1.1,
}: UseCanvasZoomPanOptions) {
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const s = getState();
      const factor = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
      const next = Math.max(minZoom, Math.min(maxZoom, s.zoom * factor));
      s.setZoom(next);
    },
    [getState, minZoom, maxZoom, zoomFactor]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        const s = getState();
        panStart.current = { x: e.clientX, y: e.clientY, panX: s.panX, panY: s.panY };
      }
    },
    [getState]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      getState().setPan(panStart.current.panX + dx, panStart.current.panY + dy);
    },
    [isPanning, getState]
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const bindWheelToRef = useCallback(
    (container: HTMLElement | null) => {
      if (!container) return;
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    },
    [handleWheel]
  );

  const resetView = useCallback(() => {
    const s = getState();
    s.setZoom(1);
    s.setPan(0, 0);
  }, [getState]);

  return {
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave: handleMouseUp,
    bindWheelToRef,
    resetView,
  };
}
