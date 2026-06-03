import { useRef, useCallback, useEffect } from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';

interface BrushPaintingOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  panOffset: { x: number; y: number };
}

export function useBrushPainting({
  containerRef,
  imageWidth,
  imageHeight,
  zoom,
  panOffset,
}: BrushPaintingOptions) {
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const cursorElRef = useRef<HTMLDivElement | null>(null);

  const screenToImage = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left - panOffset.x) / zoom,
        y: (clientY - rect.top - panOffset.y) / zoom,
      };
    },
    [containerRef, zoom, panOffset]
  );

  const updateCursor = useCallback((e: PointerEvent) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY };
    if (cursorElRef.current) {
      cursorElRef.current.style.left = `${e.clientX}px`;
      cursorElRef.current.style.top = `${e.clientY}px`;
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: PointerEvent) => updateCursor(e);
    el.addEventListener('pointermove', handler, { passive: true });
    return () => el.removeEventListener('pointermove', handler);
  }, [containerRef, updateCursor]);

  return {
    cursorElRef,
    screenToImage,
  };
}
