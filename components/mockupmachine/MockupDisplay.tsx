import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, RefreshCw, ImageIcon, Palette, Loader2, Camera, MapPin, Heart, X, Pickaxe, Pencil } from 'lucide-react';
import { mockupApi } from '../../services/mockupApi';
import { toast } from 'sonner';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../hooks/useTranslation';
import { ReImaginePanel } from '../ReImaginePanel';
import { useMockupLike } from '../../hooks/useMockupLike';

type AspectRatio = '16:9' | '4:3' | '1:1';

interface MockupDisplayProps {
  mockups: (string | null)[];
  isLoading: boolean[];
  onRedraw: (index: number) => void;
  onView: (index: number) => void;
  onNewAngle: (index: number, angle: string) => void;
  onNewBackground: (index: number) => void;
  onReImagine?: (index: number, reimaginePrompt: string) => void;
  onSave?: (index: number, imageBase64: string) => Promise<void>;
  savedIndices?: Set<number>;
  savedMockupIds?: Map<number, string>;
  onToggleLike?: (index: number) => void;
  onLikeStateChange?: (index: number) => (newIsLiked: boolean) => void;
  likedIndices?: Set<number> | Map<number, boolean>;
  onRemove?: (index: number) => void;
  prompt?: string;
  designType?: string;
  tags?: string[];
  brandingTags?: string[];
  aspectRatio: AspectRatio;
  editButtonsDisabled?: boolean;
  creditsPerOperation?: number;
}

const MockupCard: React.FC<{
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
}> = ({ base64Image, isLoading, isRedrawing, onRedraw, onView, onNewAngle, onNewBackground, onReImagine, onSave, isSaved = false, mockupId, onToggleLike, isLiked = false, onLikeStateChange, onRemove, aspectRatio, prompt, designType, tags, brandingTags, editButtonsDisabled = false, creditsPerOperation }) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelPinned, setIsPanelPinned] = useState(false);
  const [showReImaginePanel, setShowReImaginePanel] = useState(false);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with prop
  useEffect(() => {
    setLocalIsLiked(isLiked);
  }, [isLiked]);

  // Use centralized like hook if mockupId is available
  const { toggleLike: handleToggleLikeHook } = useMockupLike({
    mockupId: mockupId || undefined,
    isLiked: localIsLiked,
    onLikeStateChange: (newIsLiked) => {
      setLocalIsLiked(newIsLiked);
      if (onLikeStateChange) {
        onLikeStateChange(newIsLiked);
      }
    },
    translationKeyPrefix: 'canvas',
  });

  // Determine which handler to use: hook (preferred) or callback (fallback)
  const handleToggleLike = mockupId && onLikeStateChange 
    ? handleToggleLikeHook 
    : onToggleLike;

  const PANEL_CLOSE_DELAY = 300; // milliseconds

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    if (!isPanelPinned) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsPanelOpen(false);
        closeTimeoutRef.current = null;
      }, PANEL_CLOSE_DELAY);
    }
  };

  const handleSave = async () => {
    if (!base64Image || !onSave || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      await onSave(base64Image);
      toast.success('Output saved to your collection!', { duration: 2000 });
    } catch (error: any) {
      toast.error('Failed to save output', { duration: 3000 });
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimeout();
    setIsPanelOpen(true);
  };

  const handleMouseLeave = () => {
    scheduleClose();
  };

  const handlePanelMouseEnter = () => {
    clearCloseTimeout();
    setIsPanelOpen(true);
  };

  const handlePanelMouseLeave = () => {
    scheduleClose();
  };

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinnedState = !isPanelPinned;
    setIsPanelPinned(newPinnedState);
    if (newPinnedState) {
      setIsPanelOpen(true);
    }
  };

  const imageUrl = base64Image ? `data:image/png;base64,${base64Image}` : '';
  const canInteract = !isLoading && base64Image;
  const showSkeleton = isLoading && !base64Image;
  const showEmptyState = !isLoading && !base64Image;
  
  const aspectRatioClasses: Record<AspectRatio, string> = {
    '16:9': 'aspect-[16/9]',
    '4:3': 'aspect-[4/3]',
    '1:1': 'aspect-square',
  };

  return (
    <div
      className={`relative ${aspectRatioClasses[aspectRatio]} bg-black/20 rounded-md overflow-visible group border border-zinc-800/50 transition-all duration-300 hover:border-zinc-700/80 hover:shadow-2xl hover:shadow-black/30 hover:scale-[1.02] animate-fade-in w-full`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showSkeleton && (
        <div className="absolute inset-0">
          <SkeletonLoader width="100%" height="100%" className="h-full w-full" variant="rectangular" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="inline-flex items-center justify-center rounded-md bg-black/30 px-3 py-2 border border-white/5">
              <Pickaxe size={20} className="text-[#52ddeb] pickaxe-swing" />
            </div>
          </div>
        </div>
      )}

      {showEmptyState && (
         <div className="w-full h-full flex items-center justify-center text-zinc-700">
           <ImageIcon size={40} strokeWidth={1} />
         </div>
      )}

      {base64Image && (
        <img 
          src={imageUrl} 
          alt="Generated mockup" 
          loading="lazy"
          className={`w-full h-full object-contain cursor-pointer ${isRedrawing ? 'filter blur-sm scale-105' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (canInteract && onView) {
              onView();
            }
          }}
        />
      )}
      
      {isRedrawing && (
         <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-white/80" />
         </div>
      )}

      {isLoading && !isRedrawing && !!base64Image && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-700 overflow-hidden" role="status" aria-label="Generating mockup...">
          <ImageIcon size={40} strokeWidth={1} className="opacity-50" aria-hidden="true" />
          <div className="absolute inset-0 w-full h-full bg-transparent -translate-x-full animate-shimmer shimmer-glow"></div>
          <span className="sr-only">Generating mockup, please wait...</span>
        </div>
      )}
      {/* Like button - top right corner */}
      {canInteract && handleToggleLike && (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleLike(); }}
          className={`absolute top-3 right-3 p-2 rounded-md transition-all z-30 backdrop-blur-sm ${
            localIsLiked
              ? 'bg-[#52ddeb]/20 text-[#52ddeb] hover:bg-[#52ddeb]/30'
              : 'bg-black/40 text-zinc-400 hover:bg-black/60 hover:text-zinc-200'
          }`}
          title={localIsLiked ? t('canvasNodes.outputNode.removeFromFavorites') : t('canvasNodes.outputNode.saveToCollection')}
          aria-label={localIsLiked ? 'Unlike' : 'Like'}
        >
          <Heart size={16} className={localIsLiked ? 'fill-current' : ''} aria-hidden="true" />
        </button>
      )}

      {/* Remove button - top left corner, appears on hover */}
      {canInteract && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-3 left-3 p-2 rounded-md transition-all z-30 backdrop-blur-sm bg-black/40 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100"
          title="Remove output (will be lost if not saved)"
          aria-label="Remove output"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}

      {/* Action Panel */}
      {canInteract && (
        <div
          className={`absolute top-2 left-1/2 -translate-x-1/2 w-fit bg-black/30 backdrop-blur-sm border border-white/5 rounded-md shadow-sm z-20 transition-all duration-200 ease-out ${
            isPanelOpen || isPanelPinned ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-1 opacity-0 scale-95 pointer-events-none'
          }`}
          onClick={handlePanelClick}
          onMouseEnter={handlePanelMouseEnter}
          onMouseLeave={handlePanelMouseLeave}
        >
          <div className="px-1.5 py-0.5 flex items-center justify-center gap-1">
            <Tooltip content={t('mockup.download') || "Download"} position="top">
            <a
              href={imageUrl}
              download={`mockup-${Date.now()}.png`}
              className="p-2 rounded text-zinc-400 hover:text-white hover:bg-white/5 transition-colors duration-150 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={16} />
            </a>
            </Tooltip>
            <Tooltip content={editButtonsDisabled ? (t('mockup.insufficientCredits') || "Insufficient credits to generate") : (t('mockup.redrawTooltip') || "Re-draw (Generate a new variation)")} position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onRedraw(); }}
              disabled={editButtonsDisabled || isRedrawing}
              className={`p-2 rounded transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-white/20 flex items-center gap-1 ${
                editButtonsDisabled || isRedrawing
                  ? 'text-zinc-600 cursor-not-allowed opacity-50'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              aria-label="Re-draw mockup"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                <span className="text-[10px] font-mono text-[#52ddeb] leading-none font-semibold">
                  {creditsPerOperation}
                </span>
              )}
            </button>
            </Tooltip>
            {onReImagine && (
              <Tooltip content={editButtonsDisabled ? (t('mockup.insufficientCredits') || "Insufficient credits to generate") : (t('mockup.reimagineTooltip') || "Re-imagine with AI")} position="top">
              <button
                onClick={(e) => { e.stopPropagation(); setShowReImaginePanel(true); }}
                disabled={editButtonsDisabled || isRedrawing}
                className={`p-2 rounded transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#52ddeb]/50 flex items-center gap-1 ${
                  editButtonsDisabled || isRedrawing
                    ? 'text-zinc-600 cursor-not-allowed opacity-50'
                    : 'text-[#52ddeb] hover:text-white hover:bg-[#52ddeb]/20'
                }`}
                aria-label="Re-imagine mockup"
              >
                <Pencil size={16} aria-hidden="true" />
                {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                  <span className="text-[10px] font-mono text-[#52ddeb] leading-none font-semibold">
                    {creditsPerOperation}
                  </span>
                )}
              </button>
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {/* Re-imagine Panel */}
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
    </div>
  );
};


export const MockupDisplay: React.FC<MockupDisplayProps> = ({ mockups, isLoading, onRedraw, onView, onNewAngle, onNewBackground, onReImagine, onSave, savedIndices = new Set(), savedMockupIds, onToggleLike, onLikeStateChange, likedIndices = new Set(), onRemove, prompt, designType, tags, brandingTags, aspectRatio, editButtonsDisabled = false, creditsPerOperation }) => {
  // Helper to get isLiked status - supports both Set and Map
  const getIsLiked = (index: number): boolean => {
    if (likedIndices instanceof Map) {
      return likedIndices.get(index) ?? false;
    }
    return likedIndices.has(index);
  };

  // When using the hook, it will call onLikeStateChange to sync parent state
  // This should be a direct state update function from parent
  const hasContent = mockups.some(m => m !== null) || isLoading.some(Boolean);
  const isSingleImage = mockups.length === 1;
  const imageCount = mockups.length;
  
  // Smart grid classes based on number of images
  // Mobile and tablet: 1 column max, Desktop: multiple columns
  const getGridClasses = () => {
    if (isSingleImage) return "w-full max-w-6xl mx-auto px-2 sm:px-4 md:px-6";
    
    if (imageCount === 2) {
      return "grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6";
    }
    
    if (imageCount === 3) {
      return "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6";
    }
    
    // 4 images - 2x2 grid
    return "grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6";
  };
  
  if(!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-zinc-600">
        <Palette size={64} strokeWidth={1} />
        <h2 className="mt-4 text-xl font-semibold font-mono uppercase">AWAITING GENERATION</h2>
        <p className="mt-1 text-sm text-zinc-500">Your generated mockups will appear here.</p>
      </div>
    );
  }

  return (
    <section className={isSingleImage ? "h-full flex items-center justify-center py-4 md:py-8" : ""}>
      <div className={`${getGridClasses()} pb-16`}>
        {Array.from({ length: mockups.length }).map((_, index) => {
          const mockupId = savedMockupIds?.get(index);
          const isLiked = getIsLiked(index);
          
          return (
            <MockupCard
              key={index}
              base64Image={mockups[index]}
              isLoading={isLoading[index] && !mockups[index]}
              isRedrawing={isLoading[index] && !!mockups[index]}
              onRedraw={() => onRedraw(index)}
              onView={() => onView(index)}
              onNewAngle={(angle) => onNewAngle(index, angle)}
              onNewBackground={() => onNewBackground(index)}
              onReImagine={onReImagine ? (reimaginePrompt) => onReImagine(index, reimaginePrompt) : undefined}
              onSave={onSave ? (imageBase64) => onSave(index, imageBase64) : undefined}
              isSaved={savedIndices.has(index)}
              mockupId={mockupId}
              onToggleLike={onToggleLike ? () => onToggleLike(index) : undefined}
              isLiked={isLiked}
              onLikeStateChange={mockupId && onLikeStateChange ? onLikeStateChange(index) : undefined}
              onRemove={onRemove ? () => onRemove(index) : undefined}
              prompt={prompt}
              designType={designType}
              tags={tags}
              brandingTags={brandingTags}
              aspectRatio={aspectRatio}
              editButtonsDisabled={editButtonsDisabled}
              creditsPerOperation={creditsPerOperation}
            />
          );
        })}
      </div>
    </section>
  );
};