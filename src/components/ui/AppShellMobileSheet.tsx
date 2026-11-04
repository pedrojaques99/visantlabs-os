import React, { useRef, useState, type ReactNode } from 'react';
import { useDrag } from '@use-gesture/react';
import { ChevronUp, ChevronDown } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';

const BAR_HEIGHT = 48;
/** Heights the sheet settles on, as a percentage of the screen. */
const SNAP_POINTS = [30, 45, 60];
/** How far a quick flick carries the sheet, per unit of velocity. */
const FLICK_PX = 80;

export interface AppShellMobileSheetProps {
  open: boolean;
  onToggle: () => void;
  label?: string;
  /** Expanded height, default '45%'. A percentage when `onHeightChange` is set. */
  height?: string;
  /** Turns the bar into a handle: drag it to a new height. Tapping it still opens and closes. */
  onHeightChange?: (percent: number) => void;
  children: ReactNode;
  className?: string;
}

export const AppShellMobileSheet: React.FC<AppShellMobileSheetProps> = ({
  open,
  onToggle,
  label = 'Controls',
  height = '45%',
  onHeightChange,
  children,
  className,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const resizable = Boolean(onHeightChange);

  const bind = useDrag(
    ({ first, last, tap, memo, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
      if (tap) {
        setDragHeight(null);
        return memo;
      }
      const sheet = sheetRef.current;
      const room = sheet?.parentElement?.clientHeight ?? 0;
      if (!sheet || !room) return memo;
      const start: number = first || memo === undefined ? sheet.offsetHeight : memo;
      const max = (room * SNAP_POINTS[SNAP_POINTS.length - 1]) / 100;
      const next = Math.min(max, Math.max(BAR_HEIGHT, start - my));
      if (!last) {
        setDragHeight(next);
        return start;
      }
      setDragHeight(null);
      const landing = next - dy * vy * FLICK_PX;
      const distance = (px: number) => Math.abs(px - landing);
      const snap = SNAP_POINTS.reduce((best, percent) =>
        distance((room * percent) / 100) < distance((room * best) / 100) ? percent : best
      );
      if (distance(BAR_HEIGHT) < distance((room * snap) / 100)) {
        if (open) onToggle();
        return start;
      }
      onHeightChange?.(snap);
      if (!open) onToggle();
      return start;
    },
    { enabled: resizable, axis: 'y', filterTaps: true }
  );

  const dragging = dragHeight !== null;

  return (
    <div
      ref={sheetRef}
      className={cn(
        'absolute left-0 right-0 bottom-0 z-20',
        !dragging && 'transition-[height] duration-[var(--dur-base)] ease-out',
        className
      )}
      style={{ height: dragHeight ?? (open ? height : BAR_HEIGHT) }}
    >
      <button
        {...bind()}
        onClick={onToggle}
        className={cn(
          'relative w-full flex items-center justify-center gap-1.5 h-[48px] bg-card/90 backdrop-blur-xl border-t border-border text-muted-foreground active:bg-accent',
          resizable && 'touch-none cursor-grab active:cursor-grabbing'
        )}
      >
        {resizable && (
          <span
            aria-hidden
            className="absolute top-1.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-border"
          />
        )}
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        <span className="text-2xs">{label}</span>
      </button>
      {(open || dragging) && (
        <div className="h-[calc(100%-48px)] bg-background/95 backdrop-blur-xl overflow-y-auto scrollbar-none pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      )}
    </div>
  );
};
