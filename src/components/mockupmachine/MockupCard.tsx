import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  RefreshCw,
  ImageIcon,
  Heart,
  X,
  Pencil,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Tooltip } from '@/components/ui/Tooltip';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlitchPickaxe } from '@/components/ui/GlitchPickaxe';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { ReImaginePanel } from '../ReImaginePanel';
import { useMockupLike } from '@/hooks/useMockupLike';
import { isSafeUrl, downloadImage } from '@/utils/imageUtils';
import type { AspectRatio } from '@/types/types';
import { GlassPanel } from '../ui/GlassPanel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useGenerationFeedback } from '@/hooks/useGenerationFeedback';
import { SendToButton } from '@/components/shared/SendToButton';
import { type FeedbackContext, type FeedbackRating } from '@/services/feedbackApi';

export interface MockupCardProps {
  base64Image: string | null;
  isLoading: boolean;
  isRedrawing: boolean;
  onRedraw: () => void;
  onView: () => void;
  onNewAngle: (angle: string) => void;
  onNewBackground: () => void;
  onReImagine?: (reimaginePrompt: string) => void;
  onSave?: (imageBase64: string) => Promise<void>;
  isSaved?: boolean;
  mockupId?: string;
  onToggleLike?: () => void;
  isLiked?: boolean;
  onLikeStateChange?: (newIsLiked: boolean) => void;
  onRemove?: () => void;
  aspectRatio: AspectRatio;
  prompt?: string;
  designType?: string;
  tags?: string[];
  brandingTags?: string[];
  editButtonsDisabled?: boolean;
  creditsPerOperation?: number;
  className?: string;
  style?: React.CSSProperties;
  /** UUID da geração para o RAG loop */
  generationId?: string | null;
  /** Contexto da geração para o RAG loop */
  feedbackContext?: FeedbackContext | (() => FeedbackContext);
  /** Controlled feedback rating — lifted state for sync across views */
  feedbackRating?: FeedbackRating | null;
  /** Called when feedback rating changes */
  onFeedbackRatingChange?: (rating: FeedbackRating | null) => void;
  isGeneratingPrompt?: boolean;
}

export const MockupCard: React.FC<MockupCardProps> = React.memo(
  ({
    base64Image,
    isLoading,
    isRedrawing,
    onRedraw,
    onView,
    onNewAngle,
    onNewBackground,
    onReImagine,
    onSave,
    isSaved = false,
    mockupId,
    onToggleLike,
    isLiked = false,
    onLikeStateChange,
    onRemove,
    aspectRatio,
    prompt,
    designType,
    tags,
    brandingTags,
    editButtonsDisabled = false,
    creditsPerOperation,
    className,
    style,
    generationId,
    feedbackContext,
    feedbackRating,
    onFeedbackRatingChange,
    isGeneratingPrompt = false,
  }) => {
    const { t } = useTranslation();
    const [showReImaginePanel, setShowReImaginePanel] = useState(false);
    const [localIsLiked, setLocalIsLiked] = useState(isLiked);
    useEffect(() => {
      setLocalIsLiked(isLiked);
    }, [isLiked]);

    const { toggleLike: handleToggleLikeHook } = useMockupLike({
      mockupId: mockupId || undefined,
      isLiked: localIsLiked,
      onLikeStateChange: (newIsLiked) => {
        setLocalIsLiked(newIsLiked);
        if (onLikeStateChange) onLikeStateChange(newIsLiked);
      },
      translationKeyPrefix: 'canvas',
    });

    // RAG Logic Hook — controlled when parent provides feedbackRating
    const feedback = useGenerationFeedback({
      generationId,
      feature: 'mockup',
      context: feedbackContext || {},
      controlledRating: feedbackRating,
      onRatingChange: onFeedbackRatingChange,
    });

    const handleToggleLike = mockupId && onLikeStateChange ? handleToggleLikeHook : onToggleLike;

    const imageUrl = useMemo(() => {
      if (!base64Image) return '';
      if (base64Image.startsWith('http') || base64Image.startsWith('data:'))
        return isSafeUrl(base64Image) ? base64Image : '';
      const dataUrl = `data:image/png;base64,${base64Image}`;
      return isSafeUrl(dataUrl) ? dataUrl : '';
    }, [base64Image]);

    const canInteract = !isLoading && base64Image;
    const showSkeleton = isLoading && !base64Image;
    const showEmptyState = !isLoading && !base64Image;
    // Map specific ratios to tailwind classes if needed, or rely on style/layout handling
    // Note: Tailwind v3 supports arbitrary values like aspect-[16/9]
    const aspectRatioClass =
      aspectRatio === '16:9'
        ? 'aspect-[16/9]'
        : aspectRatio === '4:3'
        ? 'aspect-[4/3]'
        : 'aspect-square';

    return (
      <GlassPanel
        className={cn(
          'relative group transition-all duration-300 hover:border-neutral-700 hover:shadow-[0_0_40px_-10px_rgba(0,210,255,0.2)] hover:scale-[1.01] animate-fade-in',
          aspectRatioClass,
          className
        )}
        style={style}
      >
        {showSkeleton && (
          <div className="absolute inset-0">
            <SkeletonLoader
              width="100%"
              height="100%"
              className="h-full w-full"
              variant="rectangular"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <GlitchPickaxe />
            </div>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] max-w-[240px]">
              <PremiumGlitchLoader
                color="#00d2ff"
                steps={
                  isGeneratingPrompt
                    ? ['Preparando', 'Analisando', 'Compondo', 'Conceituando', 'Sintetizando']
                    : ['Criando', 'Desenhando', 'Esculpindo', 'Refinando', 'Moldando', 'Lapidando']
                }
              />
            </div>
          </div>
        )}

        {showEmptyState && (
          <div className="w-full h-full flex items-center justify-center text-neutral-800">
            <ImageIcon size={48} strokeWidth={1} />
          </div>
        )}

        {base64Image && (
          <img
            key={base64Image}
            src={imageUrl}
            alt="Generated mockup"
            loading="lazy"
            className={cn(
              'w-full h-full object-contain cursor-pointer transition-all duration-700',
              isRedrawing
                ? 'filter blur-md scale-105 opacity-50'
                : 'group-hover:scale-[1.02] animate-bloom'
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (canInteract && onView) onView();
            }}
          />
        )}

        {isRedrawing && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-neutral-950/10 backdrop-blur-[2px]">
            <GlitchLoader size={32} color="white" />
          </div>
        )}

        {isLoading && !isRedrawing && !!base64Image && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/20 backdrop-blur-[2px]">
            <ImageIcon size={40} className="text-white/20" />
          </div>
        )}

        {/* Timer removed — PremiumGlitchLoader handles timer + status in one unified display */}

        {/* Action Overlay - pointer-events-none so image stays clickable; only buttons get pointer-events-auto */}
        {canInteract && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {/* Top Buttons: Remove & Like - only the buttons block clicks, not the full row */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
              {onRemove && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="p-2 rounded-md bg-neutral-950/60 backdrop-blur-md text-neutral-400 hover:bg-destructive/20 hover:text-destructive border border-neutral-800 transition-all shadow-lg pointer-events-auto"
                  title="Remove"
                >
                  <X size={12} />
                </Button>
              )}
              {handleToggleLike && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLike();
                  }}
                  className={`p-2 rounded-md backdrop-blur-md border transition-all shadow-lg pointer-events-auto ${
                    localIsLiked
                      ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30 hover:bg-brand-cyan/30'
                      : 'bg-neutral-950/60 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-950/80'
                  }`}
                  title={localIsLiked ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                >
                  <Heart size={12} className={localIsLiked ? 'fill-current' : ''} />
                </Button>
              )}
            </div>

            <div className="absolute bottom-3 left-0 right-0 flex justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
              <GlassPanel
                padding="none"
                className="flex flex-row items-center gap-0.5 p-1 bg-neutral-950/80 backdrop-blur-xl border-white/10 rounded-lg shadow-2xl pointer-events-auto"
              >
                <Tooltip content={t('common.download') || 'Download'} position="top">
                  <a
                    href={imageUrl}
                    download={`mockup-${Date.now()}.png`}
                    className="p-1.5 w-8 h-8 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      try {
                        await downloadImage(imageUrl, 'mockup');
                      } catch (error) {
                        console.error('Download failed:', error);
                      }
                    }}
                  >
                    <Download size={12} />
                  </a>
                </Tooltip>

                <div className="w-px h-3 bg-white/10 mx-1" />

                <SendToButton
                  source="mockupmachine"
                  outputMime="image/png"
                  imageUrl={imageUrl}
                  mimeType="image/png"
                  label="Mockup Machine output"
                  variant="icon"
                />

                <div className="w-px h-3 bg-white/10 mx-1" />

                <Tooltip
                  content={
                    editButtonsDisabled
                      ? t('mockup.insufficientCredits') || 'Insufficient credits'
                      : t('mockup.redrawTooltip') || 'Re-draw'
                  }
                  position="top"
                >
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRedraw();
                    }}
                    disabled={editButtonsDisabled || isRedrawing}
                    className={`h-8 px-2 rounded-md flex items-center gap-1.5 transition-all min-w-0 ${
                      editButtonsDisabled || isRedrawing
                        ? 'text-neutral-600 cursor-not-allowed opacity-50'
                        : 'text-neutral-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <RefreshCw size={14} className={isRedrawing ? 'animate-spin' : ''} />
                    {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                      <span className="text-[10px] font-bold text-brand-cyan">
                        {creditsPerOperation}
                      </span>
                    )}
                  </Button>
                </Tooltip>

                {onReImagine && (
                  <Tooltip
                    content={
                      editButtonsDisabled
                        ? t('mockup.insufficientCredits') || 'Insufficient credits'
                        : t('mockup.reimagineTooltip') || 'Re-imagine'
                    }
                    position="top"
                  >
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReImaginePanel(true);
                      }}
                      disabled={editButtonsDisabled || isRedrawing}
                      className={`h-8 px-2 rounded-md flex items-center gap-1.5 transition-all min-w-0 ${
                        editButtonsDisabled || isRedrawing
                          ? 'text-neutral-600 cursor-not-allowed opacity-50'
                          : 'text-brand-cyan hover:bg-brand-cyan/20'
                      }`}
                    >
                      <Pencil size={14} />
                      {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                        <span className="text-[10px] font-bold text-brand-cyan">
                          {creditsPerOperation}
                        </span>
                      )}
                    </Button>
                  </Tooltip>
                )}

                <div className="w-px h-3 bg-white/10 mx-1" />

                <div className="flex items-center gap-0.5 px-1">
                  <Tooltip
                    content={
                      feedback.rating === 'up'
                        ? 'Remover feedback positivo'
                        : 'Valeu! (Melhora o modelo)'
                    }
                    position="top"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        feedback.submit('up');
                      }}
                      className={cn(
                        'w-8 h-8 rounded-md transition-all',
                        feedback.rating === 'up'
                          ? 'text-success bg-success/10 hover:bg-success/20'
                          : 'text-neutral-400 hover:text-white hover:bg-white/10'
                      )}
                      disabled={feedback.isLoading}
                    >
                      <ThumbsUp
                        size={12}
                        className={cn(feedback.rating === 'up' && 'fill-current')}
                      />
                    </Button>
                  </Tooltip>

                  <Tooltip
                    content={
                      feedback.rating === 'down'
                        ? 'Remover feedback negativo'
                        : 'Não gostei (Reportar ruído)'
                    }
                    position="top"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        feedback.submit('down');
                      }}
                      className={cn(
                        'w-8 h-8 rounded-md transition-all',
                        feedback.rating === 'down'
                          ? 'text-destructive bg-destructive/10 hover:bg-destructive/20'
                          : 'text-neutral-400 hover:text-white hover:bg-white/10'
                      )}
                      disabled={feedback.isLoading}
                    >
                      <ThumbsDown
                        size={12}
                        className={cn(feedback.rating === 'down' && 'fill-current')}
                      />
                    </Button>
                  </Tooltip>
                </div>
              </GlassPanel>
            </div>
          </div>
        )}

        {showReImaginePanel && onReImagine && (
          <ReImaginePanel
            onSubmit={(reimaginePrompt) => {
              onReImagine(reimaginePrompt);
              setShowReImaginePanel(false);
            }}
            onClose={() => setShowReImaginePanel(false)}
            isLoading={isRedrawing || isLoading}
          />
        )}
      </GlassPanel>
    );
  }
);
