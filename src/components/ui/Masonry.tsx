/**
 * Masonry — round-robin JS masonry, shared by the reference library and the brand
 * preview. Items are distributed into N balanced columns by index (`i % cols`), so
 * appending pages never reflows existing items (Apple-smooth infinite feed). Handles
 * mixed aspect ratios — image thumbnails or live-rendered nodes alike.
 *
 * Extracted from `ReferencesPage` (was an inline `useColumns` + column map) so both
 * surfaces share one implementation.
 */
import React, { useState, useEffect, useMemo } from 'react';

export interface MasonryBreakpoints {
  /** < 640px */ base: number;
  /** < 1024px */ sm: number;
  /** < 1280px */ lg: number;
  /** ≥ 1280px */ xl: number;
}

const DEFAULT_BREAKPOINTS: MasonryBreakpoints = { base: 2, sm: 3, lg: 4, xl: 5 };

/** Responsive column count for the JS masonry (stable on append — no reflow). */
export function useMasonryColumns(bp: MasonryBreakpoints = DEFAULT_BREAKPOINTS): number {
  const get = () => {
    if (typeof window === 'undefined') return bp.lg;
    const w = window.innerWidth;
    if (w < 640) return bp.base;
    if (w < 1024) return bp.sm;
    if (w < 1280) return bp.lg;
    return bp.xl;
  };
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const onResize = () => setCols(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // get() reads bp; bp is a stable literal per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return cols;
}

interface MasonryProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => React.Key;
  /** Fixed column count. Omit to compute responsively (via `useMasonryColumns`). */
  cols?: number;
  breakpoints?: MasonryBreakpoints;
  /** Gap between items/columns, in px (default 12). */
  gap?: number;
  className?: string;
}

export function Masonry<T>({
  items,
  renderItem,
  getKey,
  cols,
  breakpoints,
  gap = 12,
  className,
}: MasonryProps<T>) {
  const responsive = useMasonryColumns(breakpoints);
  const n = Math.max(1, cols ?? responsive);
  const columns = useMemo(() => {
    const out: Array<Array<{ item: T; idx: number }>> = Array.from({ length: n }, () => []);
    items.forEach((item, idx) => out[idx % n].push({ item, idx }));
    return out;
  }, [items, n]);

  return (
    <div className={className} style={{ display: 'flex', gap, alignItems: 'flex-start' }}>
      {columns.map((col, ci) => (
        <div
          key={ci}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap }}
        >
          {col.map(({ item, idx }) => (
            <React.Fragment key={getKey(item, idx)}>{renderItem(item, idx)}</React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
