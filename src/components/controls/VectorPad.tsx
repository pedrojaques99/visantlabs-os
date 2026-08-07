import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Vector2 {
  x: number;
  y: number;
}

export interface VectorPadProps {
  value: Vector2;
  onChange: (value: Vector2) => void;
  /** Domain of each axis. Defaults to -1..1. */
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  /** Render the Y axis so that +Y points up (default true, natural for math/light dir). */
  invertY?: boolean;
  size?: number;
  label?: string;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * 2D XY pad — drag the knob to set a vector. Great for light direction, offsets,
 * or any paired numeric control. Adapted from Pixel Point Toolcraft's vector (MIT).
 */
export const VectorPad = React.memo<VectorPadProps>(
  ({
    value,
    onChange,
    minX = -1,
    maxX = 1,
    minY = -1,
    maxY = 1,
    invertY = true,
    size = 132,
    label,
    className,
  }) => {
    const padRef = React.useRef<HTMLDivElement>(null);
    const dragging = React.useRef(false);

    const nx = (value.x - minX) / (maxX - minX);
    const nyRaw = (value.y - minY) / (maxY - minY);
    const ny = invertY ? 1 - nyRaw : nyRaw;

    const update = React.useCallback(
      (clientX: number, clientY: number) => {
        const rect = padRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = clamp((clientX - rect.left) / rect.width, 0, 1);
        const pyRaw = clamp((clientY - rect.top) / rect.height, 0, 1);
        const py = invertY ? 1 - pyRaw : pyRaw;
        onChange({
          x: parseFloat((minX + px * (maxX - minX)).toFixed(4)),
          y: parseFloat((minY + py * (maxY - minY)).toFixed(4)),
        });
      },
      [onChange, minX, maxX, minY, maxY, invertY]
    );

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragging.current = true;
        update(e.clientX, e.clientY);
      },
      [update]
    );

    const onPointerMove = React.useCallback(
      (e: React.PointerEvent) => {
        if (dragging.current) update(e.clientX, e.clientY);
      },
      [update]
    );

    const endDrag = React.useCallback((e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dragging.current = false;
    }, []);

    return (
      <div className={cn('inline-flex flex-col gap-1.5', className)}>
        {label && (
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
            {label}
          </span>
        )}
        <div
          ref={padRef}
          style={{ width: size, height: size }}
          className="relative rounded-md border border-neutral-800 bg-neutral-950/60 touch-none cursor-crosshair overflow-hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* crosshair grid */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.06]" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.06]" />
          {/* vector line from center */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none">
            <line
              x1="50%"
              y1="50%"
              x2={`${nx * 100}%`}
              y2={`${ny * 100}%`}
              stroke="var(--brand-cyan, #22d3ee)"
              strokeWidth="1.5"
              opacity="0.6"
            />
          </svg>
          {/* knob */}
          <div
            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-cyan border border-neutral-950 shadow"
            style={{ left: `${nx * 100}%`, top: `${ny * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-neutral-400 tabular-nums">
          {value.x.toFixed(2)}, {value.y.toFixed(2)}
        </span>
      </div>
    );
  }
);

VectorPad.displayName = 'VectorPad';
