import React from 'react';
import { Select } from '@/components/ui/select';
import type { GeminiModel, DesignType } from '@/types/types';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { Button } from '@/components/ui/button'

interface ModelSelectionSectionProps {
  selectedModel: GeminiModel | null;
  onModelChange: (model: GeminiModel) => void;
  designType?: DesignType;
}

const DEFAULT_MODEL_INFO: Record<string, {
  emoji: string;
  name: string;
  version: string;
}> = {
  [GEMINI_MODELS.FLASH]: {
    emoji: '⛏️',
    name: 'HD',
    version: '1 credit'
  },
  [GEMINI_MODELS.TEXT]: {
    emoji: '💬',
    name: 'Flash',
    version: 'Text only'
  },
  [GEMINI_MODELS.NB2]: {
    emoji: '🍌',
    name: 'NB2',
    version: '1-5 credits'
  },
  [GEMINI_MODELS.PRO]: {
    emoji: '⛏️💎',
    name: '4K Pro',
    version: '3-7 credits'
  },
  'veo-3.1-generate-preview': {
    emoji: '🎬',
    name: 'VEO 3.1',
    version: 'Video'
  },
  'veo-3.1-fast-generate-preview': {
    emoji: '⚡',
    name: 'VEO Fast',
    version: 'Video'
  }
};

export const ModelSelectionSection: React.FC<ModelSelectionSectionProps> = ({
  selectedModel,
  onModelChange,
  designType,
}) => {
  const isBlankMockup = designType === 'blank';
  const renderModelCard = (model: GeminiModel) => {
    const info = DEFAULT_MODEL_INFO[model];
    const isSelected = selectedModel === model;

    return (
      <Button variant="ghost"         key={model}
        onClick={() => onModelChange(model)}
        className={`w-full aspect-square max-h-32 flex flex-col items-center justify-center gap-1 p-4 text-xs font-mono rounded border transition-colors cursor-pointer ${isSelected
          ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
          : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50'
          }`}
      >
        <span className="text-2xl">{info.emoji}</span>
        <span className="font-semibold text-sm">{info.name}</span>
        <span className="text-[10px] text-neutral-500">{info.version}</span>
      </Button>
    );
  };

  const models: GeminiModel[] = [GEMINI_MODELS.FLASH, GEMINI_MODELS.NB2, GEMINI_MODELS.PRO];
  const selectedInfo = selectedModel ? DEFAULT_MODEL_INFO[selectedModel] : null;

  return (
    <>
      {/* Dropdown for mobile */}
      <div className="md:hidden">
        <Select
          value={selectedModel || ''}
          onChange={(value) => onModelChange(value as GeminiModel)}
          options={models
            .filter(model => !isBlankMockup || model === GEMINI_MODELS.FLASH)
            .map(model => ({
              value: model,
              label: `${DEFAULT_MODEL_INFO[model].emoji} ${DEFAULT_MODEL_INFO[model].name} - ${DEFAULT_MODEL_INFO[model].version}`
            }))}
          placeholder="Select model"
        />
      </div>

      {/* Cards for desktop */}
      <div className="hidden md:grid grid-cols-3 gap-2 cursor-pointer">
        {renderModelCard(GEMINI_MODELS.FLASH)}
        {renderModelCard(GEMINI_MODELS.NB2)}
        {!isBlankMockup && renderModelCard(GEMINI_MODELS.PRO)}
      </div>
    </>
  );
};
