import React from 'react';
import { Maximize2, Heart, Download, FileText, Trash2, Palette, X } from 'lucide-react';
import { GlitchLoader } from '../../ui/GlitchLoader';
import { cn } from '../../../lib/utils';

interface ImageNodeActionButtonsProps {
  // View button
  onView?: () => void;
  showView?: boolean;

  // Download button
  onDownload?: ((e: React.MouseEvent) => void) | (() => void);
  isDownloading?: boolean;
  showDownload?: boolean;

  // Delete button
  onDelete?: () => void;
  showDelete?: boolean;

  // BrandKit button
  onBrandKit?: () => void;
  showBrandKit?: boolean;
  brandKitDisabled?: boolean;

  // Like/Save button (variations: toggle like or save)
  onLike?: ((e: React.MouseEvent) => void | Promise<void>) | (() => void | Promise<void>);
  onSave?: ((e: React.MouseEvent) => void | Promise<void>) | (() => void | Promise<void>);
  isLiked?: boolean;
  isSaving?: boolean;
  showLike?: boolean;

  // Describe button
  onDescribe?: () => void;
  isDescribing?: boolean;
  describeDisabled?: boolean;
  showDescribe?: boolean;

  // Remove button (for LogoNode)
  onRemove?: () => void;
  showRemove?: boolean;

  // Translation keys prefix
  translationKeyPrefix?: 'canvasNodes.imageNode' | 'canvasNodes.outputNode' | 'canvasNodes.logoNode';
  t?: (key: string) => string;
}

export const ImageNodeActionButtons: React.FC<ImageNodeActionButtonsProps> = ({
  onView,
  showView = false,
  onDownload,
  isDownloading = false,
  showDownload = false,
  onDelete,
  showDelete = false,
  onBrandKit,
  showBrandKit = false,
  brandKitDisabled = false,
  onLike,
  onSave,
  isLiked = false,
  isSaving = false,
  showLike = false,
  onDescribe,
  isDescribing = false,
  describeDisabled = false,
  showDescribe = false,
  onRemove,
  showRemove = false,
  translationKeyPrefix = 'canvasNodes.imageNode',
  t = (key: string) => key,
}) => {
  const handleClick = (e: React.MouseEvent, handler?: () => void) => {
    e.stopPropagation();
    handler?.();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {showView && onView && (
        <button
          onClick={(e) => handleClick(e, onView)}
          className="p-1 bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 rounded transition-colors backdrop-blur-sm border border-zinc-700/30 hover:border-zinc-600/50"
          title={t(`${translationKeyPrefix}.viewFullScreen`) || 'View full screen'}
          onMouseDown={handleMouseDown}
        >
          <Maximize2 size={12} strokeWidth={2} />
        </button>
      )}

      {showDownload && onDownload && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Handle both function types: with or without event parameter
            if (onDownload.length > 0) {
              (onDownload as (e: React.MouseEvent) => void)(e);
            } else {
              (onDownload as () => void)();
            }
          }}
          disabled={isDownloading}
          className={cn(
            "p-1 rounded transition-colors backdrop-blur-sm border",
            isDownloading
              ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed border-zinc-700/20"
              : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30 hover:border-zinc-600/50"
          )}
          title={isDownloading ? t('canvasNodes.shared.downloading') || 'Downloading...' : t(`${translationKeyPrefix}.downloadImage`) || 'Download image'}
          onMouseDown={handleMouseDown}
        >
          {isDownloading ? (
            <GlitchLoader size={12} />
          ) : (
            <Download size={12} strokeWidth={2} />
          )}
        </button>
      )}

      {showDelete && onDelete && (
        <button
          onClick={(e) => handleClick(e, onDelete)}
          className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors backdrop-blur-sm border border-red-500/20 hover:border-red-500/30"
          title={t(`${translationKeyPrefix}.delete`) || 'Delete'}
          onMouseDown={handleMouseDown}
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>
      )}

      {showBrandKit && onBrandKit && (
        <button
          onClick={(e) => handleClick(e, onBrandKit)}
          disabled={brandKitDisabled}
          className={cn(
            "p-1 rounded transition-colors backdrop-blur-sm border",
            brandKitDisabled
              ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed border-zinc-700/20"
              : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border-zinc-700/30 hover:border-zinc-600/50"
          )}
          title={t(`${translationKeyPrefix}.brandKit`) || 'Brand Kit'}
          onMouseDown={handleMouseDown}
        >
          <Palette size={12} strokeWidth={2} />
        </button>
      )}

      {showLike && (onLike || onSave) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const handler = onLike || onSave;
            if (handler) {
              // Handle both function types: with or without event parameter
              if (handler.length > 0) {
                (handler as (e: React.MouseEvent) => void | Promise<void>)(e);
              } else {
                (handler as () => void | Promise<void>)();
              }
            }
          }}
          disabled={isSaving}
          className={cn(
            "p-1 rounded transition-colors backdrop-blur-sm border",
            isSaving
              ? "bg-black/40 text-zinc-500 cursor-wait border border-zinc-700/30"
              : isLiked
                ? "bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 border border-[#52ddeb]/20"
                : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30 hover:border-zinc-600/50"
          )}
          title={
            isLiked
              ? t(`${translationKeyPrefix}.removeFromFavorites`) || 'Remove from favorites'
              : onSave
                ? t(`${translationKeyPrefix}.saveToCollection`) || 'Save to collection'
                : t(`${translationKeyPrefix}.addToFavorites`) || 'Add to favorites'
          }
          onMouseDown={handleMouseDown}
        >
          {isSaving ? (
            <GlitchLoader size={12} />
          ) : (
            <Heart size={12} className={isLiked ? "fill-current" : ""} strokeWidth={2} />
          )}
        </button>
      )}

      {showDescribe && onDescribe && (
        <button
          onClick={(e) => handleClick(e, onDescribe)}
          disabled={describeDisabled || isDescribing}
          className={cn(
            "p-1 rounded transition-colors backdrop-blur-sm border",
            isDescribing || describeDisabled
              ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed border-zinc-700/20"
              : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border-zinc-700/30 hover:border-zinc-600/50"
          )}
          title={isDescribing ? t(`${translationKeyPrefix}.analyzingImage`) || 'Analyzing image...' : t(`${translationKeyPrefix}.describeImageWithAI`) || 'Describe image with AI'}
          onMouseDown={handleMouseDown}
        >
          {isDescribing ? (
            <GlitchLoader size={12} />
          ) : (
            <FileText size={12} strokeWidth={2} />
          )}
        </button>
      )}

      {showRemove && onRemove && (
        <button
          onClick={(e) => handleClick(e, onRemove)}
          className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors backdrop-blur-sm border border-red-500/20 hover:border-red-500/30"
          title={t(`${translationKeyPrefix}.removeLogo`) || t(`${translationKeyPrefix}.remove`) || 'Remove'}
          onMouseDown={handleMouseDown}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </>
  );
};

