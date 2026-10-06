import React from 'react';
import { Gem } from '@/lib/ui/icons';
import { useMockup } from './MockupContext';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { getModelDisplayName } from '@/constants/geminiModels';

export const MockupConfigSummary: React.FC = () => {
  const { selectedModel, resolution, aspectRatio, imageProvider } = useMockup();

  if (!selectedModel) return null;

  const credits = getCreditsRequired(selectedModel, resolution, imageProvider);
  const modelName = getModelDisplayName(selectedModel);

  return (
    <div className="flex items-center gap-2 flex-wrap text-2xs text-neutral-500">
      <span>{modelName}</span>
      <span className="font-mono">{resolution}</span>
      <span className="font-mono">{aspectRatio}</span>
      <span className="inline-flex items-center gap-0.5 font-mono">
        {credits}
        <Gem size={10} aria-hidden />
        /img
      </span>
    </div>
  );
};
