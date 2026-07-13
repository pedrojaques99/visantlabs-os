import React, { useState } from 'react';
import type { AspectRatio } from '@/types/types';
import { cn } from '@/lib/utils';
import { NodeButton } from './node-button';

interface AspectRatioSelectorProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
  /** Compact mode for canvas nodes (smaller tiles). */
  compact?: boolean;
  /**
   * Explicit ratio list. When provided, the selector renders exactly these
   * (no "More" expander) — this is how each surface (mockup dialog, mockup
   * machine) picks its own set while sharing ONE component (SSoT). When omitted
   * it falls back to the canvas-node behaviour: MAIN set + a "More" expander.
   */
  ratios?: AspectRatio[];
}

const MAIN_ASPECT_RATIOS: AspectRatio[] = ['16:9', '1:1', '4:3', '9:16'];
const OTHER_ASPECT_RATIOS: AspectRatio[] = ['21:9', '2:3', '3:2', '3:4', '4:5', '5:4'];

/** True-proportion shape dimensions (longest side = `box` px). Drives a real
 *  rectangle per ratio instead of a fixed square/blob — the reason surfaces used
 *  to fork this component. */
function shapeDims(ratio: AspectRatio, box: number): { width: number; height: number } {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return { width: box, height: box };
  return {
    width: w >= h ? box : Math.round((w / h) * box),
    height: h >= w ? box : Math.round((h / w) * box),
  };
}

const RatioTile: React.FC<{
  ratio: AspectRatio;
  selected: boolean;
  disabled?: boolean;
  compact: boolean;
  onSelect: () => void;
}> = ({ ratio, selected, disabled, compact, onSelect }) => {
  const box = compact ? 16 : 20;
  const { width, height } = shapeDims(ratio, box);
  return (
    <NodeButton
      variant="ghost"
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      // Nodes need mousedown-stop so the click doesn't drag the node.
      onMouseDown={compact ? (e) => e.stopPropagation() : undefined}
      className={cn(
        'group flex flex-col items-center justify-center gap-1.5 rounded-xl border transition-colors',
        compact ? 'w-12 py-2' : 'flex-1 py-3',
        selected ? 'border-brand-cyan/40 bg-brand-cyan/[0.08]'
          : 'border-neutral-800 bg-white/[0.02] hover:border-neutral-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className="flex items-center justify-center" style={{ width: box, height: box }}>
        <span
          style={{ width, height }}
          className={cn(
            'rounded-[3px] border transition-colors',
            selected ? 'border-brand-cyan bg-brand-cyan/25'
              : 'border-neutral-500 group-hover:border-neutral-400'
          )}
        />
      </span>
      <span
        className={cn(
          'text-[10px] font-mono tabular-nums leading-none transition-colors',
          selected ? 'text-brand-cyan' : 'text-neutral-500'
        )}
      >
        {ratio}
      </span>
    </NodeButton>
  );
};

/**
 * Single source of truth for aspect-ratio selection across the app (mockup
 * dialog, mockup machine, canvas nodes). Renders a real proportioned rectangle
 * per ratio, all always visible, with a brand-cyan selected state.
 */
export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false,
  ratios,
}) => {
  const [showOther, setShowOther] = useState(false);

  // Explicit list (surfaces that pass their own set) → flat render, no expander.
  if (ratios) {
    return (
      <div className={cn('flex gap-2', compact && 'flex-wrap')}>
        {ratios.map((r) => (
          <RatioTile
            key={r}
            ratio={r}
            selected={value === r}
            disabled={disabled}
            compact={compact}
            onSelect={() => onChange(r)}
          />
        ))}
      </div>
    );
  }

  // Default (canvas nodes): MAIN set + a "More" expander for the long tail.
  const isOtherSelected = !MAIN_ASPECT_RATIOS.includes(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {MAIN_ASPECT_RATIOS.map((r) => (
          <RatioTile
            key={r}
            ratio={r}
            selected={value === r}
            disabled={disabled}
            compact={compact}
            onSelect={() => onChange(r)}
          />
        ))}
        <NodeButton
          variant="ghost"
          onClick={() => !disabled && setShowOther((v) => !v)}
          disabled={disabled}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'flex w-12 flex-col items-center justify-center rounded-xl border py-2 transition-colors',
            isOtherSelected ? 'border-brand-cyan/40 bg-brand-cyan/[0.08] text-brand-cyan'
              : 'border-neutral-800 bg-white/[0.02] text-neutral-500 hover:border-neutral-700',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className="text-[11px] font-mono leading-none">•••</span>
        </NodeButton>
      </div>

      {showOther && (
        <div className="flex flex-wrap gap-2 border-t border-neutral-800/50 pt-2">
          {OTHER_ASPECT_RATIOS.map((r) => (
            <RatioTile
              key={r}
              ratio={r}
              selected={value === r}
              disabled={disabled}
              compact={compact}
              onSelect={() => {
                onChange(r);
                setShowOther(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
