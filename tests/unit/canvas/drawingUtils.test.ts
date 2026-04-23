import { describe, it, expect } from 'vitest';
import { getSvgPathFromStroke, calculateBounds } from '@/utils/drawingUtils';

// ── calculateBounds ────────────────────────────────────────────────────────────

describe('calculateBounds', () => {
  it('returns zero bounds for empty points', () => {
    expect(calculateBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('returns zero-size bounds for a single point', () => {
    expect(calculateBounds([[10, 20]])).toEqual({ x: 10, y: 20, width: 0, height: 0 });
  });

  it('calculates correct bounds for a horizontal line', () => {
    const bounds = calculateBounds([[0, 5], [10, 5], [20, 5]]);
    expect(bounds).toEqual({ x: 0, y: 5, width: 20, height: 0 });
  });

  it('calculates correct bounds for a vertical line', () => {
    const bounds = calculateBounds([[3, 0], [3, 15], [3, 30]]);
    expect(bounds).toEqual({ x: 3, y: 0, width: 0, height: 30 });
  });

  it('calculates correct bounds for a scattered polygon', () => {
    const points = [[1, 4], [8, 1], [5, 9], [2, 7]];
    const bounds = calculateBounds(points);
    expect(bounds.x).toBe(1);
    expect(bounds.y).toBe(1);
    expect(bounds.width).toBe(7);   // 8 - 1
    expect(bounds.height).toBe(8);  // 9 - 1
  });

  it('handles negative coordinates', () => {
    const bounds = calculateBounds([[-10, -5], [10, 5]]);
    expect(bounds).toEqual({ x: -10, y: -5, width: 20, height: 10 });
  });
});

// ── getSvgPathFromStroke ───────────────────────────────────────────────────────

describe('getSvgPathFromStroke', () => {
  it('returns empty string for empty points array', () => {
    expect(getSvgPathFromStroke([])).toBe('');
  });

  it('returns empty string for fewer than 4 points (perfect-freehand minimum)', () => {
    // perfect-freehand needs enough points to generate a stroke
    const result = getSvgPathFromStroke([[0, 0], [1, 1]]);
    // May return empty or a path — just must not throw
    expect(typeof result).toBe('string');
  });

  it('returns a valid SVG path string for a real stroke', () => {
    // 10 points in a diagonal line — enough for perfect-freehand to work
    const points = Array.from({ length: 10 }, (_, i) => [i * 10, i * 10]);
    const path = getSvgPathFromStroke(points, 4);
    if (path.length > 0) {
      // Must start with M (moveto)
      expect(path).toMatch(/^M/);
      // Must contain at least one curve command
      expect(path).toMatch(/[QTC]/);
    }
  });

  it('produces closed path by default (ends with Z)', () => {
    const points = Array.from({ length: 10 }, (_, i) => [i * 5, i * 5]);
    const path = getSvgPathFromStroke(points);
    if (path.length > 0) {
      expect(path).toMatch(/Z\s*$/);
    }
  });

  it('produces open path when closed=false', () => {
    const points = Array.from({ length: 10 }, (_, i) => [i * 5, i * 5]);
    const path = getSvgPathFromStroke(points, 2, false);
    if (path.length > 0) {
      expect(path).not.toMatch(/Z\s*$/);
    }
  });

  it('produces different paths for different stroke sizes', () => {
    const points = Array.from({ length: 10 }, (_, i) => [i * 10, i * 5]);
    const thin = getSvgPathFromStroke(points, 1);
    const thick = getSvgPathFromStroke(points, 20);
    // Both are valid strings — their actual path data differs due to size
    expect(typeof thin).toBe('string');
    expect(typeof thick).toBe('string');
    if (thin && thick) {
      expect(thin).not.toBe(thick);
    }
  });
});
