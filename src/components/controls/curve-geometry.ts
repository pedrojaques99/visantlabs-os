/**
 * Cubic-spline tone-curve geometry (monotone + smooth interpolation).
 *
 * The interpolation/tangent math is adapted from Pixel Point's Toolcraft
 * (MIT License, Copyright (c) 2026 Pixel Point) —
 * https://github.com/pixel-point/toolcraft
 * Reworked here to operate purely in normalized [0..1] space (no fixed SVG
 * viewport), so callers can render to canvas, SVG, or sample into a LUT.
 */

export type CurvePoint = { x: number; y: number };
export type CurveInterpolation = 'monotone' | 'smooth';

export const DEFAULT_INTERPOLATION: CurveInterpolation = 'smooth';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function sortByX(a: CurvePoint, b: CurvePoint): number {
  return a.x - b.x;
}

export function normalizePoints(points: readonly CurvePoint[]): CurvePoint[] {
  return points.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })).sort(sortByX);
}

/** Endpoints may only move vertically; interior points stay between neighbours. */
export function constrainPoint(
  points: readonly CurvePoint[],
  index: number,
  point: CurvePoint
): CurvePoint {
  if (index === 0 || index === points.length - 1) {
    return { x: points[index]?.x ?? point.x, y: clamp01(point.y) };
  }
  const minX = (points[index - 1]?.x ?? 0) + 0.01;
  const maxX = (points[index + 1]?.x ?? 1) - 0.01;
  return { x: Math.min(maxX, Math.max(minX, point.x)), y: clamp01(point.y) };
}

export function replacePoint(
  points: readonly CurvePoint[],
  index: number,
  point: CurvePoint
): CurvePoint[] {
  return normalizePoints(points.map((item, i) => (i === index ? point : item)));
}

export function insertPoint(
  points: readonly CurvePoint[],
  point: CurvePoint
): { index: number; points: CurvePoint[] } {
  const normalized = normalizePoints(points);
  const insertIndex = normalized.findIndex((item) => item.x > point.x);

  if (insertIndex <= 0) {
    return { index: 0, points: replacePoint(normalized, 0, { x: 0, y: point.y }) };
  }
  if (insertIndex === -1) {
    const end = normalized.length - 1;
    return { index: end, points: replacePoint(normalized, end, { x: 1, y: point.y }) };
  }
  return {
    index: insertIndex,
    points: normalizePoints([
      ...normalized.slice(0, insertIndex),
      point,
      ...normalized.slice(insertIndex),
    ]),
  };
}

export function removePoint(points: readonly CurvePoint[], index: number): CurvePoint[] {
  // Never drop the two endpoints.
  if (index === 0 || index === points.length - 1) return normalizePoints(points);
  return normalizePoints(points.filter((_, i) => i !== index));
}

function slopeAt(point: CurvePoint, index: number, points: readonly CurvePoint[]): number {
  const next = points[index + 1];
  const dx = Math.max(Number.EPSILON, next.x - point.x);
  return (next.y - point.y) / dx;
}

function smoothTangents(points: readonly CurvePoint[]): number[] {
  if (points.length <= 1) return points.map(() => 0);
  if (points.length === 2) {
    const s = slopeAt(points[0], 0, points);
    return [s, s];
  }
  return points.map((point, index) => {
    if (index === 0) return slopeAt(point, 0, points);
    if (index === points.length - 1) return slopeAt(points[index - 1] ?? point, index - 1, points);
    const prev = points[index - 1];
    const next = points[index + 1];
    const dx = Math.max(Number.EPSILON, (next?.x ?? point.x) - prev.x);
    return ((next?.y ?? point.y) - prev.y) / dx;
  });
}

function endpointTangent(o: {
  adjacentInterval: number;
  adjacentSlope: number;
  interval: number;
  slope: number;
}): number {
  const tangent =
    ((2 * o.interval + o.adjacentInterval) * o.slope - o.interval * o.adjacentSlope) /
    (o.interval + o.adjacentInterval);
  if (Math.sign(tangent) !== Math.sign(o.slope)) return 0;
  if (Math.sign(o.slope) !== Math.sign(o.adjacentSlope) && Math.abs(tangent) > Math.abs(3 * o.slope))
    return 3 * o.slope;
  return tangent;
}

function monotoneTangents(points: readonly CurvePoint[]): number[] {
  if (points.length <= 1) return points.map(() => 0);
  if (points.length === 2) {
    const s = slopeAt(points[0], 0, points);
    return [s, s];
  }
  const intervals = points
    .slice(0, -1)
    .map((p, i) => Math.max(Number.EPSILON, (points[i + 1]?.x ?? p.x) - p.x));
  const slopes = points.slice(0, -1).map((p, i) => slopeAt(p, i, points));

  return points.map((_, index) => {
    if (index === 0) {
      return endpointTangent({
        adjacentInterval: intervals[1] ?? intervals[0] ?? 1,
        interval: intervals[0] ?? 1,
        adjacentSlope: slopes[1] ?? slopes[0] ?? 0,
        slope: slopes[0] ?? 0,
      });
    }
    if (index === points.length - 1) {
      return endpointTangent({
        adjacentInterval: intervals[index - 2] ?? intervals[index - 1] ?? 1,
        interval: intervals[index - 1] ?? 1,
        adjacentSlope: slopes[index - 2] ?? slopes[index - 1] ?? 0,
        slope: slopes[index - 1] ?? 0,
      });
    }
    const left = slopes[index - 1] ?? 0;
    const right = slopes[index] ?? 0;
    if (left * right <= 0) return 0;
    const li = intervals[index - 1] ?? 1;
    const ri = intervals[index] ?? 1;
    const lw = 2 * ri + li;
    const rw = ri + 2 * li;
    return (lw + rw) / (lw / left + rw / right);
  });
}

function tangents(points: readonly CurvePoint[], interp: CurveInterpolation): number[] {
  return interp === 'monotone' ? monotoneTangents(points) : smoothTangents(points);
}

/** Evaluate the curve's y at a given x (both normalized 0..1). */
export function getYAtX(
  points: readonly CurvePoint[],
  x: number,
  interp: CurveInterpolation = DEFAULT_INTERPOLATION
): number {
  const pts = normalizePoints(points);
  const first = pts[0];
  if (!first) return clamp01(x);
  if (x <= first.x) return first.y;

  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i];
    if (p && x <= p.x) {
      const prev = pts[i - 1];
      const tg = tangents(pts, interp);
      const dx = Math.max(Number.EPSILON, p.x - prev.x);
      const t = clamp01((x - prev.x) / dx);
      const t2 = t * t;
      const t3 = t2 * t;
      const m0 = tg[i - 1] ?? 0;
      const m1 = tg[i] ?? 0;
      const y =
        (2 * t3 - 3 * t2 + 1) * prev.y +
        (t3 - 2 * t2 + t) * dx * m0 +
        (-2 * t3 + 3 * t2) * p.y +
        (t3 - t2) * dx * m1;
      return clamp01(y);
    }
  }
  return (pts[pts.length - 1] ?? first).y;
}

/** Sample the curve into `samples+1` [x,y] pairs in normalized space. */
export function sampleCurve(
  points: readonly CurvePoint[],
  samples = 64,
  interp: CurveInterpolation = DEFAULT_INTERPOLATION
): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = i / samples;
    out.push({ x, y: getYAtX(points, x, interp) });
  }
  return out;
}

/** 256-entry lookup table (0..255 → 0..255), handy for image pipelines. */
export function buildLut(
  points: readonly CurvePoint[],
  interp: CurveInterpolation = DEFAULT_INTERPOLATION
): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    lut[i] = Math.round(getYAtX(points, i / 255, interp) * 255);
  }
  return lut;
}

export const IDENTITY_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];
