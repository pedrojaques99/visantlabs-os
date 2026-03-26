import React, { useCallback } from 'react';
import { GEMINI_MODELS, IMAGE_MODELS, MODEL_CONFIG, isAdvancedModel, getModelConfig } from '@/constants/geminiModels';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { isGenerationUnlimited } from '@/utils/unlimitedChecker';
import { useLayout } from '@/hooks/useLayout';
import { cn } from '@/lib/utils';
import { NodeButton } from './node-button';
import { NodeLabel } from './node-label';
import { useTranslation } from '@/hooks/useTranslation';
import type { GeminiModel, Resolution } from '@/types/types';

interface ModelSelectorProps {
  selectedModel: GeminiModel;
  onModelChange: (model: GeminiModel) => void;
  resolution?: Resolution;
  disabled?: boolean;
  className?: string;
  /** If provided, will sync resolution to model's default when it doesn't exist */
  onSyncResolution?: (res: Resolution) => void;
  /** If provided, will clear resolution/aspectRatio for simple models */
  onClearAdvancedConfig?: () => void;
}

/**
 * Reusable Model Selector component for React Flow nodes.
 * Centralizes model selection logic, credits display, and styling.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  resolution,
  disabled = false,
  className,
  onSyncResolution,
  onClearAdvancedConfig
}) => {
  const { t } = useTranslation();
  const { subscriptionStatus } = useLayout();
  const planMetadata = subscriptionStatus?.planMetadata;

  const handleModelClick = useCallback((newModel: GeminiModel) => {
    if (disabled || newModel === selectedModel) return;

    onModelChange(newModel);

    // Sync logic helpers
    const config = getModelConfig(newModel);

    if (config.supportsImageConfig) {
      if (!resolution && onSyncResolution && config.defaultResolution) {
        onSyncResolution(config.defaultResolution);
      }
    } else {
      if (onClearAdvancedConfig) {
        onClearAdvancedConfig();
      }
    }
  }, [disabled, selectedModel, onModelChange, resolution, onSyncResolution, onClearAdvancedConfig]);

  // Dynamic model list: Always IMAGE_NB2, and then either IMAGE_FLASH or IMAGE_PRO
  // If IMAGE_FLASH is selected, show it. If IMAGE_PRO is selected or IMAGE_NB2 is selected, show IMAGE_PRO.
  const modelsToShow = [
    GEMINI_MODELS.IMAGE_NB2,
    selectedModel === GEMINI_MODELS.IMAGE_FLASH ? GEMINI_MODELS.IMAGE_FLASH : GEMINI_MODELS.IMAGE_PRO
  ];

  return (
    <div className={cn("space-y-1.5", className)}>
      <NodeLabel className="mb-1.5 text-[10px]">
        {t('canvasNodes.promptNode.model')}
      </NodeLabel>
      <div className="grid grid-cols-2 gap-2">
        {modelsToShow.map((modelId) => {
          const config = MODEL_CONFIG[modelId];
          if (!config) return null; // Skip models without config
          const isSelected = selectedModel === modelId;
          const effectiveResolution = isAdvancedModel(modelId) ? (isSelected ? resolution : config?.defaultResolution) : undefined;
          const credits = getCreditsRequired(modelId, effectiveResolution);
          const isUnlimited = isGenerationUnlimited({
            model: modelId,
            resolution: effectiveResolution,
            planMetadata
          });

          return (
            <NodeButton
              key={modelId}
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleModelClick(modelId);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={disabled}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-1 h-14 text-xs font-mono rounded border transition-colors cursor-pointer node-interactive',
                isSelected
                  ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                  : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}

            >
              <span className="text-sm">{config.emoji} {config.label}</span>
              {isUnlimited ? (
                <span className="text-[10px] text-brand-cyan font-bold mt-0.5">
                  ∞ UNLIMITED
                </span>
              ) : (
                <span className="text-[10px] text-neutral-500 mt-0.5">
                  {credits} {t('canvasNodes.promptNode.credits')}
                </span>
              )}
            </NodeButton>
          );
        })}
      </div>
    </div>
  );
};
