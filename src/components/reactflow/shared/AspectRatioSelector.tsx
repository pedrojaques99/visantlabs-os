import React, { useState } from 'react';
import type { AspectRatio } from '@/types/types';
import { cn } from '@/lib/utils';
import { NodeButton } from './node-button';

interface AspectRatioSelectorProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
  compact?: boolean; // Compact mode for nodes
}

const MAIN_ASPECT_RATIOS: AspectRatio[] = ['16:9', '1:1', '4:3', '9:16'];
const OTHER_ASPECT_RATIOS: AspectRatio[] = ['21:9', '2:3', '3:2', '3:4', '4:5', '5:4'];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false
}) => {
  const [showOther, setShowOther] = useState(false);
  const isOtherSelected = !MAIN_ASPECT_RATIOS.includes(value);

  if (compact) {
    // Compact version for nodes
    return (
      <div className="space-y-[var(--node-space-y-sm)]">
        <div className="flex flex-wrap gap-[var(--node-gap-sm)]">
          {MAIN_ASPECT_RATIOS.map((ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            const isLandscape = w > h;
            const isSquare = w === h;
            const isSelected = value === ratio;

            return (
              <NodeButton variant="ghost"
                key={ratio}
                onClick={() => !disabled && onChange(ratio)}
                disabled={disabled}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-12 h-11 text-xs font-mono transition-all px-0',
                  isSelected
                    ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                    : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                /* onMouseDown removed to allow node selection */
              >
                <div className={cn(
                  isSquare ? 'w-4 h-4' : isLandscape ? 'w-6 h-3.5' : 'w-3.5 h-6',
                  'border rounded-sm shrink-0',
                  isSelected ? 'border-[brand-cyan]/60 bg-brand-cyan/20' : 'border-neutral-600/50'
                )} />
                <span className="text-[9px] leading-none">{ratio}</span>
              </NodeButton>
            );
          })}

          <NodeButton variant="ghost"
            onClick={() => !disabled && setShowOther(!showOther)}
            disabled={disabled}
            className={cn(
              'flex items-center justify-center w-10 h-11 text-xs font-mono transition-all',
              isOtherSelected
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-[9px] leading-none">...</span>
          </NodeButton>
        </div>


        {showOther && (
          <div className="pt-1.5 border-t border-neutral-700/30">
            <div className="flex flex-wrap gap-1.5">
              {OTHER_ASPECT_RATIOS.map((ratio) => {
                const [w, h] = ratio.split(':').map(Number);
                const isLandscape = w > h;
                const isSquare = w === h;
                const isSelected = value === ratio;

                return (
                  <NodeButton variant="ghost"
                    key={ratio}
                    onClick={() => {
                      if (!disabled) {
                        onChange(ratio);
                        setShowOther(false);
                      }
                    }}
                    disabled={disabled}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 w-12 h-11 text-xs font-mono transition-all px-0',
                      isSelected
                        ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                        : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      isSquare ? 'w-4 h-4' : isLandscape ? 'w-6 h-3.5' : 'w-3.5 h-6',
                      'border rounded-sm shrink-0',
                      isSelected ? 'border-[brand-cyan]/60 bg-brand-cyan/20' : 'border-neutral-600/50'
                    )} />
                    <span className="text-[9px] leading-none">{ratio}</span>
                  </NodeButton>
                );
              })}
            </div>

          </div>
        )}
      </div>
    );
  }

  // Full version (for sidebar)
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {MAIN_ASPECT_RATIOS.map((ratio) => {
        const [w, h] = ratio.split(':').map(Number);
        const isLandscape = w > h;
        const isSquare = w === h;
        const isSelected = value === ratio;

        return (
          <NodeButton variant="ghost"
            key={ratio}
            onClick={() => !disabled && onChange(ratio)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border',
              isSelected
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40 cursor-pointer'
                : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400 cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn(
              isSquare ? 'w-6 h-6' : isLandscape ? 'w-8 h-5' : 'w-5 h-8',
              'border rounded-md',
              isSelected ? 'border-[brand-cyan]/60' : 'border-neutral-600/50'
            )} />
            <span className="text-[10px] mt-0.5">{ratio}</span>
          </NodeButton>
        );
      })}

      <NodeButton variant="ghost"
        onClick={() => !disabled && setShowOther(!showOther)}
        disabled={disabled}
        className={cn(
          'flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer',
          isOtherSelected
            ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
            : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="text-[10px]">More</span>
      </NodeButton>

      {showOther && (
        <div className="mt-3 pt-3 border-t border-neutral-700/30 animate-fade-in w-full">
          <div className="flex flex-wrap justify-center gap-2">
            {OTHER_ASPECT_RATIOS.map((ratio) => {
              const [w, h] = ratio.split(':').map(Number);
              const isLandscape = w > h;
              const isSquare = w === h;
              const isSelected = value === ratio;

              return (
                <NodeButton variant="ghost"
                  key={ratio}
                  onClick={() => {
                    if (!disabled) {
                      onChange(ratio);
                      setShowOther(false);
                    }
                  }}
                  disabled={disabled}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer',
                    isSelected
                      ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                      : 'bg-neutral-800/30 text-neutral-500 border-neutral-700/30 hover:border-neutral-600/50 hover:text-neutral-400',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className={cn(
                    isSquare ? 'w-6 h-6' : isLandscape ? 'w-8 h-5' : 'w-5 h-8',
                    'border rounded-md',
                    isSelected ? 'border-[brand-cyan]/60' : 'border-neutral-600/50'
                  )} />
                  <span className="text-[10px] mt-0.5">{ratio}</span>
                </NodeButton>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
