import React, { useCallback, useMemo, useEffect, useState } from 'react';
import {
  CHAT_MODELS,
  MODEL_CONFIG,
  AVAILABLE_IMAGE_MODELS,
  getModelConfig,
} from '../../constants/geminiModels';
import { supportsOutputConfig, resolveGenerationContext } from '@/utils/canvas/generationContext';
import {
  SEEDREAM_IMAGE_MODELS,
  SEEDREAM_MODEL_CONFIG,
  isSeedreamModel,
  getSeedreamModelConfig,
} from '../../constants/seedreamModels';
import {
  OPENAI_IMAGE_MODEL_LIST,
  OPENAI_IMAGE_MODEL_CONFIG,
  isOpenAIImageModel,
  getOpenAIImageModelConfig,
} from '../../constants/openaiModels';
import {
  IMAGEN_MODEL_LIST,
  IMAGEN_MODEL_CONFIG,
  isImagenModel,
  getImagenModelConfig,
} from '../../constants/imagenModels';
import {
  IDEOGRAM_MODEL_LIST,
  IDEOGRAM_MODEL_CONFIG,
  isIdeogramModel,
  getIdeogramModelConfig,
} from '../../constants/ideogramModels';
import {
  REVE_MODEL_LIST,
  REVE_MODEL_CONFIG,
  isReveModel,
  getReveModelConfig,
} from '../../constants/reveModels';
import { Select } from '@/components/ui/select';
import { cn } from '../../lib/utils';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { isGenerationUnlimited } from '@/utils/unlimitedChecker';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import type { GeminiModel, SeedreamModel, ImageProvider, Resolution } from '@/types/types';
import { DEFAULT_MODEL } from '@/constants/geminiModels';
import {
  getPreferredImageModel as _getPreferredImageModel,
  setModelPreference,
} from '@/utils/modelPreferences';
import { useAvailableProviders } from '@/hooks/useAvailableProviders';

export function getPreferredImageModel(): string {
  return _getPreferredImageModel() || DEFAULT_MODEL;
}

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
  onClearAdvancedConfig,
}) => {
  const { t } = useTranslation();
  const { subscriptionStatus } = useLayout();
  const planMetadata = subscriptionStatus?.planMetadata;
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN || '';
  const [showOlderModels, setShowOlderModels] = useState(false);
  const availableProviders = useAvailableProviders();

  const hasDeprecated = useMemo(() => {
    if (type === 'image') {
      return (
        AVAILABLE_IMAGE_MODELS.some((id) => MODEL_CONFIG[id]?.deprecated) ||
        SEEDREAM_IMAGE_MODELS.some((id) => SEEDREAM_MODEL_CONFIG[id]?.deprecated)
      );
    }
    return CHAT_MODELS.some((id) => MODEL_CONFIG[id]?.deprecated);
  }, [type]);

  const options = useMemo(() => {
    const isVisible = (modelId: string, config: { deprecated?: boolean } | undefined) =>
      showOlderModels || !config?.deprecated || modelId === selectedModel;

    // IMAGE MODELS LOGIC
    if (type === 'image') {
      const geminiOptions = !availableProviders.gemini
        ? []
        : (AVAILABLE_IMAGE_MODELS.map((modelId) => {
            const config = MODEL_CONFIG[modelId];
            if (!config || !isVisible(modelId, config)) return null;

            const effectiveResolution = supportsOutputConfig(modelId)
              ? selectedModel === modelId
                ? resolution
                : config?.defaultResolution
              : undefined;

            const credits = getCreditsRequired(modelId, effectiveResolution, 'gemini');
            const isUnlimited = isGenerationUnlimited({
              model: modelId,
              resolution: effectiveResolution,
              planMetadata,
            });

            const icon = config.providerDomain ? (
              <img
                src={`https://img.logo.dev/${config.providerDomain}?size=48${
                  token ? `&token=${token}` : ''
                }`}
                className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                alt=""
              />
            ) : undefined;

            const creditSuffix = isUnlimited ? ' (∞)' : ` (${credits})`;
            const label = `${config.label}${creditSuffix}`;

            const desc = config.supportsImageConfig
              ? `${config.maxRefImages} ref images, ${config.defaultResolution || 'auto'}`
              : `${config.maxRefImages} ref images`;

            return {
              value: modelId,
              label: label || modelId,
              icon,
              badge: config.badge,
              description: desc,
            };
          }).filter(Boolean) as any[]);

      const seedreamOptions = !availableProviders.seedream
        ? []
        : (SEEDREAM_IMAGE_MODELS.map((modelId) => {
            const config = SEEDREAM_MODEL_CONFIG[modelId];
            if (!config || !isVisible(modelId, config)) return null;

            const effectiveResolution =
              selectedModel === modelId ? resolution : config?.defaultResolution;
            const credits = getCreditsRequired(modelId, effectiveResolution, 'seedream');
            const isUnlimited = isGenerationUnlimited({
              model: modelId,
              resolution: effectiveResolution,
              planMetadata,
            });

            const icon = config.providerDomain ? (
              <img
                src={`https://img.logo.dev/${config.providerDomain}?size=48${
                  token ? `&token=${token}` : ''
                }`}
                className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                alt=""
              />
            ) : undefined;

            const creditSuffix = isUnlimited ? ' (∞)' : ` (${credits})`;
            const label = `${config.label}${creditSuffix}`;

            return {
              value: modelId,
              label: label || modelId,
              icon,
              badge: config.badge,
              description: config.description,
            };
          }).filter(Boolean) as any[]);

      const openaiOptions = !availableProviders.openai
        ? []
        : (OPENAI_IMAGE_MODEL_LIST.map((modelId) => {
            const config = OPENAI_IMAGE_MODEL_CONFIG[modelId];
            if (!config) return null;

            const effectiveResolution =
              selectedModel === modelId ? resolution : config.defaultResolution;
            const credits = getCreditsRequired(modelId, effectiveResolution, 'openai');
            const isUnlimited = isGenerationUnlimited({
              model: modelId,
              resolution: effectiveResolution,
              planMetadata,
            });

            const icon = (
              <img
                src={`https://img.logo.dev/${config.providerDomain}?size=48${
                  token ? `&token=${token}` : ''
                }`}
                className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                alt=""
              />
            );

            const creditSuffix = isUnlimited ? ' (∞)' : ` (${credits})`;
            const label = `${config.label}${creditSuffix}`;

            return {
              value: modelId,
              label: label || modelId,
              icon,
              badge: config.badge,
              description: config.description,
            };
          }).filter(Boolean) as any[]);

      const imagenOptions = !availableProviders.imagen
        ? []
        : (IMAGEN_MODEL_LIST.map((modelId) => {
            const config = IMAGEN_MODEL_CONFIG[modelId];
            if (!config || !isVisible(modelId, config)) return null;

            const effectiveResolution =
              selectedModel === modelId ? resolution : config.defaultResolution;
            const credits = getCreditsRequired(modelId, effectiveResolution, 'imagen');
            const isUnlimited = isGenerationUnlimited({
              model: modelId,
              resolution: effectiveResolution,
              planMetadata,
            });

            const icon = (
              <img
                src={`https://img.logo.dev/${config.providerDomain}?size=48${
                  token ? `&token=${token}` : ''
                }`}
                className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                alt=""
              />
            );

            const creditSuffix = isUnlimited ? ' (∞)' : ` (${credits})`;
            const label = `${config.label}${creditSuffix}`;

            return {
              value: modelId,
              label: label || modelId,
              icon,
              badge: config.badge,
              description: config.description,
            };
          }).filter(Boolean) as any[]);

      const ideogramOptions = !availableProviders.ideogram
        ? []
        : (IDEOGRAM_MODEL_LIST.map((modelId) => {
            const config = IDEOGRAM_MODEL_CONFIG[modelId];
            if (!config || !isVisible(modelId, config)) return null;

            const effectiveResolution =
              selectedModel === modelId ? resolution : config.defaultResolution;
            const credits = getCreditsRequired(modelId, effectiveResolution, 'ideogram');
            const isUnlimited = isGenerationUnlimited({
              model: modelId,
              resolution: effectiveResolution,
              planMetadata,
            });

            const icon = (
              <img
                src={`https://img.logo.dev/${config.providerDomain}?size=48${
                  token ? `&token=${token}` : ''
                }`}
                className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                alt=""
              />
            );

            const creditSuffix = isUnlimited ? ' (∞)' : ` (${credits})`;
            const label = `${config.label}${creditSuffix}`;

            return {
              value: modelId,
              label: label || modelId,
              icon,
              badge: config.badge,
              description: config.description,
            };
          }).filter(Boolean) as any[]);

      const reveOptions = !availableProviders.reve
        ? []
        : (REVE_MODEL_LIST.map((modelId) => {
            const config = REVE_MODEL_CONFIG[modelId];
            if (!config || !isVisible(modelId, config)) return null;

            const effectiveResolution =
              selectedModel === modelId ? resolution : config.defaultResolution;
            const credits = getCreditsRequired(modelId, effectiveResolution, 'reve');
            const isUnlimited = isGenerationUnlimited({
              model: modelId,
              resolution: effectiveResolution,
              planMetadata,
            });

            const icon = (
              <img
                src={`https://img.logo.dev/${config.providerDomain}?size=48${
                  token ? `&token=${token}` : ''
                }`}
                className="w-3.5 h-3.5 rounded-sm filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all pointer-events-none"
                onError={(e) => (e.currentTarget.style.display = 'none')}
                alt=""
              />
            );

            const creditSuffix = isUnlimited ? ' (∞)' : ` (${credits})`;
            const label = `${config.label}${creditSuffix}`;

            return {
              value: modelId,
              label: label || modelId,
              icon,
              badge: config.badge,
              description: config.description,
            };
          }).filter(Boolean) as any[]);

      return [...geminiOptions, ...imagenOptions, ...ideogramOptions, ...reveOptions, ...seedreamOptions, ...openaiOptions];
    }

    // CHAT MODELS LOGIC
    return CHAT_MODELS.filter((modelId) => isVisible(modelId, MODEL_CONFIG[modelId])).map(
      (modelId) => {
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
          ) : undefined,
        };
      }
    );
  }, [
    type,
    selectedModel,
    resolution,
    planMetadata,
    token,
    variant,
    showOlderModels,
    availableProviders,
  ]);

  // Normalization logic for image models
  const effectiveModel = useMemo(() => {
    if (type !== 'image' || !options.length) return selectedModel;
    return options.some((o) => o.value === selectedModel) ? selectedModel : options[0].value;
  }, [selectedModel, options, type]);

  // Sync parent if normalization occurred (only for image type)
  useEffect(() => {
    if (type === 'image' && effectiveModel !== selectedModel) {
      const provider: ImageProvider = isSeedreamModel(effectiveModel)
        ? 'seedream'
        : isOpenAIImageModel(effectiveModel)
        ? 'openai'
        : isImagenModel(effectiveModel)
        ? 'imagen'
        : isIdeogramModel(effectiveModel)
        ? 'ideogram'
        : isReveModel(effectiveModel)
        ? 'reve'
        : 'gemini';
      onModelChange(effectiveModel, provider);
    }
  }, [effectiveModel, selectedModel, onModelChange, type]);

  const handleValueChange = useCallback(
    (newModel: string) => {
      if (disabled || newModel === selectedModel) return;

      if (type === 'image') {
        setModelPreference('imageModel', newModel);
        const provider: ImageProvider = isSeedreamModel(newModel)
          ? 'seedream'
          : isOpenAIImageModel(newModel)
          ? 'openai'
          : isImagenModel(newModel)
          ? 'imagen'
          : isIdeogramModel(newModel)
          ? 'ideogram'
          : isReveModel(newModel)
          ? 'reve'
          : 'gemini';
        onModelChange(newModel, provider);
        setModelPreference('imageProvider', provider);

        if (provider === 'imagen') {
          const imgConfig = getImagenModelConfig(newModel);
          if (imgConfig && !resolution && onSyncResolution) {
            onSyncResolution(imgConfig.defaultResolution);
          }
        } else if (provider === 'seedream') {
          const sdConfig = getSeedreamModelConfig(newModel);
          if (sdConfig && !resolution && onSyncResolution) {
            onSyncResolution(sdConfig.defaultResolution);
          }
        } else if (provider === 'openai') {
          const oaiConfig = getOpenAIImageModelConfig(newModel);
          if (oaiConfig && !resolution && onSyncResolution) {
            onSyncResolution(oaiConfig.defaultResolution);
          }
        } else if (provider === 'ideogram') {
          const idConfig = getIdeogramModelConfig(newModel);
          if (idConfig && !resolution && onSyncResolution) {
            onSyncResolution(idConfig.defaultResolution);
          }
        } else if (provider === 'reve') {
          const rvConfig = getReveModelConfig(newModel);
          if (rvConfig && !resolution && onSyncResolution) {
            onSyncResolution(rvConfig.defaultResolution);
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
        setModelPreference('chatModel', newModel);
        onModelChange(newModel);
      }
    },
    [
      disabled,
      selectedModel,
      onModelChange,
      type,
      resolution,
      onSyncResolution,
      onClearAdvancedConfig,
    ]
  );

  return (
    <div className={cn('flex flex-col gap-1.5', variant === 'node' && 'min-w-[140px]', className)}>
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
        footer={
          hasDeprecated ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowOlderModels(!showOlderModels);
              }}
              className="w-full px-2 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors text-center"
            >
              {showOlderModels ? 'Hide older models' : 'Show older models'}
            </button>
          ) : undefined
        }
        className={cn(
          type === 'chat' &&
            '!bg-transparent border-neutral-800 hover:border-white/10 !px-2 !py-0.5 h-auto',
          type === 'chat' && 'text-xs opacity-70 hover:opacity-100 transition-opacity',
          className
        )}
      />
    </div>
  );
};
