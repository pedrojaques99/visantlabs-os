import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseResizableOptions {
  /** Minimum width in px. */
  min: number;
  /** Maximum width in px. */
  max: number;
  /** Initial width when uncontrolled and nothing is persisted. */
  initial: number;
  /**
   * Which edge the drag handle sits on. `'right'` (default) means dragging
   * right grows the panel (left-anchored sidebar). `'left'` means dragging
   * left grows it (right-anchored panel).
   */
  edge?: 'left' | 'right';
  /** Persist width to localStorage under this key. */
  storageKey?: string;
  /** Notified on every width change (drag + programmatic). */
  onChange?: (width: number) => void;
  /**
   * Controlled width. When provided, this value drives the returned `width`;
   * the hook still reports changes via `onChange` so the parent stays the SoT.
   */
  value?: number;
}

export interface UseResizableResult {
  /** Current width in px (controlled value if provided, else internal). */
  width: number;
  /** True while a drag is in progress (e.g. to disable transitions). */
  isResizing: boolean;
  /** Programmatically set the width (clamped + persisted + reported). */
  setWidth: (width: number) => void;
  /** Spread onto the drag handle element. */
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
}

/**
 * Single source of truth for drag-to-resize panels/sidebars. Handles clamping,
 * localStorage persistence, controlled/uncontrolled width, left/right edges,
 * mouse + touch, rAF-batched updates, and cursor/selection side effects.
 *
 * Listeners are bound per-drag (on mousedown) and use refs for the latest
 * width/onChange, so a parent re-rendering mid-drag never tears the drag down.
 */
export function useResizable(options: UseResizableOptions): UseResizableResult {
  const { min, max, initial, edge = 'right', storageKey, onChange, value } = options;

  const clamp = useCallback((w: number) => Math.min(max, Math.max(min, w)), [min, max]);

  const [internalWidth, setInternalWidth] = useState<number>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseInt(saved, 10);
        if (Number.isFinite(n)) return clamp(n);
      }
    }
    return clamp(initial);
  });
  const [isResizing, setIsResizing] = useState(false);

  const width = value ?? internalWidth;

  const widthRef = useRef(width);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    widthRef.current = width;
    onChangeRef.current = onChange;
  });

  const setWidth = useCallback(
    (w: number) => {
      const next = clamp(w);
      setInternalWidth(next);
      widthRef.current = next;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          /* ignore storage quota/availability errors */
        }
      }
      onChangeRef.current?.(next);
    },
    [clamp, storageKey]
  );

  const startDrag = useCallback(
    (clientX0: number) => {
      const startX = clientX0;
      const startWidth = widthRef.current;
      let lastX = clientX0;
      let frame = 0;

      setIsResizing(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const commit = () => {
        frame = 0;
        const dx = edge === 'right' ? lastX - startX : startX - lastX;
        setWidth(startWidth + dx);
      };
      const onMove = (x: number) => {
        lastX = x;
        if (!frame) frame = requestAnimationFrame(commit);
      };
      const onMouseMove = (e: MouseEvent) => onMove(e.clientX);
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches[0]) onMove(e.touches[0].clientX);
      };
      const stop = () => {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', stop);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', stop);
        if (frame) cancelAnimationFrame(frame);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stop);
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', stop);
    },
    [edge, setWidth]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.clientX);
    },
    [startDrag]
  );
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) startDrag(e.touches[0].clientX);
    },
    [startDrag]
  );

  return { width, isResizing, setWidth, handleProps: { onMouseDown, onTouchStart } };
}
