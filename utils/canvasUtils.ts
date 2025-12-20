import type { ViewportTransform, ImagePosition } from '../hooks/useCanvasViewport';

/**
 * Apply subtle 3D depth effect: images spread/cluster based on zoom
 * Works for both zoom in (>100%) and zoom out (<100%)
 * Effect stops increasing at 180% zoom (1.8x) but maintains position
 */
export const applyDepthEffect = (
  basePosition: ImagePosition,
  viewport: ViewportTransform,
  containerRef: React.RefObject<HTMLDivElement>,
  isDragging: boolean
): ImagePosition => {
  if (isDragging) {
    return basePosition;
  }

  const containerWidth = containerRef.current?.clientWidth || 0;
  const containerHeight = containerRef.current?.clientHeight || 0;
  
  // Center of viewport in canvas coordinates (accounting for transform)
  const viewportCenterX = (-viewport.x + containerWidth / 2) / viewport.scale;
  const viewportCenterY = (-viewport.y + containerHeight / 2) / viewport.scale;
  
  // Distance from viewport center
  const distanceFromCenterX = basePosition.x - viewportCenterX;
  const distanceFromCenterY = basePosition.y - viewportCenterY;
  
  // Apply subtle zoom-based spacing multiplier (creates smooth 3D depth effect)
  // Effect capped at 180% (1.8x) zoom - maintains position but stops increasing
  const effectiveScale = Math.min(viewport.scale, 1.8); // Cap at 180%
  const depthMultiplier = 1 + (effectiveScale - 1) * 0.3;
  
  return {
    x: viewportCenterX + (distanceFromCenterX * depthMultiplier),
    y: viewportCenterY + (distanceFromCenterY * depthMultiplier),
  };
};

