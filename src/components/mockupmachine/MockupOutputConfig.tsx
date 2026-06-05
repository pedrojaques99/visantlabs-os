import React, { useCallback, useMemo } from 'react';
import { SlidersHorizontal, GitCompareArrows } from 'lucide-react';
import { useMockup } from './MockupContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { MockupConfigSummary } from './MockupConfigSummary';
import { ToggleRow } from './ToggleRow';
import {
  ToolPanelSection,
  ToolPanelGrid,
  ToolPanelChip,
  ToolPanelDivider,
  ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { GEMINI_MODELS, AVAILABLE_IMAGE_MODELS, MODEL_CONFIG } from '@/constants/geminiModels';
import {
  SEEDREAM_IMAGE_MODELS,
  SEEDREAM_MODEL_CONFIG,
  isSeedreamModel,
} from '@/constants/seedreamModels';
import {
  OPENAI_IMAGE_MODEL_LIST,
  OPENAI_IMAGE_MODEL_CONFIG,
  isOpenAIImageModel,
} from '@/constants/openaiModels';
import { IMAGEN_MODEL_LIST, IMAGEN_MODEL_CONFIG, isImagenModel } from '@/constants/imagenModels';
import {
  IDEOGRAM_MODEL_LIST,
  IDEOGRAM_MODEL_CONFIG,
  isIdeogramModel,
} from '@/constants/ideogramModels';
import { REVE_MODEL_LIST, REVE_MODEL_CONFIG, isReveModel } from '@/constants/reveModels';
import { useAvailableProviders } from '@/hooks/useAvailableProviders';
import type { Resolution, AspectRatio, ImageProvider } from '@/types/types';

const GEMINI_RESOLUTIONS: Resolution[] = ['HD', '1K', '2K', '4K'];
const SEEDREAM_RESOLUTIONS: Resolution[] = ['2K', '4K'];
const ASPECT_RATIOS: AspectRatio[] = ['1:1', '9:16', '16:9', '4:3', '3:4'];

interface CompareModelEntry {
  id: string;
  label: string;
  providerDomain?: string;
}

export const MockupOutputConfig: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const availableProviders = useAvailableProviders();
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN || '';

  const {
    selectedModel,
    setSelectedModel,
    resolution,
    setResolution,
    aspectRatio,
    setAspectRatio,
    imageProvider,
    setImageProvider,
    autoGenerate,
    setAutoGenerate,
    isSurpriseMeMode,
    setIsSurpriseMeMode,
    isCompareMode,
    setIsCompareMode,
    compareModels,
    setCompareModels,
  } = useMockup();

  const resolutions = imageProvider === 'seedream' ? SEEDREAM_RESOLUTIONS : GEMINI_RESOLUTIONS;

  const handleModelChange = (model: string, provider?: string) => {
    setImageProvider((provider as ImageProvider) || 'gemini');
    setSelectedModel(model as any);
  };

  const allImageModels = useMemo((): CompareModelEntry[] => {
    const models: CompareModelEntry[] = [];

    if (availableProviders.gemini) {
      for (const id of AVAILABLE_IMAGE_MODELS) {
        const config = MODEL_CONFIG[id];
        if (config && !config.deprecated) {
          models.push({ id, label: config.label, providerDomain: config.providerDomain });
        }
      }
    }
    if (availableProviders.imagen) {
      for (const id of IMAGEN_MODEL_LIST) {
        const config = IMAGEN_MODEL_CONFIG[id];
        if (config && !config.deprecated) {
          models.push({ id, label: config.label, providerDomain: config.providerDomain });
        }
      }
    }
    if (availableProviders.ideogram) {
      for (const id of IDEOGRAM_MODEL_LIST) {
        const config = IDEOGRAM_MODEL_CONFIG[id];
        if (config && !config.deprecated) {
          models.push({ id, label: config.label, providerDomain: config.providerDomain });
        }
      }
    }
    if (availableProviders.reve) {
      for (const id of REVE_MODEL_LIST) {
        const config = REVE_MODEL_CONFIG[id];
        if (config && !config.deprecated) {
          models.push({ id, label: config.label, providerDomain: config.providerDomain });
        }
      }
    }
    if (availableProviders.seedream) {
      for (const id of SEEDREAM_IMAGE_MODELS) {
        const config = SEEDREAM_MODEL_CONFIG[id];
        if (config && !config.deprecated) {
          models.push({ id, label: config.label, providerDomain: config.providerDomain });
        }
      }
    }
    if (availableProviders.openai) {
      for (const id of OPENAI_IMAGE_MODEL_LIST) {
        const config = OPENAI_IMAGE_MODEL_CONFIG[id];
        if (config) {
          models.push({ id, label: config.label, providerDomain: config.providerDomain });
        }
      }
    }
    return models;
  }, [availableProviders]);

  const toggleCompareModel = useCallback(
    (modelId: string) => {
      setCompareModels((prev) => {
        if (prev.includes(modelId)) {
          return prev.filter((m) => m !== modelId);
        }
        if (prev.length >= 6) return prev;
        return [...prev, modelId];
      });
    },
    [setCompareModels]
  );

  const handleToggleCompareMode = useCallback(() => {
    setIsCompareMode((prev) => {
      if (!prev && compareModels.length === 0 && selectedModel) {
        setCompareModels([selectedModel]);
      }
      return !prev;
    });
  }, [setIsCompareMode, compareModels.length, selectedModel, setCompareModels]);

  return (
    <div className="space-y-4">
      {/* Header with status summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-neutral-900 border border-neutral-800/50 flex items-center justify-center">
            <SlidersHorizontal size={11} className="text-neutral-500" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
            {t('mockup.aiSettings') || 'Output Config'}
          </span>
        </div>
        <MockupConfigSummary />
      </div>

      {/* Model Selector — single mode */}
      {!isCompareMode && (
        <ModelSelector
          type="image"
          selectedModel={
            selectedModel ||
            (imageProvider === 'seedream' ? 'seedream-4.5' : GEMINI_MODELS.IMAGE_NB2)
          }
          onModelChange={handleModelChange}
          resolution={resolution}
          onSyncResolution={setResolution}
          className="w-full"
        />
      )}

      {/* Compare Mode — multi-select chips */}
      {isCompareMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              {compareModels.length}/6 models
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allImageModels.map((model) => {
              const isSelected = compareModels.includes(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggleCompareModel(model.id)}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono
                    border transition-all duration-150 cursor-pointer
                    ${
                      isSelected
                        ? 'border-white/20 bg-white/10 text-neutral-200'
                        : 'border-neutral-800/50 bg-neutral-900/50 text-neutral-500 hover:border-neutral-700 hover:text-neutral-400'
                    }
                  `}
                >
                  {model.providerDomain && (
                    <img
                      src={`https://img.logo.dev/${model.providerDomain}?size=32${
                        token ? `&token=${token}` : ''
                      }`}
                      className="w-3 h-3 rounded-sm"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                      alt=""
                    />
                  )}
                  {model.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolution + Aspect Ratio */}
      <div className="space-y-3">
        <ToolPanelSection title={t('mockup.resolutionLabel') || 'Resolução'}>
          <ToolPanelGrid cols={resolutions.length as 2 | 4}>
            {resolutions.map((res) => (
              <ToolPanelChip
                key={res}
                active={resolution === res}
                onClick={() => setResolution(res)}
              >
                {res}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>

        <ToolPanelSection title={t('mockup.aspectRatioLabel') || 'Proporção'}>
          <ToolPanelGrid cols={5}>
            {ASPECT_RATIOS.map((ratio) => (
              <ToolPanelChip
                key={ratio}
                active={aspectRatio === ratio}
                onClick={() => setAspectRatio(ratio)}
              >
                {ratio}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>
      </div>

      <ToolPanelDivider />

      {/* Toggles using ToolPanelRow for alignment */}
      <div className="space-y-2">
        <ToolPanelRow label={t('mockup.compareModeLabel') || 'Compare Models'}>
          <ToggleRow
            checked={isCompareMode}
            onClick={handleToggleCompareMode}
            dark={dark}
            tooltip={
              t('mockup.compareModeDescription') ||
              'Generate the same prompt across multiple models side-by-side'
            }
          />
        </ToolPanelRow>
        <ToolPanelRow label={t('mockup.autoGenerateLabel') || 'Prompt + Imagem'}>
          <ToggleRow
            checked={autoGenerate}
            onClick={() => setAutoGenerate(!autoGenerate)}
            dark={dark}
            tooltip={
              t('mockup.autoGenerateDescription') ||
              'Gera prompt e imagem de uma vez. Desligado = só gera o prompt pra revisar.'
            }
          />
        </ToolPanelRow>
        <ToolPanelRow label={t('mockup.directorModeLabel') || 'Aleatorizar Tags'}>
          <ToggleRow
            checked={isSurpriseMeMode}
            onClick={() => setIsSurpriseMeMode(!isSurpriseMeMode)}
            dark={dark}
            tooltip={
              t('mockup.directorModeDescription') ||
              'Define quais categorias de tags serão sorteadas a cada geração'
            }
          />
        </ToolPanelRow>
      </div>
    </div>
  );
};
