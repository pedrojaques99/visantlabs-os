import React from 'react';
import { useMockup } from './MockupContext';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { getModelDisplayName } from '@/constants/geminiModels';

export const MockupConfigSummary: React.FC = () => {
  const { selectedModel, resolution, aspectRatio, imageProvider } = useMockup();

  if (!selectedModel) {
    return <span className="text-[9px] font-mono text-neutral-700 tracking-wider">—</span>;
  }

  const credits = getCreditsRequired(selectedModel, resolution, imageProvider);
  const modelName = getModelDisplayName(selectedModel);

  const items = [modelName, resolution, aspectRatio, `${credits} 💎/img`];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-[8px] text-neutral-700">·</span>}
          <span className="text-[9px] font-mono text-neutral-500 tracking-wider">{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
};
