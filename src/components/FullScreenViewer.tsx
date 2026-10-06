import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit,
  Pickaxe,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Pencil,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Download,
  Trash2,
} from '@/lib/ui/icons';
import type { Mockup } from '../services/mockupApi';
import { getImageUrl, isSafeUrl } from '@/utils/imageUtils';
import { translateTag, formatDateShort } from '@/utils/localeUtils';
import { downloadBlob } from '@/utils/clipboard';
import { SkeletonLoader } from './ui/SkeletonLoader';
import { AngleSelector } from './mockupmachine/AngleSelector';
import { BackgroundSelector } from './mockupmachine/BackgroundSelector';
import { LightingSelector } from './mockupmachine/LightingSelector';
import { ReImaginePanel } from './ReImaginePanel';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { useGenerationFeedback } from '@/hooks/useGenerationFeedback';
import { type FeedbackContext, type FeedbackRating } from '@/services/feedbackApi';
import { cn } from '@/lib/utils';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  // Use relative URL - works in both local (with proxy) and production
  return '/api';
};

// Check if URL is from R2 (Cloudflare R2 bucket)
const isR2Url = (url: string): boolean => {
  // Whitelist of allowed R2 hostnames
  const allowedR2Hosts = ['r2.dev', 'r2.cloudflarestorage.com'];

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check if hostname ends with allowed R2 domains (supports subdomains like pub-xxxxx.r2.dev)
    return allowedR2Hosts.some(
      (allowedHost) => hostname === allowedHost || hostname.endsWith('.' + allowedHost)
    );
  } catch {
    // Invalid URL format - not an R2 URL
    return false;
  }
};

interface FullScreenViewerProps {
  base64Image?: string | null;
  imageUrl?: string | null;
  isLoading: boolean;
  onClose: () => void;
  mockup?: Mockup;
  mockupId?: string;
  onDelete?: () => void;
  isDeleting?: boolean;
  isAuthenticated?: boolean;
  onAuthRequired?: () => void;
  onOpenInEditor?: (imageBase64: string) => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  // Edit buttons (only shown when provided - from MockupMachinePage)
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onNewAngle?: (angle: string) => void;
  onNewBackground?: (background: string) => void;
  onNewLighting?: (lighting: string) => void;
  onReImagine?: (reimaginePrompt: string) => void;
  availableAngles?: string[];
  availableBackgrounds?: string[];
  availableLightings?: string[];
  editButtonsDisabled?: boolean;
  creditsPerOperation?: number;
  // Like functionality (only shown when provided)
  onToggleLike?: () => void;
  onLikeStateChange?: (newIsLiked: boolean) => void;
  isLiked?: boolean;
  showActions?: boolean;
  // Feedback (thumbs up/down for RAG training)
  generationId?: string | null;
  feedbackContext?: FeedbackContext | (() => FeedbackContext);
  /** Controlled feedback rating — lifted state synced with MockupCard */
  feedbackRating?: FeedbackRating | null;
  onFeedbackRatingChange?: (rating: FeedbackRating | null) => void;
}

export const FullScreenViewer: React.FC<FullScreenViewerProps> = ({
  base64Image,
  imageUrl: propImageUrl,
  isLoading,
  onClose,
  mockup,
  mockupId,
  onDelete,
  isDeleting = false,
  isAuthenticated = false,
  onAuthRequired,
  onOpenInEditor,
  onNavigatePrevious,
  onNavigateNext,
  hasPrevious = false,
  hasNext = false,
  onZoomIn,
  onZoomOut,
  onNewAngle,
  onNewBackground,
  onNewLighting,
  onReImagine,
  availableAngles,
  availableBackgrounds,
  availableLightings,
  editButtonsDisabled = false,
  creditsPerOperation,
  onToggleLike,
  onLikeStateChange,
  isLiked = false,
  showActions = false,
  generationId,
  feedbackContext,
  feedbackRating,
  onFeedbackRatingChange,
}) => {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showReImaginePanel, setShowReImaginePanel] = useState(false);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const [isConvertingImage, setIsConvertingImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Sync local liked state with prop
  useEffect(() => {
    setLocalIsLiked(isLiked);
  }, [isLiked]);

  // RAG feedback (thumbs up/down) — controlled when parent lifts state
  const feedback = useGenerationFeedback({
    generationId,
    feature: 'mockup',
    context: feedbackContext || {},
    controlledRating: feedbackRating,
    onRatingChange: onFeedbackRatingChange,
  });

  // Check if edit buttons should be shown (only when showActions is true and props are provided)
  const showEditButtons =
    showActions &&
    !!(onZoomIn || onZoomOut || onNewAngle || onNewBackground || onNewLighting || onReImagine);

  const handleToggleLike = () => {
    if (onToggleLike) {
      const newLikedState = !localIsLiked;
      setLocalIsLiked(newLikedState);
      if (onLikeStateChange) {
        onLikeStateChange(newLikedState);
      }
      onToggleLike();
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    if (!safeImageUrl || isDownloading) return;
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const response = await fetch(safeImageUrl);
      const blob = await response.blob();
      downloadBlob(blob, `visant-image-${Date.now()}.png`);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback
      window.open(safeImageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // Get image URL from mockup, prop, or base64
  const finalImageUrl = mockup
    ? getImageUrl(mockup)
    : propImageUrl
      ? propImageUrl
      : base64Image
        ? base64Image.startsWith('http') || base64Image.startsWith('data:')
          ? base64Image
          : `data:image/png;base64,${base64Image}`
        : '';

  // Sanitize the URL to prevent XSS
  const safeImageUrl = isSafeUrl(finalImageUrl) ? finalImageUrl : '';

  const hasImage = !!safeImageUrl;

  const handleOpenInEditor = async () => {
    if (!onOpenInEditor) return;

    // If we already have base64, use it directly
    if (base64Image) {
      onOpenInEditor(base64Image);
      onClose();
      return;
    }

    // If we have a URL-based image, convert it to base64
    if (safeImageUrl) {
      setIsConvertingImage(true);
      try {
        // If it's already a data URL, extract the base64 part
        if (safeImageUrl.startsWith('data:image')) {
          const base64Match = safeImageUrl.match(/data:image\/[^;]+;base64,(.+)/);
          if (base64Match && base64Match[1]) {
            onOpenInEditor(base64Match[1]);
            onClose();
            setIsConvertingImage(false);
            return;
          }
        }

        // Use proxy endpoint for R2 URLs to bypass CORS
        if (isR2Url(safeImageUrl)) {
          try {
            const API_BASE_URL = getApiBaseUrl();
            const proxyUrl = `${API_BASE_URL}/images/proxy?url=${encodeURIComponent(safeImageUrl)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.error || `Proxy failed: ${response.status} ${response.statusText}`
              );
            }

            const data = await response.json();

            if (!data.base64) {
              throw new Error('Proxy returned empty base64 data');
            }

            // Use the base64 directly from proxy response
            onOpenInEditor(data.base64);
            onClose();
            setIsConvertingImage(false);
            return;
          } catch (error) {
            console.error('Error using proxy for R2 URL:', {
              url: safeImageUrl,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }

        // Direct fetch for non-R2 URLs (they may have CORS configured)
        const response = await fetch(safeImageUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch image');
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Extract base64 from data URL
          const base64Match = result.match(/data:image\/[^;]+;base64,(.+)/);
          if (base64Match && base64Match[1]) {
            onOpenInEditor(base64Match[1]);
            onClose();
          } else {
            console.error('Failed to extract base64 from image');
          }
          setIsConvertingImage(false);
        };
        reader.onerror = () => {
          console.error('Failed to read image as base64');
          setIsConvertingImage(false);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error converting image to base64:', error);
        setIsConvertingImage(false);
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return formatDateShort(dateString);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && hasPrevious && onNavigatePrevious) {
        event.preventDefault();
        onNavigatePrevious();
      } else if (event.key === 'ArrowRight' && hasNext && onNavigateNext) {
        event.preventDefault();
        onNavigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, hasPrevious, hasNext, onNavigatePrevious, onNavigateNext]);

  return (
    <div
      className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 md:p-8 lg:p-12 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] md:max-w-[85vw] lg:max-w-[80vw] w-full max-h-[90vh] bg-card border border-border rounded-md shadow-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-20"
          title={t('fullScreenViewer.close')}
          aria-label={t('fullScreenViewer.close')}
        >
          <X size={16} />
        </Button>

        {/* Navigation Arrows */}
        {hasPrevious && onNavigatePrevious && (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onNavigatePrevious();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title={t('fullScreenViewer.previous')}
            aria-label={t('fullScreenViewer.previous')}
          >
            <ChevronLeft size={18} />
          </Button>
        )}
        {hasNext && onNavigateNext && (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateNext();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title={t('fullScreenViewer.next')}
            aria-label={t('fullScreenViewer.next')}
          >
            <ChevronRight size={18} />
          </Button>
        )}

        <div className="flex-grow flex gap-4 min-h-0 relative">
          {/* Image Container */}
          <div className="flex-1 relative bg-muted/40 rounded-md flex items-center justify-center overflow-hidden p-4">
            {isLoading && (
              <div className="absolute inset-0">
                <SkeletonLoader
                  width="100%"
                  height="100%"
                  className="h-full w-full"
                  variant="rectangular"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="inline-flex items-center justify-center rounded-md bg-background/60 px-3 py-2 border border-border">
                    <Pickaxe size={20} className="text-muted-foreground pickaxe-swing" />
                  </div>
                </div>
              </div>
            )}
            {hasImage && !isLoading && (
              <img
                src={safeImageUrl}
                alt={mockup?.prompt || t('fullScreenViewer.imageAlt')}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded-md"
              />
            )}

            {/* Like + Feedback buttons - top right corner */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
              {/* Delete: the prop existed but nothing rendered it, so callers
                  that moved delete here (My Mockups) had no way to delete. */}
              {onDelete && isAuthenticated && !isLoading && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  disabled={isDeleting}
                  className="p-2 rounded-md bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background transition-colors border border-border disabled:opacity-50"
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  {isDeleting ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </Button>
              )}

              {/* Download Button */}
              {hasImage && !isLoading && (
                <Button
                  variant="ghost"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="p-2 rounded-md bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background transition-colors border border-border"
                  title={t('common.download')}
                  aria-label={t('common.download')}
                >
                  {isDownloading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                </Button>
              )}

              {/* RAG Feedback (thumbs up/down) */}
              {generationId && (
                <div className="flex items-center gap-1 rounded-xl bg-background/80 border border-border p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                      feedback.rating === 'up'
                        ? t('fullScreenViewer.removePositiveFeedback')
                        : t('fullScreenViewer.positiveFeedback')
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      feedback.submit('up');
                    }}
                    className={cn(
                      'w-8 h-8 rounded-md transition-colors',
                      feedback.rating === 'up'
                        ? 'text-success bg-success/10 hover:bg-success/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    disabled={feedback.isLoading}
                  >
                    <ThumbsUp
                      size={14}
                      aria-hidden="true"
                      className={cn(feedback.rating === 'up' && 'fill-current')}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                      feedback.rating === 'down'
                        ? t('fullScreenViewer.removeNegativeFeedback')
                        : t('fullScreenViewer.negativeFeedback')
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      feedback.submit('down');
                    }}
                    className={cn(
                      'w-8 h-8 rounded-md transition-colors',
                      feedback.rating === 'down'
                        ? 'text-destructive bg-destructive/10 hover:bg-destructive/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    disabled={feedback.isLoading}
                  >
                    <ThumbsDown
                      size={14}
                      className={cn(feedback.rating === 'down' && 'fill-current')}
                    />
                  </Button>
                </div>
              )}

              {/* Like/Favorite button */}
              {onToggleLike && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLike();
                  }}
                  className={cn(
                    'p-2 rounded-md transition-colors',
                    localIsLiked
                      ? 'bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30'
                      : 'bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground'
                  )}
                  title={
                    localIsLiked
                      ? t('canvasNodes.outputNode.removeFromFavorites')
                      : t('canvasNodes.outputNode.saveToCollection')
                  }
                  aria-label={
                    localIsLiked
                      ? t('canvasNodes.outputNode.removeFromFavorites')
                      : t('canvasNodes.outputNode.saveToCollection')
                  }
                >
                  <Heart
                    size={18}
                    className={localIsLiked ? 'fill-current' : ''}
                    aria-hidden="true"
                  />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Edit Buttons Panel (only shown when props are provided from MockupMachinePage) */}
        {!isLoading && hasImage && showEditButtons && (
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-md border border-border">
            {onNewAngle && availableAngles && availableAngles.length > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <AngleSelector
                  availableAngles={availableAngles}
                  onAngleSelect={(angle) => {
                    onNewAngle(angle);
                    onClose();
                  }}
                  disabled={editButtonsDisabled || isLoading}
                  className="w-full sm:w-auto"
                  buttonClassName="px-3 py-1.5 text-xs"
                  creditsPerOperation={creditsPerOperation}
                  openUpward={true}
                />
              </div>
            )}
            {onNewBackground && availableBackgrounds && availableBackgrounds.length > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <BackgroundSelector
                  availableBackgrounds={availableBackgrounds}
                  onBackgroundSelect={(background) => {
                    onNewBackground(background);
                    onClose();
                  }}
                  disabled={editButtonsDisabled || isLoading}
                  className="w-full sm:w-auto"
                  buttonClassName="px-3 py-1.5 text-xs"
                  creditsPerOperation={creditsPerOperation}
                  openUpward={true}
                />
              </div>
            )}
            {onNewLighting && availableLightings && availableLightings.length > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <LightingSelector
                  availableLightings={availableLightings}
                  onLightingSelect={(lighting) => {
                    onNewLighting(lighting);
                    onClose();
                  }}
                  disabled={editButtonsDisabled || isLoading}
                  className="w-full sm:w-auto"
                  buttonClassName="px-3 py-1.5 text-xs"
                  creditsPerOperation={creditsPerOperation}
                  openUpward={true}
                />
              </div>
            )}
            {onZoomIn && (
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onZoomIn();
                }}
                disabled={editButtonsDisabled || isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground border border-border hover:border-ring hover:bg-muted hover:text-foreground rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('fullScreenViewer.zoomInHint')}
              >
                <ZoomIn size={14} />
                <span className="text-xs font-medium whitespace-nowrap">
                  {t('fullScreenViewer.zoomIn')}
                </span>
                {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                  <span className="text-2xs font-mono text-muted-foreground font-medium">
                    {creditsPerOperation}
                  </span>
                )}
              </Button>
            )}
            {onZoomOut && (
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onZoomOut();
                }}
                disabled={editButtonsDisabled || isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground border border-border hover:border-ring hover:bg-muted hover:text-foreground rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('fullScreenViewer.zoomOutHint')}
              >
                <ZoomOut size={14} />
                <span className="text-xs font-medium whitespace-nowrap">
                  {t('fullScreenViewer.zoomOut')}
                </span>
                {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                  <span className="text-2xs font-mono text-muted-foreground font-medium">
                    {creditsPerOperation}
                  </span>
                )}
              </Button>
            )}
            {onReImagine && (
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReImaginePanel(true);
                }}
                disabled={editButtonsDisabled || isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground border border-border hover:border-ring hover:bg-muted hover:text-foreground rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('fullScreenViewer.reImagineHint')}
              >
                <Pencil size={14} />
                <span className="text-xs font-medium whitespace-nowrap">
                  {t('fullScreenViewer.reImagine')}
                </span>
                {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                  <span className="text-2xs font-mono text-muted-foreground font-medium">
                    {creditsPerOperation}
                  </span>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Open in Editor Button */}
        {!isLoading && hasImage && onOpenInEditor && showActions && (
          <div className="flex-shrink-0">
            <Button
              variant="ghost"
              onClick={handleOpenInEditor}
              disabled={isConvertingImage}
              className="flex flex-nowrap items-center gap-2 px-3 py-1.5 text-muted-foreground border border-border hover:border-ring hover:bg-muted hover:text-foreground rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConvertingImage ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="text-xs font-medium whitespace-nowrap">
                    {t('common.loading')}
                  </span>
                </>
              ) : (
                <>
                  <Edit size={14} />
                  <span className="text-xs font-medium whitespace-nowrap">
                    {t('fullScreenViewer.openInEditor')}
                  </span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Mockup Information */}
        {mockup && !isLoading && (
          <div className="flex-shrink-0 space-y-3 border-t border-border pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{mockup.designType}</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {mockup.aspectRatio}
                </span>
              </div>

              {mockup.prompt && (
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                  >
                    <FileText size={14} />
                    <span>
                      {showPrompt
                        ? t('fullScreenViewer.hidePrompt')
                        : t('fullScreenViewer.showPrompt')}
                    </span>
                    {showPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </Button>
                  {showPrompt && (
                    <p className="text-sm text-foreground bg-muted/40 p-3 rounded-md border border-border">
                      {mockup.prompt}
                    </p>
                  )}
                </div>
              )}

              {((Array.isArray(mockup.tags) && mockup.tags.length > 0) ||
                (Array.isArray(mockup.brandingTags) && mockup.brandingTags.length > 0)) && (
                <div className="flex flex-wrap gap-2">
                  {[
                    ...(Array.isArray(mockup.tags) ? mockup.tags : []),
                    ...(Array.isArray(mockup.brandingTags) ? mockup.brandingTags : []),
                  ].map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 border border-border text-xs text-muted-foreground rounded"
                    >
                      {translateTag(String(tag))}
                    </span>
                  ))}
                </div>
              )}

              {mockup.createdAt && (
                <p className="text-xs text-muted-foreground">{formatDate(mockup.createdAt)}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Re-imagine Panel */}
      {showReImaginePanel && onReImagine && (
        <ReImaginePanel
          onSubmit={(reimaginePrompt) => {
            onReImagine(reimaginePrompt);
            setShowReImaginePanel(false);
            onClose();
          }}
          onClose={() => setShowReImaginePanel(false)}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
