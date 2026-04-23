import React from 'react';
import type { MultiInputConfig } from '@/types/customNode';

const PLACEHOLDERS: Record<string, string> = {
  'merge-creative': 'Describe how you want the images combined',
  'palette-generate': 'What do you want to generate using the extracted palette?',
  'conditional-branch': 'What transformation goal do you have in mind?',
};

interface Props {
  config: MultiInputConfig;
  description: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function MultiInputPanel({ config, description, onChange, disabled }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
        {config.inputCount} image{config.inputCount > 1 ? 's' : ''} expected
      </p>
      <textarea
        value={description}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={PLACEHOLDERS[config.behavior] ?? 'Describe the operation...'}
        rows={2}
        className="nodrag nopan w-full resize-none rounded-md border-node border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[11px] font-mono text-neutral-200 placeholder:text-neutral-600 focus:border-brand-cyan/40 focus:outline-none transition-colors disabled:opacity-40"
      />
    </div>
  );
}
