import React from 'react';
import type { Resolution } from '@/types/types';
import { cn } from '@/lib/utils';
import { getCreditsRequired } from '@/utils/creditCalculator';
import type { GeminiModel } from '@/types/types';
import { Select } from '@/components/ui/select';

const ALL_RESOLUTIONS: Resolution[] = ['1K', '2K', '4K', '720p', '1080p'];

interface ResolutionSelectorProps {
  value: Resolution;
  onChange: (resolution: Resolution) => void;
  model: GeminiModel;
  disabled?: boolean;
  compact?: boolean; // Compact mode for nodes
}

function renderResolutionButton(
  res: Resolution,
  value: Resolution,
  model: GeminiModel,
  disabled: boolean,
  onChange: (r: Resolution) => void,
  compact: boolean,
  onMouseDown?: (e: React.MouseEvent) => void
) {
  const isSelected = value === res;
  const credits = getCreditsRequired(model, res);

  return (
    <button
      key={res}
      onClick={() => !disabled && onChange(res)}
      disabled={disabled}
      className={cn(
        compact
          ? 'flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-mono rounded border transition-all min-w-0'
          : 'flex flex-col items-center justify-center gap-1 py-2 px-3 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer',
        isSelected
          ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
          : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      title={`${res} (${credits} credits)`}
      onMouseDown={onMouseDown}
    >
      <span className={compact ? 'text-[10px]' : 'font-semibold'}>{res}</span>
      {!compact && <span className="text-[10px] text-neutral-500">{credits}c</span>}
    </button>
  );
}

export const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  value,
  onChange,
  model,
  disabled = false,
  compact = false
}) => {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {ALL_RESOLUTIONS.map((res) =>
          renderResolutionButton(res, value, model, disabled, onChange, true, (e) =>
            e.stopPropagation()
          )
        )}
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <Select
          value={value}
          onChange={(v) => onChange(v as Resolution)}
          options={ALL_RESOLUTIONS.map((res) => ({
            value: res,
            label: `${res} (${getCreditsRequired(model, res)} credits)`
          }))}
          placeholder="Select resolution"
          disabled={disabled}
        />
      </div>
      <div className="hidden md:grid grid-cols-5 gap-2">
        {ALL_RESOLUTIONS.map((res) =>
          renderResolutionButton(res, value, model, disabled, onChange, false)
        )}
      </div>
    </>
  );
};

