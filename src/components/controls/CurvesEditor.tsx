import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  type CurvePoint,
  type CurveInterpolation,
  DEFAULT_INTERPOLATION,
  IDENTITY_CURVE,
  clamp01,
  normalizePoints,
  constrainPoint,
  replacePoint,
  insertPoint,
  removePoint,
  getYAtX,
  sampleCurve,
} from './curve-geometry';

export interface CurvesEditorProps {
  /** Control points in normalized [0..1] space. First/last are the endpoints. */
  points?: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  interpolation?: CurveInterpolation;
  /** Stroke colour of the curve (e.g. a channel tint). Defaults to brand cyan. */
  color?: string;
  /** Optional 256-bin histogram drawn behind the curve (0..1 magnitudes). */
  histogram?: number[] | Float32Array | Uint32Array;
  /** Square edge size in px. */
  size?: number;
  className?: string;
}

const HIT_RADIUS = 14; // px in device-independent space

/**
 * Photoshop-style tone curve editor on a 2D canvas.
 * Click near the curve to add a point, drag to move, double-click a point to remove.
 *
 * Curve math adapted from Pixel Point Toolcraft (MIT). See ./curve-geometry.ts.
 */
export const CurvesEditor = React.memo<CurvesEditorProps>(
  ({
    points: pointsProp,
    onChange,
    interpolation = DEFAULT_INTERPOLATION,
    color = 'var(--brand-cyan, #22d3ee)',
    histogram,
    size = 232,
    className,
  }) => {
    const points = React.useMemo(
      () => normalizePoints(pointsProp?.length ? pointsProp : IDENTITY_CURVE),
      [pointsProp]
    );
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const dragRef = React.useRef<number | null>(null);
    const [hover, setHover] = React.useState<number | null>(null);

    const resolvedColor = React.useMemo(() => {
      if (typeof window === 'undefined' || !color.startsWith('var(')) return color;
      const name = color.slice(4, color.indexOf(',') === -1 ? -1 : color.indexOf(',')).trim();
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || '#22d3ee';
    }, [color]);

    const toNorm = React.useCallback((e: { clientX: number; clientY: number }): CurvePoint => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: clamp01((e.clientX - rect.left) / rect.width),
        y: clamp01(1 - (e.clientY - rect.top) / rect.height),
      };
    }, []);

    const findPoint = React.useCallback(
      (n: CurvePoint): number => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return -1;
        const rx = HIT_RADIUS / rect.width;
        const ry = HIT_RADIUS / rect.height;
        let best = -1;
        let bestD = Infinity;
        points.forEach((p, i) => {
          const dx = (p.x - n.x) / rx;
          const dy = (p.y - n.y) / ry;
          const d = dx * dx + dy * dy;
          if (d <= 1 && d < bestD) {
            bestD = d;
            best = i;
          }
        });
        return best;
      },
      [points]
    );

    // ---- draw ----
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = size * dpr;
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const X = (x: number) => x * size;
      const Y = (y: number) => (1 - y) * size;

      // histogram
      if (histogram && histogram.length) {
        let max = 0;
        for (let i = 0; i < histogram.length; i += 1) max = Math.max(max, histogram[i]);
        if (max > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          const bins = histogram.length;
          for (let i = 0; i < bins; i += 1) {
            const h = (histogram[i] / max) * size;
            ctx.fillRect((i / bins) * size, size - h, size / bins + 0.5, h);
          }
        }
      }

      // grid (quarters) + diagonal reference
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach((g) => {
        ctx.beginPath();
        ctx.moveTo(X(g), 0);
        ctx.lineTo(X(g), size);
        ctx.moveTo(0, Y(g));
        ctx.lineTo(size, Y(g));
        ctx.stroke();
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(1), Y(1));
      ctx.stroke();

      // curve
      const samples = sampleCurve(points, Math.max(48, Math.round(size / 3)), interpolation);
      ctx.strokeStyle = resolvedColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      samples.forEach((p, i) =>
        i === 0 ? ctx.moveTo(X(p.x), Y(p.y)) : ctx.lineTo(X(p.x), Y(p.y))
      );
      ctx.stroke();

      // points
      points.forEach((p, i) => {
        const active = i === hover || i === dragRef.current;
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), active ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = active ? resolvedColor : '#e5e5e5';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(10,10,10,0.9)';
        ctx.stroke();
      });
    }, [points, interpolation, resolvedColor, histogram, size, hover]);

    // ---- interaction ----
    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const n = toNorm(e);
        let index = findPoint(n);
        if (index === -1) {
          const res = insertPoint(points, n);
          index = res.index;
          onChange(res.points);
        }
        dragRef.current = index;
        setHover(index);
      },
      [points, toNorm, findPoint, onChange]
    );

    const onPointerMove = React.useCallback(
      (e: React.PointerEvent) => {
        const n = toNorm(e);
        if (dragRef.current === null) {
          setHover(findPoint(n));
          return;
        }
        const i = dragRef.current;
        onChange(replacePoint(points, i, constrainPoint(points, i, n)));
      },
      [points, toNorm, findPoint, onChange]
    );

    const endDrag = React.useCallback((e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dragRef.current = null;
    }, []);

    const onDoubleClick = React.useCallback(
      (e: React.MouseEvent) => {
        const i = findPoint(toNorm(e));
        if (i > 0 && i < points.length - 1) onChange(removePoint(points, i));
      },
      [points, toNorm, findPoint, onChange]
    );

    return (
      <div className={cn('inline-flex flex-col gap-1.5', className)}>
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="rounded-md border border-neutral-800 bg-neutral-950/60 touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
          onPointerLeave={() => dragRef.current === null && setHover(null)}
        />
        <span className="text-3xs uppercase tracking-widest text-neutral-600 select-none">
          click add · drag move · dbl-click remove
        </span>
      </div>
    );
  }
);

CurvesEditor.displayName = 'CurvesEditor';

export { getYAtX, sampleCurve, IDENTITY_CURVE };
export type { CurvePoint, CurveInterpolation };
