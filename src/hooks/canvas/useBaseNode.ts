import { useCallback } from 'react';
import { useNodeResize } from './useNodeResize';
import { NODE_LAYOUT } from '@/constants/nodeLayout';

/**
 * useBaseNode - Standardized hook for all React Flow nodes.
 * 
 * Provides consistent resizing logic, fit-to-content logic, 
 * and dimension management based on the global NODE_LAYOUT source of truth.
 * 
 * @param id - The node ID
 * @param data - The node data object (must contain onResize and optionally imageWidth/imageHeight)
 */
export function useBaseNode(id: string, data: any) {
  const { handleResize: resize, fitToContent: fit } = useNodeResize();
  
  /**
   * handleResize - Called during manual RedNodeResizer interactions
   */
  const handleResize = useCallback((width: number, height: number | 'auto' = 'auto') => {
    resize(id, width, height, data.onResize);
  }, [id, data.onResize, resize]);

  /**
   * handleFitToContent - Standardized logic for "snapping" the node size 
   * to its current content (e.g. image or prompt text).
   */
  const handleFitToContent = useCallback((measuredWidth?: number, measuredHeight?: number) => {
    const { imageWidth, imageHeight } = data;
    
    // 1. If we have explicit image dimensions, use them but respect MAX_FIT_WIDTH
    if (imageWidth && imageHeight) {
      let targetWidth = imageWidth;
      let targetHeight = imageHeight;
      
      if (targetWidth > NODE_LAYOUT.MAX_FIT_WIDTH) {
        const ratio = NODE_LAYOUT.MAX_FIT_WIDTH / targetWidth;
        targetWidth = NODE_LAYOUT.MAX_FIT_WIDTH;
        targetHeight *= ratio;
      }
      
      fit(id, Math.round(targetWidth), Math.round(targetHeight), data.onResize);
    } 
    // 2. If we have measured dimensions (from a ResizeObserver or DOM ref), use them
    else if (measuredWidth && measuredHeight) {
      fit(id, measuredWidth, measuredHeight, data.onResize);
    }
    // 3. Fallback: reset to auto height, maintaining default width
    else {
      fit(id, NODE_LAYOUT.DEFAULT_WIDTH, 'auto', data.onResize);
    }
  }, [id, data.imageWidth, data.imageHeight, data.onResize, fit]);

  return { 
    handleResize, 
    handleFitToContent,
    // Provide standard layout constants for UI consumption
    layout: NODE_LAYOUT
  };
}
