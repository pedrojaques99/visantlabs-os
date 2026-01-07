import React, { useState } from 'react';
import type { AspectRatio } from '../../../types';
import { cn } from '../../../lib/utils';

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
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {MAIN_ASPECT_RATIOS.map((ratio) => {
            const [w, h] = ratio.split(':').map(Number);
            const isLandscape = w > h;
            const isPortrait = h > w;
            const isSquare = w === h;
            const isSelected = value === ratio;

            return (
              <button
                key={ratio}
                onClick={() => !disabled && onChange(ratio)}
                disabled={disabled}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs font-mono rounded border transition-all',
                  isSelected
                    ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                    : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:border-zinc-600/50 hover:text-zinc-400',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={cn(
                  isSquare ? 'w-4 h-4' : isLandscape ? 'w-5 h-3' : 'w-3 h-5',
                  'border rounded',
                  isSelected ? 'border-[brand-cyan]/60' : 'border-zinc-600/50'
                )} />
                <span className="text-[9px] leading-none">{ratio}</span>
              </button>
            );
          })}

          <button
            onClick={() => !disabled && setShowOther(!showOther)}
            disabled={disabled}
            className={cn(
              'flex items-center justify-center py-1 px-2 text-xs font-mono rounded border transition-all',
              isOtherSelected
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:border-zinc-600/50 hover:text-zinc-400',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-[9px] leading-none">...</span>
          </button>
        </div>

        {showOther && (
          <div className="pt-1.5 border-t border-zinc-700/30">
            <div className="flex flex-wrap gap-1.5">
              {OTHER_ASPECT_RATIOS.map((ratio) => {
                const [w, h] = ratio.split(':').map(Number);
                const isLandscape = w > h;
                const isPortrait = h > w;
                const isSquare = w === h;
                const isSelected = value === ratio;

                return (
                  <button
                    key={ratio}
                    onClick={() => {
                      if (!disabled) {
                        onChange(ratio);
                        setShowOther(false);
                      }
                    }}
                    disabled={disabled}
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-xs font-mono rounded border transition-all',
                      isSelected
                        ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                        : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:border-zinc-600/50 hover:text-zinc-400',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      isSquare ? 'w-4 h-4' : isLandscape ? 'w-5 h-3' : 'w-3 h-5',
                      'border rounded',
                      isSelected ? 'border-[brand-cyan]/60' : 'border-zinc-600/50'
                    )} />
                    <span className="text-[9px] leading-none">{ratio}</span>
                  </button>
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
        const isPortrait = h > w;
        const isSquare = w === h;
        const isSelected = value === ratio;

        return (
          <button
            key={ratio}
            onClick={() => !disabled && onChange(ratio)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border',
              isSelected
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40 cursor-pointer'
                : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:border-zinc-600/50 hover:text-zinc-400 cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn(
              isSquare ? 'w-6 h-6' : isLandscape ? 'w-8 h-5' : 'w-5 h-8',
              'border rounded-md',
              isSelected ? 'border-[brand-cyan]/60' : 'border-zinc-600/50'
            )} />
            <span className="text-[10px] mt-0.5">{ratio}</span>
          </button>
        );
      })}

      <button
        onClick={() => !disabled && setShowOther(!showOther)}
        disabled={disabled}
        className={cn(
          'flex flex-col items-center justify-center gap-1 py-1.5 px-4 md:px-5 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer',
          isOtherSelected
            ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
            : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:border-zinc-600/50 hover:text-zinc-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="text-[10px]">More</span>
      </button>

      {showOther && (
        <div className="mt-3 pt-3 border-t border-zinc-700/30 animate-fade-in w-full">
          <div className="flex flex-wrap justify-center gap-2">
            {OTHER_ASPECT_RATIOS.map((ratio) => {
              const [w, h] = ratio.split(':').map(Number);
              const isLandscape = w > h;
              const isPortrait = h > w;
              const isSquare = w === h;
              const isSelected = value === ratio;

              return (
                <button
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
                      : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:border-zinc-600/50 hover:text-zinc-400',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className={cn(
                    isSquare ? 'w-6 h-6' : isLandscape ? 'w-8 h-5' : 'w-5 h-8',
                    'border rounded-md',
                    isSelected ? 'border-[brand-cyan]/60' : 'border-zinc-600/50'
                  )} />
                  <span className="text-[10px] mt-0.5">{ratio}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


