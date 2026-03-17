import React, { useState } from 'react';
import { isAdvancedModel } from '@/constants/geminiModels';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AspectRatioSelector } from './AspectRatioSelector';
import { ResolutionSelector } from './ResolutionSelector';
import { NodeLabel } from './node-label';
import type { GeminiModel, AspectRatio, Resolution } from '@/types/types';

interface AdvancedModelSettingsProps {
  model: GeminiModel;
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
 * Reusable Advanced Settings component (Aspect Ratio + Resolution) for advanced Models (NB2, PRO).
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

  const isAdvanced = isAdvancedModel(model);
  const isFlash = model === 'gemini-2.5-flash-image'; // GEMINI_MODELS.FLASH

  if (!isAdvanced && !isFlash) return null;

  return (
    <div className={cn("grid grid-cols-2 gap-2.5", className)}>
      <div className={cn(!isAdvanced && "opacity-50 grayscale pointer-events-none")}>
        <NodeLabel className="mb-1.5 text-[10px]">
          {t('canvasNodes.promptNode.aspectRatio')}
        </NodeLabel>
        <div onMouseDown={(e) => e.stopPropagation()}>
          <AspectRatioSelector
            value={aspectRatio}
            onChange={onAspectRatioChange}
            disabled={isLoading || !isAdvanced}
            compact
          />
        </div>
      </div>

      <div>
        <NodeLabel className="mb-1.5 text-[10px]">
          {t('canvasNodes.promptNode.resolution')}
        </NodeLabel>
        <div onMouseDown={(e) => e.stopPropagation()}>
          <ResolutionSelector
            value={resolution}
            onChange={onResolutionChange}
            onModelChange={onModelChange}
            model={model}
            disabled={isLoading}
            compact
            allowVideo={allowVideo}
          />
        </div>
      </div>
    </div>
  );
};
