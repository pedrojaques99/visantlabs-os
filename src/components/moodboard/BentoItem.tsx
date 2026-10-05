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
    <span className="font-mono text-2xs tabular-nums text-neutral-600">{elapsed.toFixed(1)}s</span>
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group relative overflow-hidden bg-neutral-900/40 transition-colors rounded-2xl border ${
          isSelected ? 'border-white ring-1 ring-white/20' : 'border-border hover:border-border/70'
        }`}
      >
        <div className="flex flex-col sm:flex-row h-full min-h-[220px]">
          {/* Left — Image */}
          <div className="relative w-full sm:w-[42%] overflow-hidden cursor-zoom-in border-r border-border bg-neutral-950">
            {crop.url ? (
              <>
                <Thumb
                  src={crop.regeneratedUrl || crop.thumbnailUrl || crop.url}
                  alt={t('moodboard.item.label', { n: index + 1 })}
                  className="w-full h-full object-cover"
                  onClick={() => onFullscreen(crop.regeneratedUrl || crop.upscaledUrl || crop.url)}
                  loading="lazy"
                />
                {crop.regeneratedUrl && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 p-2 flex items-center justify-between gap-2 z-20">
                    <span className="text-xs font-medium text-neutral-200 flex items-center gap-1">
                      <Zap size={10} />
                      {t('moodboard.item.aiResult')}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDiscardRegenerated?.(crop.id);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 border border-border/70 text-neutral-400 hover:text-destructive hover:border-destructive/40 transition-[color,background-color,border-color,opacity]"
                        title={t('moodboard.item.discard')}
                        aria-label={t('moodboard.item.discard')}
                      >
                        <RotateCcw size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcceptRegenerated?.(crop.id);
                        }}
                        className="p-1.5 rounded-lg bg-white text-black hover:opacity-90 transition-[color,background-color,border-color,opacity]"
                        title={t('moodboard.item.accept')}
                        aria-label={t('moodboard.item.accept')}
                      >
                        <Check size={11} />
                      </button>
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
                    'absolute top-3 left-3 p-2 rounded-xl transition-colors z-20 border shadow-lg',
                    isSelected
                      ? 'bg-white text-black border-white'
                      : cn('bg-black/40 text-white border-white/20', hoverReveal)
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
              <div className="h-full flex items-center justify-center p-8 text-center hover:bg-neutral-800/30 transition-colors group/upload relative cursor-pointer">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && onUpdateImage) onUpdateImage(f);
                  }}
                  accept="image/*"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 border border-dashed border-border/70 flex items-center justify-center">
                    <Plus size={18} className="text-neutral-500" />
                  </div>
                  <span className="text-xs font-medium text-neutral-500">
                    {t('moodboard.item.addImage')}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(crop.id);
              }}
              className={cn(
                'absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-neutral-300 border border-white/10 hover:bg-destructive/80 hover:text-white z-10',
                hoverReveal
              )}
            >
              <X size={14} strokeWidth={1.5} />
              <span className="sr-only">{t('common.delete')}</span>
            </button>

            {crop.isUpscaling && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                <GlitchLoader size={20} />
                <span className="text-xs font-medium text-neutral-300">
                  {t('moodboard.item.upscaling')}
                </span>
                {crop.upscaleStartTime && <Timer startTime={crop.upscaleStartTime} />}
              </div>
            )}

            {crop.isAnimating && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                <GlitchLoader size={20} />
                <span className="text-xs font-medium text-neutral-300">
                  {t('moodboard.item.animating')}
                </span>
                {crop.animationStartTime && <Timer startTime={crop.animationStartTime} />}
              </div>
            )}

            {crop.videoUrl && !crop.isAnimating && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors cursor-pointer"
                onClick={() => onViewVideo(crop.videoUrl!)}
                role="button"
                tabIndex={0}
                aria-label={t('moodboard.item.viewVideo')}
              >
                <Play
                  size={28}
                  className="text-white drop-shadow-2xl translate-x-0.5"
                  fill="currentColor"
                />
              </div>
            )}
          </div>

          {/* Right — Controls */}
          <div className="flex-1 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 tabular-nums">
                  {t('moodboard.item.label', { n: index + 1 })}
                </span>
                <div className="flex gap-1.5">
                  {!crop.upscaledUrl && !crop.isUpscaling && crop.url && (
                    <button
                      onClick={() => onUpscale(crop.id)}
                      title={t('moodboard.item.upscale4k')}
                      className="p-2 rounded-lg bg-neutral-800/50 border border-border/70 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors text-2xs font-bold flex items-center gap-1"
                    >
                      <Maximize2 size={13} strokeWidth={1.5} /> 4K
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onDownload(
                        crop.upscaledUrl || crop.url,
                        `item-${index + 1}${crop.upscaledUrl ? '-4k' : ''}.jpg`
                      )
                    }
                    disabled={!crop.url}
                    aria-label={t('common.download')}
                    title={t('common.download')}
                    className="p-2 rounded-lg bg-neutral-800/50 border border-border/70 text-neutral-400 hover:text-white hover:border-neutral-500 transition-[color,background-color,border-color,opacity] disabled:opacity-30"
                  >
                    <Download size={13} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {crop.url && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Film size={11} className="text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-500">
                        {t('moodboard.item.motion')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        ['zoom-in', 'zoom-out', 'pan-lr', 'pan-rl', 'fade-in'] as AnimationPreset[]
                      ).map((p) => (
                        <button
                          key={p}
                          onClick={() => onRemotionAnimate(crop.upscaledUrl || crop.url, p)}
                          className="px-2.5 py-1 rounded-lg border border-border bg-neutral-900/50 text-2xs font-medium text-neutral-400 hover:bg-white hover:text-black hover:border-white transition-colors"
                        >
                          {t(`moodboard.item.presets.${p}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Video size={11} className="text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-500">
                        {t('moodboard.item.veo')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('moodboard.item.animationPrompt')}
                        className="flex-1 bg-neutral-900/50 border border-border focus:border-neutral-600 rounded-lg px-3 py-2 text-2xs text-white placeholder:text-neutral-700 outline-none transition-[color,background-color,border-color,opacity]"
                        onKeyDown={(e) => e.key === 'Enter' && handleAnimate()}
                      />
                      <button
                        onClick={handleAnimate}
                        disabled={!prompt.trim() || !crop.url || crop.isAnimating}
                        aria-label={t('moodboard.item.animate')}
                        title={t('moodboard.item.animate')}
                        className="px-3 py-2 rounded-lg bg-white text-black hover:opacity-90 transition-opacity disabled:opacity-30"
                      >
                        <Video size={13} />
                      </button>
                    </div>
                  </div>

                  {onRegenerate && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Zap size={11} className="text-neutral-600" />
                        <span className="text-xs font-medium text-neutral-500">
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
                        <button
                          onClick={() => onRegenerate(crop.id, regenModel, regenProvider)}
                          disabled={!crop.url || isRegenerating}
                          aria-label={t('moodboard.item.regenerate')}
                          title={t('moodboard.item.regenerate')}
                          className="px-3 py-2 rounded-lg bg-neutral-800 border border-border text-neutral-300 hover:bg-white hover:text-black transition-[color,background-color,border-color,opacity] disabled:opacity-30 flex items-center gap-1.5 shrink-0"
                        >
                          {isRegenerating ? <GlitchLoader size={13} /> : <Zap size={13} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {crop.upscaledUrl && (
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-xs font-medium text-neutral-500">
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
