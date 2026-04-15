import { describe, it, expect } from 'vitest';
import {
  normalizeVal,
  denormalizeVal,
  normalizePoint,
  normalizeSize,
  calculateBoundingBox,
  isPointInRect,
  doRectsOverlap,
} from '@/lib/pixel';

describe('Pixel Intelligence (lib/pixel)', () => {
  describe('Normalization', () => {
    it('normalizes values correctly', () => {
      expect(normalizeVal(500, 1000)).toBe(0.5);
      expect(normalizeVal(0, 1000)).toBe(0);
      expect(normalizeVal(1000, 1000)).toBe(1);
      expect(normalizeVal(500, 0)).toBe(0); // Handle division by zero
    });

    it('denormalizes values correctly', () => {
      expect(denormalizeVal(0.5, 1000)).toBe(500);
      expect(denormalizeVal(0, 1000)).toBe(0);
      expect(denormalizeVal(1, 1000)).toBe(1000);
    });

    it('normalizes points and sizes', () => {
      const canvasSize = { w: 1000, h: 500 };
      expect(normalizePoint({ x: 100, y: 100 }, canvasSize)).toEqual({ x: 0.1, y: 0.2 });
      expect(normalizeSize({ w: 500, h: 250 }, canvasSize)).toEqual({ w: 0.5, h: 0.5 });
    });
  });

  describe('Bounding Box', () => {
    it('calculates bounding box for multiple rects', () => {
      const rects = [
        { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
        { x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      ];
      const bbox = calculateBoundingBox(rects);
      expect(bbox).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
    });

    it('returns zero rect for empty input', () => {
      expect(calculateBoundingBox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });
  });

  describe('Geometrical Logic', () => {
    it('detects points inside rects', () => {
      const rect = { x: 10, y: 10, w: 100, h: 100 };
      expect(isPointInRect({ x: 50, y: 50 }, rect)).toBe(true);
      expect(isPointInRect({ x: 5, y: 5 }, rect)).toBe(false);
      expect(isPointInRect({ x: 10, y: 10 }, rect)).toBe(true); // Boundary
    });

    it('detects overlapping rects', () => {
      const r1 = { x: 0, y: 0, w: 10, h: 10 };
      const r2 = { x: 5, y: 5, w: 10, h: 10 };
      const r3 = { x: 20, y: 20, w: 10, h: 10 };
      
      expect(doRectsOverlap(r1, r2)).toBe(true);
      expect(doRectsOverlap(r1, r3)).toBe(false);
    });
  });
});
