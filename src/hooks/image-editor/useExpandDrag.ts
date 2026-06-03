import { useCallback, useRef } from 'react';
import { useImageEditorStore, type ExpandEdges } from '@/stores/imageEditorStore';

interface ExpandDragOptions {
  imageWidth: number;
  imageHeight: number;
  zoom: number;
}

export function useExpandDrag({ imageWidth, imageHeight, zoom }: ExpandDragOptions) {
  const dragEdgeRef = useRef<keyof ExpandEdges | null>(null);
  const dragStartRef = useRef<number>(0);
  const dragStartValueRef = useRef<number>(0);

  const handleEdgeDown = useCallback(
    (edge: keyof ExpandEdges, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragEdgeRef.current = edge;
      dragStartRef.current = edge === 'left' || edge === 'right' ? e.clientX : e.clientY;
      dragStartValueRef.current = useImageEditorStore.getState().expandEdges[edge];

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragEdgeRef.current) return;
        const currentEdge = dragEdgeRef.current;
        const isHorizontal = currentEdge === 'left' || currentEdge === 'right';
        const current = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
        const delta = current - dragStartRef.current;

        const maxDim = isHorizontal ? imageWidth : imageHeight;
        let pixelDelta: number;

        if (currentEdge === 'right' || currentEdge === 'bottom') {
          pixelDelta = delta / zoom;
        } else {
          pixelDelta = -delta / zoom;
        }

        const newValue = Math.max(0, Math.min(maxDim, dragStartValueRef.current + pixelDelta));
        useImageEditorStore.getState().setExpandEdge(currentEdge, Math.round(newValue));
      };

      const handleUp = () => {
        dragEdgeRef.current = null;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [imageWidth, imageHeight, zoom]
  );

  return { handleEdgeDown };
}
