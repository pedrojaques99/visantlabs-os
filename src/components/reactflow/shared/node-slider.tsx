import * as React from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export interface NodeSliderProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange'
> {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  hint?: string;
  /** Marks this value on the row. A double click goes back to it. */
  resetValue?: number;
}

/** Drag this many times farther for the same change while Shift is down. */
const FINE_DRAG = 0.1;

/** "30%" becomes "30" and "%", so the unit can sit one tone below the number. */
function splitUnit(text: string): [string, string] {
  const match = /^(-?[\d.,]+)\s*(.*)$/.exec(text);
  return match ? [match[1], match[2]] : [text, ''];
}

/**
 * The row is the slider: the fill sits behind the name and the value, so a column of rows reads
 * as a table and takes half the height of a label above a track.
 *
 * Three ways into the number: drag, type (click the value), arrow keys (the native input, kept
 * for the keyboard and screen readers). On touch a drag moves from the current value and a
 * vertical swipe scrolls the panel, so scrolling past a row never changes it.
 */
const NodeSlider = React.forwardRef<HTMLInputElement, NodeSliderProps>(
  (
    {
      label,
      value,
      min,
      max,
      step = 0.01,
      onChange,
      formatValue,
      hint,
      resetValue,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [draft, setDraft] = React.useState<string | null>(null);
    const [dragging, setDragging] = React.useState(false);
    const drag = React.useRef<{
      id: number;
      startX: number;
      startValue: number;
      touch: boolean;
    } | null>(null);

    const range = max - min || 1;
    const toPercent = (v: number) => Math.min(100, Math.max(0, ((v - min) / range) * 100));
    const percentage = toPercent(value);
    // A range around zero fills from zero, so 0 reads as empty and the sign reads as a side.
    const origin = min < 0 && max > 0 ? toPercent(0) : 0;

    const snap = (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      return parseFloat((min + Math.round((clamped - min) / step) * step).toFixed(10));
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const touch = e.pointerType !== 'mouse';
      const box = e.currentTarget.getBoundingClientRect();
      let startValue = value;
      // A mouse goes where it points. On touch this could be the start of a scroll.
      if (!touch && !e.shiftKey) {
        startValue = snap(min + ((e.clientX - box.left) / box.width) * range);
        if (startValue !== value) onChange(startValue);
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, startX: e.clientX, startValue, touch };
      setDragging(true);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (drag.current?.id !== e.pointerId) return;
      const width = e.currentTarget.getBoundingClientRect().width || 1;
      const moved = ((e.clientX - drag.current.startX) / width) * range;
      const next = snap(drag.current.startValue + moved * (e.shiftKey ? FINE_DRAG : 1));
      if (next !== value) onChange(next);
    };

    const endDrag = () => {
      drag.current = null;
      setDragging(false);
    };

    const commitDraft = () => {
      if (draft === null) return;
      const typed = parseFloat(draft.replace(',', '.'));
      setDraft(null);
      if (!Number.isNaN(typed)) onChange(snap(typed));
    };

    const displayValue = formatValue ? formatValue(value) : value.toFixed(2);
    const [number, unit] = splitUnit(displayValue);
    const hasReset = resetValue !== undefined;
    const changed = hasReset && Math.abs(value - resetValue) >= step / 2;

    return (
      <div
        title={hint}
        data-slider-row
        className={cn(
          'nodrag nopan group relative flex h-8 items-center justify-between gap-2 overflow-hidden rounded-md bg-muted px-2.5',
          'cursor-ew-resize select-none touch-pan-y',
          'has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring',
          '[@media(pointer:coarse)]:h-11',
          // A run of rows reads as one table, whatever gap the parent sets.
          '[&:has(+[data-slider-row])]:!mb-1',
          disabled && 'pointer-events-none opacity-40',
          className
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => {
          if (hasReset && !disabled) onChange(resetValue);
        }}
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 transition-colors duration-[var(--dur-fast)]',
            dragging ? 'bg-border-hover' : 'bg-border group-hover:bg-border-hover'
          )}
          style={{
            left: `${Math.min(origin, percentage)}%`,
            width: `${Math.abs(percentage - origin)}%`,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 w-px bg-muted-foreground"
          style={{ left: `${percentage}%` }}
        />
        {hasReset && (
          <span
            aria-hidden
            data-slider-default
            className="pointer-events-none absolute bottom-0 h-1 w-px bg-foreground"
            style={{ left: `${toPercent(resetValue)}%` }}
          />
        )}
        <span
          className={cn(
            'relative min-w-0 truncate text-xs transition-colors duration-[var(--dur-fast)]',
            dragging || changed
              ? 'text-foreground'
              : 'text-muted-foreground group-hover:text-foreground'
          )}
        >
          {label}
        </span>
        {draft === null ? (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={`${label}: ${t('canvasNodes.shared.typeValue')}`}
            className="relative shrink-0 cursor-text text-xs font-mono tabular-nums text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={() => setDraft(String(value))}
          >
            {number}
            {unit && <span className="ml-px text-muted-foreground">{unit}</span>}
          </button>
        ) : (
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            aria-label={label}
            value={draft}
            className="relative w-16 shrink-0 bg-transparent text-right text-xs font-mono tabular-nums text-foreground outline-none"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft();
              if (e.key === 'Escape') setDraft(null);
            }}
          />
        )}
        {/* Out of the way of the pointer, there for the keyboard and for screen readers. */}
        <input
          ref={ref}
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          {...props}
        />
      </div>
    );
  }
);
NodeSlider.displayName = 'NodeSlider';

export { NodeSlider };
