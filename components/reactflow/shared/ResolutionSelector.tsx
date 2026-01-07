import React from 'react';
import type { Resolution } from '../../../types';
import { cn } from '../../../lib/utils';
import { getCreditsRequired } from '../../../utils/creditCalculator';
import type { GeminiModel } from '../../../types';

interface ResolutionSelectorProps {
  value: Resolution;
  onChange: (resolution: Resolution) => void;
  model: GeminiModel;
  disabled?: boolean;
  compact?: boolean; // Compact mode for nodes
}

export const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  value,
  onChange,
  model,
  disabled = false,
  compact = false
}) => {
  const resolutions: Resolution[] = ['1K', '2K', '4K'];

  if (compact) {
    // Compact version for nodes
    return (
      <div className="flex gap-1.5">
        {resolutions.map((res) => {
          const isSelected = value === res;
          const credits = getCreditsRequired(model, res);

          return (
            <button
              key={res}
              onClick={() => !disabled && onChange(res)}
              disabled={disabled}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-mono rounded border transition-all',
                isSelected
                  ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                  : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:border-zinc-600/50 hover:text-zinc-400',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              title={`${res} (${credits} credits)`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="text-[10px]">{res}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Full version (for sidebar)
  return (
    <div className="flex gap-2">
      {resolutions.map((res) => {
        const isSelected = value === res;
        const credits = getCreditsRequired(model, res);

        return (
          <button
            key={res}
            onClick={() => !disabled && onChange(res)}
            disabled={disabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer',
              isSelected
                ? 'bg-brand-cyan/20 text-brand-cyan border-[brand-cyan]/30'
                : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            title={`${res} (${credits} credits)`}
          >
            {res}
          </button>
        );
      })}
    </div>
  );
};


