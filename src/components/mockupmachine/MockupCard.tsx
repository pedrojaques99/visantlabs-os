import React, { useState, useEffect, useMemo } from 'react';
import { MediaTile } from '@/components/ui/MediaTile';
import {
  Download,
  RefreshCw,
  ImageIcon,
  Heart,
  X,
  Pencil,
  ThumbsUp,
  ThumbsDown,
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { Tooltip } from '@/components/ui/Tooltip';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';
import { ReImaginePanel } from '../ReImaginePanel';
import { useMockupLike } from '@/hooks/useMockupLike';
import { isSafeUrl, downloadImage } from '@/utils/imageUtils';
import type { AspectRatio } from '@/types/types';
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

    const canInteract = !isLoading && !!base64Image;
    const showSkeleton = isLoading && !base64Image;
    const tileRatio = aspectRatio === '16:9' ? '16 / 9' : aspectRatio === '4:3' ? '4 / 3' : 1;

    const likeLabel = localIsLiked
      ? t('canvasNodes.imageNode.removeFromFavorites')
      : t('canvasNodes.imageNode.addToFavorites');
    const promptSteps = [1, 2, 3, 4, 5].map((n) => t(`mockup.card.promptStep${n}`));
    const imageSteps = [1, 2, 3, 4, 5, 6].map((n) => t(`mockup.card.imageStep${n}`));

    const toolbarButtonClass = (disabled: boolean) =>
      cn(
        'h-8 min-w-0 gap-1.5 rounded-md px-2',
        disabled
          ? 'cursor-not-allowed text-muted-foreground opacity-50'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      );

    // Cover overlay, same three states as before: generating (no image yet),
    // redrawing over the old image, or loading with a stale image.
    const busy = showSkeleton ? (
      <GeneratingImageCard
        isLoading
        showFrame={false}
        className="h-full w-full"
        steps={isGeneratingPrompt ? promptSteps : imageSteps}
      />
    ) : isRedrawing ? (
      <GlitchLoader size={32} />
    ) : isLoading && !!base64Image ? (
      <ImageIcon size={40} className="text-muted-foreground" />
    ) : undefined;

    // While redrawing, the old card sat under a blocking overlay: the controls
    // stay visible but inert, and the main action is off.
    const actions =
      canInteract && (onRemove || handleToggleLike) ? (
        <div className="flex items-center gap-1" inert={isRedrawing || undefined}>
          {handleToggleLike && (
            <Button
              variant="surface"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLike();
              }}
              aria-pressed={localIsLiked}
              className={cn('bg-card', localIsLiked && 'border-ring text-foreground')}
              title={likeLabel}
              aria-label={likeLabel}
            >
              <Heart size={12} className={localIsLiked ? 'fill-current' : ''} />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="surface"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="bg-card hover:bg-destructive/10 hover:text-destructive"
              title={t('mockup.removeImage')}
              aria-label={t('mockup.removeImage')}
            >
              <X size={12} />
            </Button>
          )}
        </div>
      ) : undefined;

    const footer = canInteract ? (
      <div
        className="flex flex-row items-center justify-center gap-0.5 border-t border-border p-1"
        inert={isRedrawing || undefined}
      >
        <Tooltip content={t('common.download')} position="top">
          <a
            href={imageUrl}
            download={`mockup-${Date.now()}.png`}
            aria-label={t('common.download')}
            className="flex h-8 w-8 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

        <div className="mx-1 h-3 w-px bg-border" />

        <SendToButton
          source="mockupmachine"
          outputMime="image/png"
          imageUrl={imageUrl}
          mimeType="image/png"
          label="Mockup Machine output"
          variant="icon"
        />

        <div className="mx-1 h-3 w-px bg-border" />

        <Tooltip
          content={
            editButtonsDisabled ? t('mockup.insufficientCredits') : t('mockup.redrawTooltip')
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
            aria-label={t('mockup.redrawTooltip')}
            className={toolbarButtonClass(editButtonsDisabled || isRedrawing)}
          >
            <RefreshCw size={14} className={isRedrawing ? 'animate-spin' : ''} />
            {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
              <span className="text-2xs font-medium text-foreground">{creditsPerOperation}</span>
            )}
          </Button>
        </Tooltip>

        {onReImagine && (
          <Tooltip
            content={
              editButtonsDisabled ? t('mockup.insufficientCredits') : t('mockup.reimagineTooltip')
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
              aria-label={t('mockup.reimagineTooltip')}
              className={toolbarButtonClass(editButtonsDisabled || isRedrawing)}
            >
              <Pencil size={14} />
              {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                <span className="text-2xs font-medium text-foreground">{creditsPerOperation}</span>
              )}
            </Button>
          </Tooltip>
        )}

        <div className="mx-1 h-3 w-px bg-border" />

        <div className="flex items-center gap-0.5 px-1">
          <Tooltip
            content={
              feedback.rating === 'up'
                ? t('mockup.card.feedbackUpRemove')
                : t('mockup.card.feedbackUp')
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
              aria-pressed={feedback.rating === 'up'}
              aria-label={t('mockup.card.feedbackUp')}
              className={cn(
                'h-8 w-8 rounded-md transition-colors',
                feedback.rating === 'up'
                  ? 'bg-success/10 text-success hover:bg-success/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              disabled={feedback.isLoading}
            >
              <ThumbsUp size={12} className={cn(feedback.rating === 'up' && 'fill-current')} />
            </Button>
          </Tooltip>

          <Tooltip
            content={
              feedback.rating === 'down'
                ? t('mockup.card.feedbackDownRemove')
                : t('mockup.card.feedbackDown')
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
              aria-pressed={feedback.rating === 'down'}
              aria-label={t('mockup.card.feedbackDown')}
              className={cn(
                'h-8 w-8 rounded-md transition-colors',
                feedback.rating === 'down'
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              disabled={feedback.isLoading}
            >
              <ThumbsDown size={12} className={cn(feedback.rating === 'down' && 'fill-current')} />
            </Button>
          </Tooltip>
        </div>
      </div>
    ) : undefined;

    return (
      <>
        <MediaTile
          // Remount on a new image so the bloom-in replays (as the old keyed <img> did).
          key={base64Image ?? 'empty'}
          src={imageUrl || undefined}
          alt={t('mockup.generatedAlt')}
          aspectRatio={tileRatio}
          fallbackIcon={ImageIcon}
          loading="lazy"
          imageClassName={cn(
            'object-contain transition-opacity duration-700',
            isRedrawing ? 'opacity-50' : 'animate-bloom'
          )}
          onClick={
            canInteract && onView && !isRedrawing
              ? (e) => {
                  e.stopPropagation();
                  onView();
                }
              : undefined
          }
          actionLabel={t('mockup.generatedAlt')}
          actions={actions}
          footer={footer}
          busy={busy}
          className={cn('animate-fade-in', className)}
          style={style}
        />

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
      </>
    );
  }
);
