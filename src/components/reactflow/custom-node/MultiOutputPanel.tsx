import React from 'react';
import type { MultiOutputConfig } from '@/types/customNode';

interface Props {
  config: MultiOutputConfig;
  prompts: string[];
  onChange: (index: number, value: string) => void;
  disabled?: boolean;
}

export function MultiOutputPanel({ config, prompts, onChange, disabled }: Props) {
  const isSinglePrompt = config.behavior === 'model-comparison' || config.behavior === 'prompt-expander';

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
        {isSinglePrompt ? 'Prompt' : `Prompts (${config.outputCount})`}
      </p>
      {(isSinglePrompt ? [prompts[0] ?? ''] : prompts).map((prompt, i) => (
        <div key={i} className="space-y-0.5">
          {config.behavior === 'model-comparison' && config.models?.[i] && (
            <p className="text-[10px] font-mono text-brand-cyan/50 uppercase tracking-wide pl-0.5">
              {config.models[i]}
            </p>
          )}
          <textarea
            value={prompt}
            onChange={e => onChange(i, e.target.value)}
            disabled={disabled}
            placeholder={isSinglePrompt ? 'Prompt...' : `Prompt ${i + 1}...`}
            rows={2}
            className="nodrag nopan w-full resize-none rounded-md border-node border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[11px] font-mono text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors disabled:opacity-40"
          />
        </div>
      ))}
    </div>
  );
}
