import React, { useEffect, useState } from 'react';
import { X, FileText, ChevronDown, ChevronUp, Edit, Pickaxe, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MapPin, RefreshCw, Pencil, Heart } from 'lucide-react';
import type { Mockup } from '../services/mockupApi';
import { getImageUrl } from '../utils/imageUtils';
import { translateTag } from '../utils/localeUtils';
import { SkeletonLoader } from './ui/SkeletonLoader';
import { AngleSelector } from './mockupmachine/AngleSelector';
import { BackgroundSelector } from './mockupmachine/BackgroundSelector';
import { LightingSelector } from './mockupmachine/LightingSelector';
import { ReImaginePanel } from './ReImaginePanel';
import { useTranslation } from '../hooks/useTranslation';

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
  return url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com');
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
  isLiked = false
}) => {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showReImaginePanel, setShowReImaginePanel] = useState(false);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const [isConvertingImage, setIsConvertingImage] = useState(false);

  // Sync local liked state with prop
  useEffect(() => {
    setLocalIsLiked(isLiked);
  }, [isLiked]);

  // Check if edit buttons should be shown (when props are provided from MockupMachinePage)
  const showEditButtons = !!(onZoomIn || onZoomOut || onNewAngle || onNewBackground || onNewLighting || onReImagine);

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

  // Get image URL from mockup, prop, or base64
  const finalImageUrl = mockup 
    ? getImageUrl(mockup)
    : propImageUrl 
    ? propImageUrl
    : base64Image 
    ? `data:image/png;base64,${base64Image}`
    : '';
    
  const hasImage = !!finalImageUrl;

  const handleOpenInEditor = async () => {
    if (!onOpenInEditor) return;

    // If we already have base64, use it directly
    if (base64Image) {
      onOpenInEditor(base64Image);
      onClose();
      return;
    }

    // If we have a URL-based image, convert it to base64
    if (finalImageUrl) {
      setIsConvertingImage(true);
      try {
        // If it's already a data URL, extract the base64 part
        if (finalImageUrl.startsWith('data:image')) {
          const base64Match = finalImageUrl.match(/data:image\/[^;]+;base64,(.+)/);
          if (base64Match && base64Match[1]) {
            onOpenInEditor(base64Match[1]);
            onClose();
            setIsConvertingImage(false);
            return;
          }
        }

        // Use proxy endpoint for R2 URLs to bypass CORS
        if (isR2Url(finalImageUrl)) {
          try {
            const API_BASE_URL = getApiBaseUrl();
            const proxyUrl = `${API_BASE_URL}/images/proxy?url=${encodeURIComponent(finalImageUrl)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Proxy failed: ${response.status} ${response.statusText}`);
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
              url: finalImageUrl,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }

        // Direct fetch for non-R2 URLs (they may have CORS configured)
        const response = await fetch(finalImageUrl);
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative max-w-[95vw] w-full max-h-[95vh] bg-[#1A1A1A] border border-zinc-800/50 rounded-md shadow-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 p-1.5 rounded-md text-zinc-400/40 hover:text-zinc-300/80 hover:bg-black/20 transition-all z-20"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>

        {/* Navigation Arrows */}
        {hasPrevious && onNavigatePrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigatePrevious();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 text-zinc-400/30 hover:text-zinc-300/70 hover:bg-black/10 rounded-md transition-all"
            title="Previous (←)"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {hasNext && onNavigateNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateNext();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 text-zinc-400/30 hover:text-zinc-300/70 hover:bg-black/10 rounded-md transition-all"
            title="Next (→)"
          >
            <ChevronRight size={18} />
          </button>
        )}

        <div className="flex-grow flex gap-4 min-h-0 relative">
          {/* Image Container */}
          <div 
            className="flex-1 relative bg-black/20 rounded-md flex items-center justify-center overflow-hidden p-4 transition-all duration-300"
          >
            {isLoading && (
              <div className="absolute inset-0">
                <SkeletonLoader width="100%" height="100%" className="h-full w-full" variant="rectangular" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="inline-flex items-center justify-center rounded-md bg-black/30 px-3 py-2 border border-white/5">
                    <Pickaxe size={20} className="text-[#52ddeb] pickaxe-swing" />
                  </div>
                </div>
              </div>
            )}
            {hasImage && !isLoading && (
              <img 
                src={finalImageUrl} 
                alt="Full-size mockup" 
                className="max-w-full max-h-full w-auto h-auto object-contain rounded-md"
              />
            )}

            {/* Like button - top right corner (only when provided) */}
            {onToggleLike && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLike();
                }}
                className={`absolute top-4 right-4 p-2 rounded-md transition-all z-30 backdrop-blur-sm ${
                  localIsLiked
                    ? 'bg-[#52ddeb]/20 text-[#52ddeb] hover:bg-[#52ddeb]/30'
                    : 'bg-black/40 text-zinc-400 hover:bg-black/60 hover:text-zinc-200'
                }`}
                title={localIsLiked ? t('canvasNodes.outputNode.removeFromFavorites') : t('canvasNodes.outputNode.saveToCollection')}
                aria-label={localIsLiked ? 'Unlike' : 'Like'}
              >
                <Heart size={18} className={localIsLiked ? 'fill-current' : ''} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        
        {/* Edit Buttons Panel (only shown when props are provided from MockupMachinePage) */}
        {!isLoading && hasImage && showEditButtons && (
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 p-3 bg-black/20 rounded-md border border-white/5">
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onZoomIn();
                }}
                disabled={editButtonsDisabled || isLoading}
                className={`flex items-center gap-2 px-3 py-1.5 bg-black/10 backdrop-blur-sm text-zinc-400 border border-white/5 hover:border-white/8 hover:bg-white/3 hover:text-zinc-300 rounded-md transition-all duration-200 ${
                  editButtonsDisabled || isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
                title="Zoom In (Move camera closer)"
              >
                <ZoomIn size={14} />
                <span className="text-xs font-medium whitespace-nowrap">Zoom In</span>
                {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                  <span className="text-[10px] font-mono text-[#52ddeb] font-semibold">
                    {creditsPerOperation}
                  </span>
                )}
              </button>
            )}
            {onZoomOut && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onZoomOut();
                }}
                disabled={editButtonsDisabled || isLoading}
                className={`flex items-center gap-2 px-3 py-1.5 bg-black/10 backdrop-blur-sm text-zinc-400 border border-white/5 hover:border-white/8 hover:bg-white/3 hover:text-zinc-300 rounded-md transition-all duration-200 ${
                  editButtonsDisabled || isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
                title="Zoom Out (Move camera further)"
              >
                <ZoomOut size={14} />
                <span className="text-xs font-medium whitespace-nowrap">Zoom Out</span>
                {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                  <span className="text-[10px] font-mono text-[#52ddeb] font-semibold">
                    {creditsPerOperation}
                  </span>
                )}
              </button>
            )}
            {onReImagine && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReImaginePanel(true);
                }}
                disabled={editButtonsDisabled || isLoading}
                className={`flex items-center gap-2 px-3 py-1.5 bg-black/10 backdrop-blur-sm text-[#52ddeb] border border-[#52ddeb]/20 hover:border-[#52ddeb]/40 hover:bg-[#52ddeb]/10 rounded-md transition-all duration-200 ${
                  editButtonsDisabled || isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
                title="Re-imagine with AI"
              >
                <Pencil size={14} />
                <span className="text-xs font-medium whitespace-nowrap">Re-imagine</span>
                {creditsPerOperation !== undefined && creditsPerOperation > 0 && (
                  <span className="text-[10px] font-mono text-[#52ddeb] font-semibold">
                    {creditsPerOperation}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Open in Editor Button */}
        {!isLoading && hasImage && onOpenInEditor && (
          <div className="flex-shrink-0">
            <button
              onClick={handleOpenInEditor}
              disabled={isConvertingImage}
              className={`flex flex-nowrap items-center gap-2 px-3 py-1.5 bg-black/10 backdrop-blur-sm text-zinc-400 border border-white/5 hover:border-white/8 hover:bg-white/3 hover:text-zinc-300 rounded-md transition-all duration-200 ${
                isConvertingImage ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Open in Editor"
            >
              {isConvertingImage ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="text-xs font-medium whitespace-nowrap">Loading...</span>
                </>
              ) : (
                <>
                  <Edit size={14} />
                  <span className="text-xs font-medium whitespace-nowrap">Open in Editor</span>
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Mockup Information */}
        {mockup && !isLoading && (
          <div className="flex-shrink-0 space-y-3 border-t border-zinc-800/50 pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-500 uppercase">
                  {mockup.designType}
                </span>
                <span className="text-xs font-mono text-zinc-500">
                  {mockup.aspectRatio}
                </span>
              </div>
              
              {mockup.prompt && (
                <div>
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-[#52ddeb] transition-colors mb-2"
                  >
                    <FileText size={14} />
                    <span>{showPrompt ? 'Hide' : 'Show'} Prompt</span>
                    {showPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showPrompt && (
                    <p className="text-sm font-mono text-zinc-300 bg-black/20 p-3 rounded-md border border-zinc-700/30">
                      {mockup.prompt}
                    </p>
                  )}
                </div>
              )}

              {((Array.isArray(mockup.tags) && mockup.tags.length > 0) || (Array.isArray(mockup.brandingTags) && mockup.brandingTags.length > 0)) && (
                <div className="flex flex-wrap gap-2">
                  {[...(Array.isArray(mockup.tags) ? mockup.tags : []), ...(Array.isArray(mockup.brandingTags) ? mockup.brandingTags : [])].map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-transparent border border-zinc-700/30 text-xs font-mono text-zinc-400 rounded"
                    >
                      {translateTag(String(tag))}
                    </span>
                  ))}
                </div>
              )}

              {mockup.createdAt && (
                <p className="text-xs font-mono text-zinc-500">
                  {formatDate(mockup.createdAt)}
                </p>
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