import React from 'react';
import type { Resolution, GeminiModel } from '@/types/types';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { cn } from '@/lib/utils';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { Select } from '@/components/ui/select';
import { NodeButton } from './node-button';

const VIDEO_RESOLUTIONS: Resolution[] = ['720p', '1080p'];
const IMAGE_RESOLUTIONS: Resolution[] = ['512px', '1K', '2K', '4K'];

interface ResolutionSelectorProps {
  value: Resolution;
  onChange: (resolution: Resolution) => void;
  onModelChange?: (model: GeminiModel) => void;
  model: GeminiModel;
  disabled?: boolean;
  compact?: boolean; // Compact mode for nodes
  allowVideo?: boolean;
}

function renderResolutionButton(
  res: Resolution,
  value: Resolution,
  model: GeminiModel,
  disabled: boolean,
  onChange: (r: Resolution) => void,
  onModelChange: ((m: GeminiModel) => void) | undefined,
  compact: boolean,
  onMouseDown?: (e: React.MouseEvent) => void
) {
  const isSelected = value === res;
  const credits = getCreditsRequired(model, res);

  const handleClick = () => {
    if (disabled) return;
    
    // Auto-switch model logic
    if (res === '512px') {
      if (onModelChange) onModelChange(GEMINI_MODELS.FLASH);
    } else if (IMAGE_RESOLUTIONS.includes(res) && model === GEMINI_MODELS.FLASH) {
      if (onModelChange) onModelChange(GEMINI_MODELS.PRO);
    }
    
    onChange(res);
  };

  return (
    <NodeButton variant="ghost"
      key={res}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        compact
          ? 'flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-mono transition-all min-w-0'
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
    </NodeButton>
  );
}

export const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  value,
  onChange,
  onModelChange,
  model,
  disabled = false,
  compact = false,
  allowVideo = false
}) => {
  const isVideo = String(model).startsWith('veo-');
  const resolutions = (isVideo && allowVideo) ? VIDEO_RESOLUTIONS : IMAGE_RESOLUTIONS;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-[var(--node-gap-sm)]">
        {resolutions.map((res) =>
          renderResolutionButton(res, value, model, disabled, onChange, onModelChange, true, (e) =>
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
          options={resolutions.map((res) => ({
            value: res,
            label: `${res} (${getCreditsRequired(model, res)} credits)`
          }))}
          placeholder="Select resolution"
          disabled={disabled}
        />
      </div>
      <div className="hidden md:grid grid-cols-4 gap-2">
        {resolutions.map((res) =>
          renderResolutionButton(res, value, model, disabled, onChange, onModelChange, false)
        )}
      </div>
    </>
  );
};
