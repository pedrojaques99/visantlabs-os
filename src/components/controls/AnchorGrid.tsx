import * as React from 'react';
import { cn } from '@/lib/utils';

export type Anchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

const ANCHORS: Anchor[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

/** Normalized [x, y] origin (0..1) for each anchor — handy for placement math. */
export const ANCHOR_ORIGIN: Record<Anchor, [number, number]> = {
  'top-left': [0, 0],
  top: [0.5, 0],
  'top-right': [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  'bottom-left': [0, 1],
  bottom: [0.5, 1],
  'bottom-right': [1, 1],
};

export interface AnchorGridProps {
  value: Anchor;
  onChange: (value: Anchor) => void;
  label?: string;
  size?: number;
  className?: string;
}

/**
 * 9-point anchor / origin picker. Adapted from Pixel Point Toolcraft's
 * anchor-grid (MIT).
 */
export const AnchorGrid = React.memo<AnchorGridProps>(
  ({ value, onChange, label, size = 92, className }) => (
    <div className={cn('inline-flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-2xs uppercase tracking-widest text-neutral-500">{label}</span>
      )}
      <div
        role="radiogroup"
        aria-label={label || 'Anchor'}
        style={{ width: size, height: size }}
        className="grid grid-cols-3 grid-rows-3 gap-px rounded-md border border-neutral-800 bg-neutral-800 p-px overflow-hidden"
      >
        {ANCHORS.map((a) => {
          const selected = value === a;
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={a}
              onClick={() => onChange(a)}
              className={cn(
                'flex items-center justify-center bg-neutral-950/60 transition-colors group',
                'hover:bg-neutral-900',
                selected && 'bg-neutral-900'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-all',
                  selected ? 'bg-brand-cyan scale-125' : 'bg-neutral-600 group-hover:bg-neutral-400'
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  )
);

AnchorGrid.displayName = 'AnchorGrid';
