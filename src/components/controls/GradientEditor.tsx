import * as React from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, ArrowLeftRight } from '@/lib/ui/icons';
import { SegmentedControl, ExpandableColorPicker } from '@/components/shared/ToolPanel';
import { ScrubInput } from '@/components/ui/ScrubInput';
import {
  type GradientStop,
  type GradientType,
  GRADIENT_TYPE_OPTIONS,
  MAX_GRADIENT_STOPS,
  getGradientCss,
  sortStops,
  addStop,
  removeStop,
  updateStop,
  reverseStops,
  positionFromTrack,
} from './gradient-utils';

export interface GradientValue {
  type: GradientType;
  angle: number;
  stops: GradientStop[];
}

export interface GradientEditorProps {
  value: GradientValue;
  onChange: (value: GradientValue) => void;
  /** Show the linear/radial/angular/diamond type picker (default true). */
  showType?: boolean;
  className?: string;
}

export const DEFAULT_GRADIENT: GradientValue = {
  type: 'linear',
  angle: 90,
  stops: [
    { color: '#22D3EE', position: 0, opacity: 1 },
    { color: '#8B5CF6', position: 1, opacity: 1 },
  ],
};

/**
 * Reusable gradient editor: type + angle + draggable colour stops with a live
 * preview bar. Replaces the one-off editor previously inlined in GradientSection.
 * Stop/CSS math adapted from Pixel Point Toolcraft (MIT). See ./gradient-utils.ts.
 */
export const GradientEditor: React.FC<GradientEditorProps> = ({
  value,
  onChange,
  showType = true,
  className,
}) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<number | null>(null);
  const [active, setActive] = React.useState(0);

  const stops = value.stops;
  const sorted = React.useMemo(() => sortStops(stops), [stops]);
  const previewCss = getGradientCss(value.type, stops, value.angle);
  const barCss = getGradientCss('linear', stops, 90);

  const activeStop = stops[active] ?? stops[0];

  const patch = (next: Partial<GradientValue>) => onChange({ ...value, ...next });

  const onTrackDown = (e: React.PointerEvent) => {
    // Add a stop only when clicking the empty track (not an existing handle).
    if ((e.target as HTMLElement).dataset.stop) return;
    if (stops.length >= MAX_GRADIENT_STOPS) return;
    const pos = positionFromTrack(trackRef.current, e.clientX);
    const res = addStop(stops, pos, activeStop);
    patch({ stops: res.stops });
    setActive(res.index);
  };

  const startDrag = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = index;
    setActive(index);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current === null) return;
    const pos = positionFromTrack(trackRef.current, e.clientX);
    patch({ stops: updateStop(stops, dragRef.current, { position: pos }) });
  };

  const endDrag = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    dragRef.current = null;
  };

  const deleteActive = () => {
    const next = removeStop(stops, active);
    patch({ stops: next });
    setActive((a) => Math.max(0, Math.min(a, next.length - 1)));
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* preview */}
      <div
        className="h-16 w-full rounded-md border border-neutral-800"
        style={{ background: previewCss }}
      />

      {showType && (
        <SegmentedControl
          options={GRADIENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={value.type}
          onChange={(v) => patch({ type: v as GradientType })}
          size="sm"
        />
      )}

      {/* stop track */}
      <div className="pt-2">
        <div
          ref={trackRef}
          onPointerDown={onTrackDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative h-6 rounded-md border border-neutral-800 cursor-copy"
          style={{ background: barCss }}
        >
          {stops.map((s, i) => (
            <button
              key={i}
              type="button"
              data-stop="1"
              aria-label={`Stop ${i + 1}`}
              onPointerDown={startDrag(i)}
              className={cn(
                'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow cursor-grab active:cursor-grabbing touch-none',
                active === i ? 'border-white ring-1 ring-brand-cyan' : 'border-neutral-300'
              )}
              style={{ left: `${s.position * 100}%`, backgroundColor: s.color }}
            />
          ))}
        </div>
      </div>

      {/* active stop editor */}
      {activeStop && (
        <div className="space-y-2 rounded-md border border-neutral-800/60 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Stop {sorted.indexOf(activeStop) + 1} / {stops.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => patch({ stops: reverseStops(stops) })}
                title="Reverse stops"
                className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
              >
                <ArrowLeftRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (stops.length >= MAX_GRADIENT_STOPS) return;
                  const res = addStop(stops, Math.min(1, (activeStop.position ?? 0) + 0.1), activeStop);
                  patch({ stops: res.stops });
                  setActive(res.index);
                }}
                title="Add stop"
                className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors disabled:opacity-30"
                disabled={stops.length >= MAX_GRADIENT_STOPS}
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={deleteActive}
                title="Remove stop"
                className="p-1 text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-30"
                disabled={stops.length <= 2}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <ExpandableColorPicker
            color={activeStop.color}
            onChange={(hex) => patch({ stops: updateStop(stops, active, { color: hex }) })}
            label="Stop color"
          />

          <div className="grid grid-cols-2 gap-2">
            <ScrubInput
              label="Position"
              value={Math.round((activeStop.position ?? 0) * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => patch({ stops: updateStop(stops, active, { position: v / 100 }) })}
            />
            <ScrubInput
              label="Opacity"
              value={Math.round((activeStop.opacity ?? 1) * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => patch({ stops: updateStop(stops, active, { opacity: v / 100 }) })}
            />
          </div>

          {value.type === 'linear' && (
            <ScrubInput
              label="Angle"
              value={value.angle}
              min={0}
              max={360}
              suffix="°"
              onChange={(v) => patch({ angle: v })}
            />
          )}
        </div>
      )}
    </div>
  );
};
