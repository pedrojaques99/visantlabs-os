import React from 'react';
import { Select } from '../ui/select';
import type { GeminiModel, DesignType } from '../../types';

interface ModelSelectionSectionProps {
  selectedModel: GeminiModel | null;
  onModelChange: (model: GeminiModel) => void;
  designType?: DesignType | null;
}

const DEFAULT_MODEL_INFO: Record<GeminiModel, {
  emoji: string;
  name: string;
  version: string;
}> = {
  'gemini-2.5-flash-image': {
    emoji: '⛏️',
    name: 'HD',
    version: '1 credit'
  },
  'gemini-2.5-flash': {
    emoji: '💬',
    name: 'Flash',
    version: 'Text only'
  },
  'gemini-3-pro-image-preview': {
    emoji: '⛏️💎',
    name: '4K',
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
      <button
        key={model}
        onClick={() => onModelChange(model)}
        className={`w-full aspect-square max-h-32 flex flex-col items-center justify-center gap-1 p-4 text-xs font-mono rounded border transition-colors cursor-pointer ${isSelected
          ? 'bg-brand-cyan/10 text-brand-cyan border-[#brand-cyan]/40'
          : 'bg-zinc-800/30 text-zinc-400 border-zinc-700/30 hover:border-zinc-600/50'
          }`}
      >
        <span className="text-2xl">{info.emoji}</span>
        <span className="font-semibold text-sm">{info.name}</span>
        <span className="text-[10px] text-zinc-500">{info.version}</span>
      </button>
    );
  };

  const models: GeminiModel[] = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
  const selectedInfo = selectedModel ? DEFAULT_MODEL_INFO[selectedModel] : null;

  return (
    <>
      {/* Dropdown for mobile */}
      <div className="md:hidden">
        <Select
          value={selectedModel || ''}
          onChange={(value) => onModelChange(value as GeminiModel)}
          options={models
            .filter(model => !isBlankMockup || model === 'gemini-2.5-flash-image')
            .map(model => ({
              value: model,
              label: `${DEFAULT_MODEL_INFO[model].emoji} ${DEFAULT_MODEL_INFO[model].name} - ${DEFAULT_MODEL_INFO[model].version}`
            }))}
          placeholder="Select model"
        />
      </div>

      {/* Cards for desktop */}
      <div className="hidden md:grid grid-cols-2 gap-2 cursor-pointer">
        {renderModelCard('gemini-2.5-flash-image')}
        {!isBlankMockup && renderModelCard('gemini-3-pro-image-preview')}
      </div>
    </>
  );
};
