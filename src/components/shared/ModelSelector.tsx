import React, { useCallback, useMemo, useEffect } from 'react';
import { 
  CHAT_MODELS, 
  MODEL_CONFIG, 
  AVAILABLE_IMAGE_MODELS, 
  isAdvancedModel, 
  getModelConfig 
} from '../../constants/geminiModels';
import { 
  SEEDREAM_IMAGE_MODELS, 
  SEEDREAM_MODEL_CONFIG, 
  isSeedreamModel, 
  getSeedreamModelConfig 
} from '../../constants/seedreamModels';
import { Select } from '@/components/ui/select';
import { cn } from '../../lib/utils';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { isGenerationUnlimited } from '@/utils/unlimitedChecker';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import type { GeminiModel, SeedreamModel, ImageProvider, Resolution } from '@/types/types';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string, provider?: ImageProvider) => void;
  className?: string;
  type?: 'chat' | 'image';
  variant?: 'default' | 'node';
  resolution?: Resolution;
  disabled?: boolean;
  /** If provided, will sync resolution to model's default when it doesn't exist */
  onSyncResolution?: (res: Resolution) => void;
  /** If provided, will clear resolution/aspectRatio for simple models */
  onClearAdvancedConfig?: () => void;
}

/**
 * Premium Model Selector Component
 * Unified for Chat and Image models with credit/quota intelligence.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  className,
  type = 'chat',
  variant = 'default',
  resolution,
  disabled = false,
  onSyncResolution,
  onClearAdvancedConfig
}) => {
  const { t } = useTranslation();
  const { subscriptionStatus } = useLayout();
  const planMetadata = subscriptionStatus?.planMetadata;
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN || '';

  const options = useMemo(() => {
    // IMAGE MODELS LOGIC
    if (type === 'image') {
      const geminiOptions = AVAILABLE_IMAGE_MODELS.map(modelId => {
        const config = MODEL_CONFIG[modelId];
        if (!config) return null;

        const effectiveResolution = isAdvancedModel(modelId as GeminiModel)
          ? (selectedModel === modelId ? resolution : config?.defaultResolution)
          : undefined;
        
        const credits = getCreditsRequired(modelId, effectiveResolution, 'gemini');
        const isUnlimited = isGenerationUnlimited({ model: modelId, resolution: effectiveResolution, planMetadata });

        const icon = config.providerDomain ? (
          <img 
            src={`https://img.logo.dev/${config.providerDomain}?size=48${token ? `&token=${token}` : ''}`}
            className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
            onError={(e) => (e.currentTarget.style.display = 'none')}
            alt=""
          />
        ) : undefined;

        // Label with dynamic credit info
        const label = variant === 'node' 
          ? `${config.label}${isUnlimited ? ' (∞)' : ` (${credits})`}`
          : config.label;

        return { value: modelId, label: label || modelId, icon };
      }).filter(Boolean) as any[];

      const seedreamOptions = SEEDREAM_IMAGE_MODELS.map(modelId => {
        const config = SEEDREAM_MODEL_CONFIG[modelId];
        if (!config) return null;

        const effectiveResolution = selectedModel === modelId ? resolution : config?.defaultResolution;
        const credits = getCreditsRequired(modelId, effectiveResolution, 'seedream');
        const isUnlimited = isGenerationUnlimited({ model: modelId, resolution: effectiveResolution, planMetadata });

        const icon = config.providerDomain ? (
          <img 
            src={`https://img.logo.dev/${config.providerDomain}?size=48${token ? `&token=${token}` : ''}`}
            className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
            onError={(e) => (e.currentTarget.style.display = 'none')}
            alt=""
          />
        ) : undefined;

        const label = variant === 'node'
          ? `${config.label}${isUnlimited ? ' (∞)' : ` (${credits})`}`
          : config.label;

        return { value: modelId, label: label || modelId, icon };
      }).filter(Boolean) as any[];

      return [...geminiOptions, ...seedreamOptions];
    }

    // CHAT MODELS LOGIC
    return CHAT_MODELS.map(modelId => {
      const config = MODEL_CONFIG[modelId];
      return {
        value: modelId,
        label: config?.label || modelId,
        icon: config?.providerDomain ? (
          <img 
            src={`https://img.logo.dev/${config.providerDomain}?token=${token}`}
            className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
            onError={(e) => (e.currentTarget.style.display = 'none')}
            alt=""
          />
        ) : undefined
      };
    });
  }, [type, selectedModel, resolution, planMetadata, token, variant]);

  // Normalization logic for image models
  const effectiveModel = useMemo(() => {
    if (type !== 'image' || !options.length) return selectedModel;
    return options.some(o => o.value === selectedModel) ? selectedModel : options[0].value;
  }, [selectedModel, options, type]);

  // Sync parent if normalization occurred (only for image type)
  useEffect(() => {
    if (type === 'image' && effectiveModel !== selectedModel) {
      const provider: ImageProvider = isSeedreamModel(effectiveModel) ? 'seedream' : 'gemini';
      onModelChange(effectiveModel, provider);
    }
  }, [effectiveModel, selectedModel, onModelChange, type]);

  const handleValueChange = useCallback((newModel: string) => {
    if (disabled || newModel === selectedModel) return;

    if (type === 'image') {
      const provider: ImageProvider = isSeedreamModel(newModel) ? 'seedream' : 'gemini';
      onModelChange(newModel, provider);

      if (provider === 'seedream') {
        const sdConfig = getSeedreamModelConfig(newModel);
        if (sdConfig && !resolution && onSyncResolution) {
          onSyncResolution(sdConfig.defaultResolution);
        }
      } else {
        const config = getModelConfig(newModel as GeminiModel);
        if (config.supportsImageConfig) {
          if (!resolution && onSyncResolution && config.defaultResolution) {
            onSyncResolution(config.defaultResolution);
          }
        } else if (onClearAdvancedConfig) {
          onClearAdvancedConfig();
        }
      }
    } else {
      onModelChange(newModel);
    }
  }, [disabled, selectedModel, onModelChange, type, resolution, onSyncResolution, onClearAdvancedConfig]);

  return (
    <div className={cn("flex flex-col gap-1.5", variant === 'node' && "min-w-[140px]", className)}>
      {variant === 'node' && (
        <label className="text-[10px] text-neutral-400 font-mono mb-1.5 block tracking-tight">
          {t('canvasNodes.promptNode.model') || 'MODEL'}
        </label>
      )}
      <Select
        variant="node"
        options={options}
        value={effectiveModel}
        onChange={handleValueChange}
        disabled={disabled}
        placeholder={t('canvasNodes.promptNode.selectModel') || 'Select Model'}
        className={cn(
          type === 'chat' && "!bg-transparent border-white/5 hover:border-white/10 !px-2 !py-0.5 h-auto",
          type === 'chat' && "text-xs opacity-70 hover:opacity-100 transition-opacity",
          className
        )}
      />
    </div>
  );
};
