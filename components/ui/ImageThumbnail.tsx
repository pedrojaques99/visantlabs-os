import React, { useState, useMemo } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { isSafeUrl } from '../../utils/imageUtils';

interface ImageThumbnailProps {
  base64: string; // Can be URL or base64 string
  index: number;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  base64,
  index,
  onRemove,
  onClick,
  className,
}) => {
  const [hasError, setHasError] = useState(false);
  // Check if it's already a URL (http/https) or data URL, otherwise treat as base64
  if (!base64 || typeof base64 !== 'string') {
    return null;
  }
  const imageUrl = useMemo(() => {
    if (base64.startsWith('http://') || base64.startsWith('https://') || base64.startsWith('data:')) {
      return isSafeUrl(base64) ? base64 : '';
    }
    const dataUrl = `data:image/png;base64,${base64}`;
    return isSafeUrl(dataUrl) ? dataUrl : '';
  }, [base64]);

  return (
    <div
      className={cn(
        'relative group aspect-square bg-zinc-900/50 border border-zinc-700/30 rounded overflow-hidden',
        onClick && 'cursor-pointer hover:border-[#52ddeb]/50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {hasError ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
          <ImageIcon size={16} className="text-zinc-600" />
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={`Image ${index + 1}`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}

      {/* Bullet indicator */}
      <div className="absolute top-1 left-1 w-5 h-5 bg-[#52ddeb] border border-black rounded-md flex items-center justify-center z-10">
        <span className="text-[10px] font-mono font-bold text-black">{index + 1}</span>
      </div>

      {/* Remove button (if provided) */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 border border-black rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Remove"
        >
          <X size={10} className="text-white" strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

interface ImageThumbnailListProps {
  images: string[];
  onImageClick?: (index: number) => void;
  onImageRemove?: (index: number) => void;
  className?: string;
  maxThumbnails?: number;
}

export const ImageThumbnailList: React.FC<ImageThumbnailListProps> = ({
  images,
  onImageClick,
  onImageRemove,
  className,
  maxThumbnails = 3,
}) => {
  const displayImages = images.slice(0, maxThumbnails);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex gap-2', className)}>
      {displayImages.map((base64, index) => {
        // Skip null/undefined/empty images
        if (!base64 || typeof base64 !== 'string') {
          return null;
        }
        return (
          <ImageThumbnail
            key={index}
            base64={base64}
            index={index}
            onClick={() => onImageClick?.(index)}
            onRemove={onImageRemove ? () => onImageRemove(index) : undefined}
            className="w-16 h-16"
          />
        );
      })}
      {images.length > maxThumbnails && (
        <div className="w-16 h-16 flex items-center justify-center bg-zinc-900/50 border border-zinc-700/30 rounded">
          <span className="text-xs font-mono text-zinc-500">+{images.length - maxThumbnails}</span>
        </div>
      )}
    </div>
  );
};

