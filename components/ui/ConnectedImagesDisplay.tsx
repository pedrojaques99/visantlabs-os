import React from 'react';
import { ImageThumbnail } from './ImageThumbnail';
import { cn } from '../../lib/utils';

interface ConnectedImagesDisplayProps {
  images: (string | undefined | null)[];
  label?: string;
  className?: string;
  maxThumbnails?: number;
  showLabel?: boolean;
  onImageClick?: (index: number) => void;
  onImageRemove?: (index: number) => void;
}

/**
 * Unified component for displaying connected image thumbnails in all node types.
 * Automatically handles undefined/null values and shows/hides based on image availability.
 */
export const ConnectedImagesDisplay: React.FC<ConnectedImagesDisplayProps> = ({
  images,
  label,
  className,
  maxThumbnails = 3,
  showLabel = true,
  onImageClick,
  onImageRemove,
}) => {
  // Filter out undefined, null, and empty strings
  const validImages = images.filter(
    (img): img is string => 
      img !== undefined && 
      img !== null && 
      typeof img === 'string' && 
      img.trim().length > 0
  );

  if (validImages.length === 0) {
    return null;
  }

  const displayImages = validImages.slice(0, maxThumbnails);

  return (
    <div className={cn('mb-3 space-y-2', className)}>
      {showLabel && label && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-2 h-2 bg-[#52ddeb] border border-black rounded-md" />
          <span className="text-xs font-mono text-zinc-500">{label}</span>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {displayImages.map((image, index) => (
          <div key={index} className="w-20 h-20">
            <ImageThumbnail
              base64={image}
              index={index}
              className="w-full h-full"
              onClick={onImageClick ? () => onImageClick(index) : undefined}
              onRemove={onImageRemove ? () => onImageRemove(index) : undefined}
            />
          </div>
        ))}
        {validImages.length > maxThumbnails && (
          <div className="w-20 h-20 flex items-center justify-center bg-zinc-900/50 border border-zinc-700/30 rounded">
            <span className="text-xs font-mono text-zinc-500">+{validImages.length - maxThumbnails}</span>
          </div>
        )}
      </div>
    </div>
  );
};

