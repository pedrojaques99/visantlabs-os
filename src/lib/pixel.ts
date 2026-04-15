/**
 * Pixel Intelligence Utility
 * Centralizes math for coordinate normalization, bounding boxes, and alignment.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Normalizes a pixel value to a percentage (0-1) based on the canvas dimension.
 */
export const normalizeVal = (px: number, total: number): number => {
  if (total === 0) return 0;
  return px / total;
};

/**
 * Denormalizes a percentage (0-1) to a pixel value based on the canvas dimension.
 */
export const denormalizeVal = (percentage: number, total: number): number => {
  return percentage * total;
};

/**
 * Normalizes a Point (px) to percentage based on total canvas size.
 */
export const normalizePoint = (p: Point, total: Size): Point => ({
  x: normalizeVal(p.x, total.w),
  y: normalizeVal(p.y, total.h),
});

/**
 * Normalizes a Size (px) to percentage based on total canvas size.
 */
export const normalizeSize = (s: Size, total: Size): Size => ({
  w: normalizeVal(s.w, total.w),
  h: normalizeVal(s.h, total.h),
});

/**
 * Calculates the bounding box containing all provided rects.
 * Expects normalized values (0-1).
 */
export const calculateBoundingBox = (rects: Rect[]): Rect => {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
};

/**
 * Checks if a point is within a rect.
 */
export const isPointInRect = (p: Point, r: Rect): boolean => {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
};

/**
 * Checks if two rects overlap.
 */
export const doRectsOverlap = (r1: Rect, r2: Rect): boolean => {
  return !(
    r1.x + r1.w < r2.x ||
    r2.x + r2.w < r1.x ||
    r1.y + r1.h < r2.y ||
    r2.y + r2.h < r1.y
  );
};
