import * as React from 'react';
import { cn } from '@/lib/utils';

export interface RangeSliderProps {
  /** Current [min, max] tuple. */
  value: [number, number];
  onChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Minimum gap kept between the two handles. */
  minGap?: number;
  label?: string;
  suffix?: string;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Dual-handle min/max range slider. Pure pointer events, no external primitive.
 * Interaction model adapted from Pixel Point Toolcraft's range-slider (MIT).
 */
export const RangeSlider = React.memo<RangeSliderProps>(
  ({ value, onChange, min = 0, max = 100, step = 1, minGap = 0, label, suffix = '', className }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const dragRef = React.useRef<'min' | 'max' | null>(null);

    const [lo, hi] = value;
    const pct = React.useCallback((v: number) => ((v - min) / (max - min)) * 100, [min, max]);

    const snap = React.useCallback(
      (v: number) => {
        const snapped = Math.round(v / step) * step;
        return parseFloat(clamp(snapped, min, max).toFixed(10));
      },
      [step, min, max]
    );

    const valueFromClient = React.useCallback(
      (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return min;
        return snap(min + ((clientX - rect.left) / rect.width) * (max - min));
      },
      [min, max, snap]
    );

    const startDrag = React.useCallback(
      (handle: 'min' | 'max') => (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = handle;
      },
      []
    );

    const onPointerMove = React.useCallback(
      (e: React.PointerEvent) => {
        if (!dragRef.current) return;
        const v = valueFromClient(e.clientX);
        if (dragRef.current === 'min') {
          onChange([Math.min(v, hi - minGap), hi]);
        } else {
          onChange([lo, Math.max(v, lo + minGap)]);
        }
      },
      [valueFromClient, onChange, lo, hi, minGap]
    );

    const endDrag = React.useCallback((e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dragRef.current = null;
    }, []);

    // Click on the track jumps the nearest handle.
    const onTrackDown = React.useCallback(
      (e: React.PointerEvent) => {
        if (e.target !== trackRef.current) return;
        const v = valueFromClient(e.clientX);
        const nearMin = Math.abs(v - lo) <= Math.abs(v - hi);
        if (nearMin) onChange([Math.min(v, hi - minGap), hi]);
        else onChange([lo, Math.max(v, lo + minGap)]);
      },
      [valueFromClient, lo, hi, minGap, onChange]
    );

    const handleClass =
      'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-neutral-100 ' +
      'border border-neutral-950 shadow-sm cursor-grab active:cursor-grabbing touch-none ' +
      'hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan';

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              {label}
            </span>
            <span className="text-[11px] font-mono text-neutral-300 tabular-nums">
              {lo}
              {suffix} – {hi}
              {suffix}
            </span>
          </div>
        )}
        <div
          ref={trackRef}
          onPointerDown={onTrackDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative h-3.5 flex items-center cursor-pointer"
        >
          <div className="absolute inset-x-0 h-1 rounded-full bg-neutral-800" />
          <div
            className="absolute h-1 rounded-full bg-brand-cyan"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
          <div
            role="slider"
            aria-label={label ? `${label} minimum` : 'Minimum'}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={lo}
            tabIndex={0}
            className={handleClass}
            style={{ left: `${pct(lo)}%` }}
            onPointerDown={startDrag('min')}
          />
          <div
            role="slider"
            aria-label={label ? `${label} maximum` : 'Maximum'}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={hi}
            tabIndex={0}
            className={handleClass}
            style={{ left: `${pct(hi)}%` }}
            onPointerDown={startDrag('max')}
          />
        </div>
      </div>
    );
  }
);

RangeSlider.displayName = 'RangeSlider';
