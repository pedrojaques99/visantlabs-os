import React from 'react';
import type { TransformConfig } from '@/types/customNode';

const PLACEHOLDERS: Record<string, string> = {
  'ai-shader': 'Describe the shader effect (e.g. "retro VHS with heavy grain")',
  'angle-series': 'Subject description for angle variations',
  'mockup-series': 'Product description for mockup series',
  'image-chain': 'What do you want derived from the visual analysis?',
  'upscale-chain': '',
};

interface Props {
  config: TransformConfig;
  description: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TransformPanel({ config, description, onChange, disabled }: Props) {
  if (config.behavior === 'upscale-chain') {
    return (
      <p className="text-[10px] font-mono text-neutral-500">
        Upscales to{' '}
        <span className="text-brand-cyan/70">{config.targetResolution ?? '2K'}</span>
        {config.applyShaderAfter && (
          <>
            {' '}→ applies{' '}
            <span className="text-brand-cyan/70">{config.applyShaderAfter}</span> shader
          </>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Description</p>
      <textarea
        value={description}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={PLACEHOLDERS[config.behavior] ?? 'Describe the effect...'}
        rows={2}
        className="nodrag nopan w-full resize-none rounded-md border-node border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[11px] font-mono text-neutral-200 placeholder:text-neutral-600 focus:border-brand-cyan/40 focus:outline-none transition-colors disabled:opacity-40"
      />
    </div>
  );
}
