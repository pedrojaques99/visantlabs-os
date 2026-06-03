import { useEffect, useRef, useCallback } from 'react';
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useTextureFilterStore } from '@/stores/textureFilterStore';
import { useRisoStore } from '@/stores/risoStore';

interface DragState {
  startX: number;
  startY: number;
  startParams: Record<string, number>;
  mode: ImageLabMode;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

const HALFTONE_MAP = {
  xAxis: [
    { key: 'frequency', min: 20, max: 120 },
    { key: 'contrast', min: 0.5, max: 2.0 },
  ],
  yAxis: [
    { key: 'dotSize', min: 0.3, max: 1.5 },
    { key: 'roughness', min: 0, max: 4.0 },
  ],
  dragDistance: [
    { key: 'paperNoise', min: 0, max: 0.5 },
    { key: 'inkNoise', min: 0.1, max: 1.0 },
    { key: 'randomness', min: 0, max: 0.5 },
    { key: 'fuzz', min: 0, max: 0.5 },
  ],
} as const;

const TEXTURE_MAP = {
  xAxis: [
    { key: 'opacity', min: 0.05, max: 1.0 },
    { key: 'scale', min: 0.3, max: 3.0 },
  ],
  yAxis: [{ key: 'rotation', min: 0, max: 360 }],
  dragDistance: [
    { key: 'tileGapX', min: 0, max: 50 },
    { key: 'tileGapY', min: 0, max: 50 },
  ],
} as const;

const RISO_MAP = {
  xAxis: [
    { key: 'frequency', min: 20, max: 100 },
    { key: 'contrast', min: 0.5, max: 2.0 },
  ],
  yAxis: [
    { key: 'dotSize', min: 0.4, max: 1.4 },
    { key: 'misregistration', min: 0, max: 8 },
  ],
  dragDistance: [
    { key: 'paperNoise', min: 0, max: 0.8 },
    { key: 'inkNoise', min: 0, max: 0.9 },
    { key: 'inkDropout', min: 0, max: 0.1 },
    { key: 'edgeBleed', min: 0.2, max: 3 },
  ],
} as const;

function getParamMap(mode: ImageLabMode) {
  if (mode === 'halftone') return HALFTONE_MAP;
  if (mode === 'texture') return TEXTURE_MAP;
  return RISO_MAP;
}

function getStore(mode: ImageLabMode) {
  if (mode === 'halftone') return useHalftoneStore;
  if (mode === 'texture') return useTextureFilterStore;
  return useRisoStore;
}

export function useMagicHand(containerRef: React.RefObject<HTMLDivElement | null>) {
  const dragState = useRef<DragState | null>(null);
  const frameRef = useRef<number>(0);

  const applyUpdates = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragState.current;
      if (!drag) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;

      const { mode } = drag;
      const store = getStore(mode);
      const map = getParamMap(mode);

      const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normDist = Math.min(dist / Math.max(rect.width, rect.height), 1);

      const batch: Record<string, number> = {};

      for (const p of map.xAxis) {
        batch[p.key] = parseFloat(lerp(p.min, p.max, nx).toFixed(4));
      }
      for (const p of map.yAxis) {
        batch[p.key] = parseFloat(lerp(p.min, p.max, 1 - ny).toFixed(4));
      }
      for (const p of map.dragDistance) {
        const base = drag.startParams[p.key] ?? p.min;
        const range = p.max - p.min;
        const val = base + normDist * range * 0.5;
        batch[p.key] = parseFloat(Math.min(p.max, Math.max(p.min, val)).toFixed(4));
      }

      // Direct set — skip pushHistory to avoid flooding undo stack during drag
      (store.setState as (partial: Record<string, number>) => void)(batch);
    },
    [containerRef]
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!useImageLabStore.getState().magicHandActive) return;
      if (e.button !== 0) return;

      const mode = useImageLabStore.getState().mode;
      const store = getStore(mode);
      const state = store.getState() as any;
      const map = getParamMap(mode);
      const allKeys = [...map.xAxis, ...map.yAxis, ...map.dragDistance];

      // Push one history snapshot before the drag starts (for undo)
      state.pushHistory();

      const startParams: Record<string, number> = {};
      for (const p of allKeys) startParams[p.key] = state[p.key] ?? 0;

      dragState.current = { startX: e.clientX, startY: e.clientY, startParams, mode };

      const el = containerRef.current;
      if (el) {
        el.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [containerRef]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState.current) return;
      e.preventDefault();

      cancelAnimationFrame(frameRef.current);
      const clientX = e.clientX;
      const clientY = e.clientY;
      frameRef.current = requestAnimationFrame(() => {
        applyUpdates(clientX, clientY);
      });
    },
    [applyUpdates]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!dragState.current) return;
      dragState.current = null;
      cancelAnimationFrame(frameRef.current);

      const el = containerRef.current;
      if (el) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {}
      }
    },
    [containerRef]
  );

  // Re-attach listeners whenever the ref element changes (conditional render)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);
}
