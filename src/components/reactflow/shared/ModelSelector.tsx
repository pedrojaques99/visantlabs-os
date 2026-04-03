import React, { useCallback, useMemo, useEffect } from 'react';
import { GEMINI_MODELS, AVAILABLE_IMAGE_MODELS, MODEL_CONFIG, isAdvancedModel, getModelConfig } from '@/constants/geminiModels';
import { SEEDREAM_IMAGE_MODELS, SEEDREAM_MODEL_CONFIG, isSeedreamModel, getSeedreamModelConfig } from '@/constants/seedreamModels';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { isGenerationUnlimited } from '@/utils/unlimitedChecker';
import { useLayout } from '@/hooks/useLayout';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { NodeLabel } from './node-label';
import { useTranslation } from '@/hooks/useTranslation';
import type { GeminiModel, SeedreamModel, ImageProvider, Resolution } from '@/types/types';

interface ModelSelectorProps {
  selectedModel: GeminiModel | SeedreamModel | string;
  onModelChange: (model: GeminiModel | SeedreamModel, provider: ImageProvider) => void;
  resolution?: Resolution;
  disabled?: boolean;
  className?: string;
  /** If provided, will sync resolution to model's default when it doesn't exist */
  onSyncResolution?: (res: Resolution) => void;
  /** If provided, will clear resolution/aspectRatio for simple models */
  onClearAdvancedConfig?: () => void;
}

/**
 * Reusable Model Selector for React Flow nodes.
 * Shows all image generation models: Gemini + Seedream.
 * Calls onModelChange with the model ID and the derived provider.
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

  const options = useMemo(() => {
    const geminiOptions = AVAILABLE_IMAGE_MODELS.map(modelId => {
      const config = MODEL_CONFIG[modelId];
      if (!config) return null;

      const effectiveResolution = isAdvancedModel(modelId)
        ? (selectedModel === modelId ? resolution : config?.defaultResolution)
        : undefined;
      const credits = getCreditsRequired(modelId, effectiveResolution, 'gemini');
      const isUnlimited = isGenerationUnlimited({ model: modelId, resolution: effectiveResolution, planMetadata });

      const logoToken = import.meta.env.VITE_LOGO_DEV_TOKEN;
      const icon = config.providerDomain ? (
        <img 
          src={`https://img.logo.dev/${config.providerDomain}?size=48${logoToken ? `&token=${logoToken}` : ''}`} 
          alt={config.label}
          className="w-3.5 h-3.5 rounded-sm object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : undefined;

      return {
        value: modelId,
        label: `${config.label}${isUnlimited ? ' (∞)' : ` (${credits})`}`,
        icon
      };
    }).filter(Boolean) as { value: string; label: string; icon?: React.ReactNode }[];

    const seedreamOptions = SEEDREAM_IMAGE_MODELS.map(modelId => {
      const config = SEEDREAM_MODEL_CONFIG[modelId];
      const effectiveResolution = selectedModel === modelId ? resolution : config?.defaultResolution;
      const credits = getCreditsRequired(modelId, effectiveResolution, 'seedream');
      const isUnlimited = isGenerationUnlimited({ model: modelId, resolution: effectiveResolution, planMetadata });

      const logoToken = import.meta.env.VITE_LOGO_DEV_TOKEN;
      const icon = config.providerDomain ? (
        <img 
          src={`https://img.logo.dev/${config.providerDomain}?size=48${logoToken ? `&token=${logoToken}` : ''}`} 
          alt={config.label}
          className="w-3.5 h-3.5 rounded-sm object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : undefined;

      return {
        value: modelId,
        label: `${config.label}${isUnlimited ? ' (∞)' : ` (${credits})`}`,
        icon
      };
    });

    return [...geminiOptions, ...seedreamOptions];
  }, [resolution, selectedModel, planMetadata]);

  // Normalize: if selectedModel isn't in options, fall back to first image model
  const effectiveModel = useMemo(() => {
    if (!options.length) return selectedModel;
    return options.some(o => o.value === selectedModel) ? selectedModel : options[0].value;
  }, [selectedModel, options]);

  // Sync parent if we had to normalize the value
  useEffect(() => {
    if (effectiveModel !== selectedModel) {
      const provider: ImageProvider = isSeedreamModel(effectiveModel) ? 'seedream' : 'gemini';
      onModelChange(effectiveModel as GeminiModel | SeedreamModel, provider);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveModel]);

  const handleModelClick = useCallback((newModel: string) => {
    if (disabled || newModel === selectedModel) return;

    const provider: ImageProvider = isSeedreamModel(newModel) ? 'seedream' : 'gemini';
    onModelChange(newModel as GeminiModel | SeedreamModel, provider);

    if (provider === 'seedream') {
      // Seedream: sync to model's default resolution
      const sdConfig = getSeedreamModelConfig(newModel);
      if (sdConfig && !resolution && onSyncResolution) {
        onSyncResolution(sdConfig.defaultResolution);
      }
    } else {
      // Gemini
      const config = getModelConfig(newModel as GeminiModel);
      if (config.supportsImageConfig) {
        if (!resolution && onSyncResolution && config.defaultResolution) {
          onSyncResolution(config.defaultResolution);
        }
      } else {
        if (onClearAdvancedConfig) {
          onClearAdvancedConfig();
        }
      }
    }
  }, [disabled, selectedModel, onModelChange, resolution, onSyncResolution, onClearAdvancedConfig]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <NodeLabel className="mb-1.5 text-[10px]">
        {t('canvasNodes.promptNode.model')}
      </NodeLabel>
      <Select
        options={options}
        value={effectiveModel}
        onChange={handleModelClick}
        disabled={disabled}
        variant="node"
        placeholder={t('canvasNodes.promptNode.selectModel') || 'Select Model'}
      />
    </div>
  );
};
