import React from 'react';
import { supportsOutputConfig } from '@/utils/canvas/generationContext';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AspectRatioSelector } from './AspectRatioSelector';
import { ResolutionSelector } from './ResolutionSelector';
import { NodeLabel } from './node-label';
import type { GeminiModel, AspectRatio, Resolution } from '@/types/types';

interface AdvancedModelSettingsProps {
  model: GeminiModel | string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onResolutionChange: (res: Resolution) => void;
  onModelChange?: (model: GeminiModel) => void;
  isLoading?: boolean;
  className?: string;
  allowVideo?: boolean;
}

/**
 * Reusable Advanced Settings component (Aspect Ratio + Resolution).
 * Renders for any model that supports output config (Gemini advanced, OpenAI, Seedream).
 */
export const AdvancedModelSettings: React.FC<AdvancedModelSettingsProps> = ({
  model,
  aspectRatio,
  resolution,
  onAspectRatioChange,
  onResolutionChange,
  onModelChange,
  isLoading = false,
  className,
  allowVideo = false
}) => {
  const { t } = useTranslation();

  if (!supportsOutputConfig(model)) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <NodeLabel className="mb-1.5 text-[10px]">
          {t('canvasNodes.promptNode.aspectRatio')}
        </NodeLabel>
        <div>
          <AspectRatioSelector
            value={aspectRatio}
            onChange={onAspectRatioChange}
            disabled={isLoading}
            compact
          />
        </div>
      </div>

      <div>
        <NodeLabel className="mb-1.5 text-[10px]">
          {t('canvasNodes.promptNode.resolution')}
        </NodeLabel>
        <div>
          <ResolutionSelector
            value={resolution}
            onChange={onResolutionChange}
            onModelChange={onModelChange}
            model={model as GeminiModel}
            disabled={isLoading}
            compact
            allowVideo={allowVideo}
          />
        </div>
      </div>
    </div>
  );
};
