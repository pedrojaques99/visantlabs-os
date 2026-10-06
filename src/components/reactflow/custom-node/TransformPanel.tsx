import React from 'react';
import type { TransformConfig } from '@/types/customNode';
import { useTranslation } from '@/hooks/useTranslation';

// behavior → chave de placeholder em canvasNodes.customNode.placeholder.*
const PLACEHOLDER_KEYS: Record<string, string> = {
  'ai-shader': 'aiShader',
  'angle-series': 'angleSeries',
  'mockup-series': 'mockupSeries',
  'image-chain': 'imageChain',
};

interface Props {
  config: TransformConfig;
  description: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TransformPanel({ config, description, onChange, disabled }: Props) {
  const { t } = useTranslation();
  if (config.behavior === 'upscale-chain') {
    return (
      <p className="text-2xs text-neutral-500">
        {t('canvasNodes.customNode.upscalesTo')}{' '}
        <span className="font-mono text-neutral-300">{config.targetResolution ?? '2K'}</span>
        {config.applyShaderAfter && (
          <>
            {', '}
            {t('canvasNodes.customNode.thenShader')}{' '}
            <span className="text-neutral-300">{config.applyShaderAfter}</span>
          </>
        )}
      </p>
    );
  }

  const placeholderKey = PLACEHOLDER_KEYS[config.behavior] ?? 'default';

  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-medium text-neutral-500">
        {t('canvasNodes.customNode.description')}
      </p>
      <textarea
        value={description}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={t(`canvasNodes.customNode.placeholder.${placeholderKey}`)}
        rows={2}
        className="nodrag nopan w-full resize-none rounded-md border-node border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-2xs text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors disabled:opacity-40"
      />
    </div>
  );
}
