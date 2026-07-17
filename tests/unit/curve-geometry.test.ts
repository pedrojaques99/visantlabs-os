import { describe, it, expect } from 'vitest';
import {
  clamp01,
  normalizePoints,
  constrainPoint,
  insertPoint,
  removePoint,
  getYAtX,
  sampleCurve,
  buildLut,
  IDENTITY_CURVE,
  type CurvePoint,
} from '@/components/controls/curve-geometry';

describe('curve-geometry', () => {
  describe('clamp01', () => {
    it('clamps into [0,1]', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(1.5)).toBe(1);
      expect(clamp01(0.3)).toBe(0.3);
    });
  });

  describe('normalizePoints', () => {
    it('sorts by x and clamps coordinates', () => {
      const out = normalizePoints([
        { x: 1.4, y: -0.2 },
        { x: 0.2, y: 0.5 },
      ]);
      expect(out).toEqual([
        { x: 0.2, y: 0.5 },
        { x: 1, y: 0 },
      ]);
    });
  });

  describe('getYAtX', () => {
    it('is the identity on the 45° curve', () => {
      for (const x of [0, 0.25, 0.5, 0.75, 1]) {
        expect(getYAtX(IDENTITY_CURVE, x)).toBeCloseTo(x, 6);
      }
    });

    it('pins to endpoints outside the domain', () => {
      const pts: CurvePoint[] = [
        { x: 0.2, y: 0.3 },
        { x: 0.8, y: 0.9 },
      ];
      expect(getYAtX(pts, 0)).toBeCloseTo(0.3, 6);
      expect(getYAtX(pts, 1)).toBeCloseTo(0.9, 6);
    });

    it('monotone interpolation never overshoots monotonic data', () => {
      const pts: CurvePoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ];
      for (let i = 0; i <= 20; i++) {
        const y = getYAtX(pts, i / 20, 'monotone');
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('sampleCurve', () => {
    it('returns samples+1 points spanning 0..1', () => {
      const s = sampleCurve(IDENTITY_CURVE, 8);
      expect(s).toHaveLength(9);
      expect(s[0].x).toBe(0);
      expect(s[8].x).toBe(1);
    });
  });

  describe('buildLut', () => {
    it('produces a 256-entry ramp for the identity curve', () => {
      const lut = buildLut(IDENTITY_CURVE);
      expect(lut).toHaveLength(256);
      expect(lut[0]).toBe(0);
      expect(lut[255]).toBe(255);
      expect(lut[128]).toBe(128);
    });
  });

  describe('insert / remove / constrain', () => {
    it('inserts an interior point and keeps sorted order', () => {
      const { index, points } = insertPoint(IDENTITY_CURVE, { x: 0.5, y: 0.8 });
      expect(points).toHaveLength(3);
      expect(points[index]).toEqual({ x: 0.5, y: 0.8 });
      expect(points.map((p) => p.x)).toEqual([0, 0.5, 1]);
    });

    it('never removes the endpoints', () => {
      const three: CurvePoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ];
      expect(removePoint(three, 0)).toHaveLength(3); // endpoint stays
      expect(removePoint(three, 1)).toHaveLength(2); // interior removed
    });

    it('constrains an interior point between its neighbours', () => {
      const pts: CurvePoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ];
      const c = constrainPoint(pts, 1, { x: 2, y: 0.4 });
      expect(c.x).toBeLessThan(1);
      expect(c.x).toBeGreaterThan(0);
    });

    it('endpoints only move vertically', () => {
      const c = constrainPoint(IDENTITY_CURVE, 0, { x: 0.4, y: 0.7 });
      expect(c.x).toBe(0);
      expect(c.y).toBe(0.7);
    });
  });
});
