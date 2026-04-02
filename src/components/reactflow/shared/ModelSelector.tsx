import React, { useCallback, useMemo } from 'react';
import { GEMINI_MODELS, AVAILABLE_IMAGE_MODELS, MODEL_CONFIG, isAdvancedModel, getModelConfig } from '@/constants/geminiModels';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { isGenerationUnlimited } from '@/utils/unlimitedChecker';
import { useLayout } from '@/hooks/useLayout';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
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
 * Uses a Select menu to support multiple models efficiently.
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

  const handleModelClick = useCallback((newModel: string) => {
    const modelId = newModel as GeminiModel;
    if (disabled || modelId === selectedModel) return;

    onModelChange(modelId);

    // Sync logic helpers
    const config = getModelConfig(modelId);

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

  const options = useMemo(() => {
    return AVAILABLE_IMAGE_MODELS.map(modelId => {
      const config = MODEL_CONFIG[modelId];
      if (!config) return null;

      const effectiveResolution = isAdvancedModel(modelId) ? (selectedModel === modelId ? resolution : config?.defaultResolution) : undefined;
      const credits = getCreditsRequired(modelId, effectiveResolution);
      const isUnlimited = isGenerationUnlimited({
        model: modelId,
        resolution: effectiveResolution,
        planMetadata
      });

      const creditSuffix = isUnlimited 
        ? ' (∞)' 
        : ` (${credits})`;

      return {
        value: modelId,
        label: `${config.label}${creditSuffix}`,
      };
    }).filter(Boolean) as any[];
  }, [AVAILABLE_IMAGE_MODELS, resolution, selectedModel, planMetadata, t]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <NodeLabel className="mb-1.5 text-[10px]">
        {t('canvasNodes.promptNode.model')}
      </NodeLabel>
      <Select
        options={options}
        value={selectedModel}
        onChange={handleModelClick}
        disabled={disabled}
        variant="node"
        placeholder={t('canvasNodes.promptNode.selectModel') || 'Select Model'}
      />
    </div>
  );
};
