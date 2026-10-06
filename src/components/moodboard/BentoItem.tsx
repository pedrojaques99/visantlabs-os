import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Maximize2,
  Download,
  CheckSquare,
  Square,
  Video,
  Play,
  Film,
  Zap,
  Check,
  RotateCcw,
  Plus,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Thumb } from '@/components/ui/Thumb';
import { CroppedImage, AnimationPreset } from '../../types/moodboard';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import type { ImageProvider } from '@/types/types';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropzone } from '@/components/ui/Dropzone';
import { useTranslation } from '@/hooks/useTranslation';
interface BentoItemProps {
  crop: CroppedImage;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpscale: (id: string) => void;
  onAnimate: (id: string, prompt: string) => void;
  onRemotionAnimate: (url: string, preset: AnimationPreset) => void;
  onDownload: (url: string, filename: string) => void;
  onFullscreen: (url: string) => void;
  onViewVideo: (url: string) => void;
  onUpdateImage?: (file: File) => void;
  onRegenerate?: (id: string, model: string, provider: ImageProvider) => void;
  onAcceptRegenerated?: (id: string) => void;
  onDiscardRegenerated?: (id: string) => void;
  isRegenerating?: boolean;
}

const Timer: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 100);
    return () => clearInterval(i);
  }, [startTime]);
  return (
    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
      {elapsed.toFixed(1)}s
    </span>
  );
};

export const BentoItem: React.FC<BentoItemProps> = React.memo(
  ({
    crop,
    index,
    isSelected,
    onToggleSelect,
    onRemove,
    onUpscale,
    onAnimate,
    onRemotionAnimate,
    onDownload,
    onFullscreen,
    onViewVideo,
    onUpdateImage,
    onRegenerate,
    onAcceptRegenerated,
    onDiscardRegenerated,
    isRegenerating,
  }) => {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState(crop.animationPrompt || '');
    const [regenModel, setRegenModel] = useState<string>(GEMINI_MODELS.IMAGE_FLASH);
    const [regenProvider, setRegenProvider] = useState<ImageProvider>('gemini');

    const handleAnimate = () => {
      if (!prompt.trim()) return;
      onAnimate(crop.id, prompt);
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'group relative overflow-hidden rounded-xl border bg-card transition-colors',
          isSelected ? 'border-ring' : 'border-border hover:border-border-hover'
        )}
      >
        <div className="flex flex-col sm:flex-row h-full min-h-[220px]">
          {/* Left — Image */}
          <div className="relative w-full sm:w-[42%] overflow-hidden border-r border-border bg-muted">
            {crop.url ? (
              <>
                <Thumb
                  src={crop.regeneratedUrl || crop.thumbnailUrl || crop.url}
                  alt={t('moodboard.item.label', { n: index + 1 })}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => onFullscreen(crop.regeneratedUrl || crop.upscaledUrl || crop.url)}
                  aria-label={t('moodboard.item.fullscreen')}
                  className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                />
                {crop.regeneratedUrl && (
                  <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between gap-2 border-t border-border bg-card p-2">
                    <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                      <Zap size={10} />
                      {t('moodboard.item.aiResult')}
                    </span>
                    <div className="flex gap-1.5">
                      <Button
                        variant="surface"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDiscardRegenerated?.(crop.id);
                        }}
                        className="hover:text-destructive"
                        title={t('moodboard.item.discard')}
                        aria-label={t('moodboard.item.discard')}
                      >
                        <RotateCcw size={12} />
                      </Button>
                      <Button
                        variant="primary"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcceptRegenerated?.(crop.id);
                        }}
                        title={t('moodboard.item.accept')}
                        aria-label={t('moodboard.item.accept')}
                      >
                        <Check size={12} />
                      </Button>
                    </div>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(crop.id);
                  }}
                  aria-label={t('moodboard.item.select')}
                  aria-pressed={isSelected}
                  className={cn(
                    'absolute top-3 left-3 z-20 rounded-md border p-2 transition-colors',
                    isSelected
                      ? 'border-ring bg-card text-foreground'
                      : cn(
                          'border-border bg-card text-muted-foreground hover:text-foreground',
                          hoverReveal
                        )
                  )}
                >
                  {isSelected ? (
                    <CheckSquare size={16} strokeWidth={2} />
                  ) : (
                    <Square size={16} strokeWidth={1.5} />
                  )}
                </button>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                <Dropzone
                  accept="image/*"
                  icon={Plus}
                  label={t('moodboard.item.addImage')}
                  onFiles={(files) => {
                    const f = files[0];
                    if (f && onUpdateImage) onUpdateImage(f);
                  }}
                  className="h-full min-h-[180px] w-full"
                />
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(crop.id);
              }}
              className={cn(
                'absolute top-3 right-3 z-20 rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                hoverReveal
              )}
            >
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">{t('common.delete')}</span>
            </button>

            {crop.isUpscaling && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
                <GlitchLoader size={20} />
                <span className="text-xs font-medium text-foreground">
                  {t('moodboard.item.upscaling')}
                </span>
                {crop.upscaleStartTime && <Timer startTime={crop.upscaleStartTime} />}
              </div>
            )}

            {crop.isAnimating && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
                <GlitchLoader size={20} />
                <span className="text-xs font-medium text-foreground">
                  {t('moodboard.item.animating')}
                </span>
                {crop.animationStartTime && <Timer startTime={crop.animationStartTime} />}
              </div>
            )}

            {/* EXCEÇÃO ao ui-scale/opacidade-cru: scrim sobre mídia */}
            {crop.videoUrl && !crop.isAnimating && (
              <button
                type="button"
                className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/20 transition-colors hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onViewVideo(crop.videoUrl!)}
                aria-label={t('moodboard.item.viewVideo')}
              >
                <Play size={28} className="translate-x-0.5 text-white" fill="currentColor" />
              </button>
            )}
          </div>

          {/* Right — Controls */}
          <div className="flex-1 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t('moodboard.item.label', { n: index + 1 })}
                </span>
                <div className="flex gap-1.5">
                  {!crop.upscaledUrl && !crop.isUpscaling && crop.url && (
                    <Button
                      variant="surface"
                      size="sm"
                      onClick={() => onUpscale(crop.id)}
                      title={t('moodboard.item.upscale4k')}
                      className="h-8 gap-1 px-2 text-xs"
                    >
                      <Maximize2 size={13} strokeWidth={1.5} /> 4K
                    </Button>
                  )}
                  <Button
                    variant="surface"
                    size="icon-sm"
                    onClick={() =>
                      onDownload(
                        crop.upscaledUrl || crop.url,
                        `item-${index + 1}${crop.upscaledUrl ? '-4k' : ''}.jpg`
                      )
                    }
                    disabled={!crop.url}
                    aria-label={t('common.download')}
                    title={t('common.download')}
                  >
                    <Download size={13} strokeWidth={1.5} />
                  </Button>
                </div>
              </div>

              {crop.url && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Film size={11} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('moodboard.item.motion')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        ['zoom-in', 'zoom-out', 'pan-lr', 'pan-rl', 'fade-in'] as AnimationPreset[]
                      ).map((p) => (
                        <Button
                          key={p}
                          variant="surface"
                          size="xs"
                          onClick={() => onRemotionAnimate(crop.upscaledUrl || crop.url, p)}
                        >
                          {t(`moodboard.item.presets.${p}`)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Video size={11} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('moodboard.item.veo')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('moodboard.item.animationPrompt')}
                        aria-label={t('moodboard.item.animationPrompt')}
                        className="h-9 flex-1 text-xs"
                        onKeyDown={(e) => e.key === 'Enter' && handleAnimate()}
                      />
                      <Button
                        variant="primary"
                        size="icon-md"
                        onClick={handleAnimate}
                        disabled={!prompt.trim() || !crop.url || crop.isAnimating}
                        aria-label={t('moodboard.item.animate')}
                        title={t('moodboard.item.animate')}
                      >
                        <Video size={13} />
                      </Button>
                    </div>
                  </div>

                  {onRegenerate && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Zap size={11} className="text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {t('moodboard.item.regenerate')}
                        </span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <ModelSelector
                          type="image"
                          variant="node"
                          selectedModel={regenModel}
                          onModelChange={(model, provider) => {
                            setRegenModel(model);
                            if (provider) setRegenProvider(provider);
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="surface"
                          size="icon-md"
                          onClick={() => onRegenerate(crop.id, regenModel, regenProvider)}
                          disabled={!crop.url || isRegenerating}
                          aria-label={t('moodboard.item.regenerate')}
                          title={t('moodboard.item.regenerate')}
                          className="shrink-0"
                        >
                          {isRegenerating ? <GlitchLoader size={13} /> : <Zap size={13} />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {crop.upscaledUrl && (
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-xs font-medium text-muted-foreground">
                  {t('moodboard.item.ready4k')}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

BentoItem.displayName = 'BentoItem';
