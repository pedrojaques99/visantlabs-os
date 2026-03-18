import React from 'react';
import { Heart, Download, Maximize2, Copy, Wand2, X, Trash2, Copy as CopyIcon, FileText, Upload, ExternalLink } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { cn } from '@/lib/utils';
import { downloadImage } from '@/utils/imageUtils';
import { Button } from '@/components/ui/button'

interface ImageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onLike: () => void;
  onDownload: () => void;
  onFullscreen: () => void;
  onCopy: () => void;
  onCopyPNG?: () => void;
  onEditWithPrompt: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDescribe?: () => void;
  onExport?: () => void;
  imageUrl?: string;
  isLiked: boolean;
}

export const ImageContextMenu: React.FC<ImageContextMenuProps> = ({
  x,
  y,
  onClose,
  onLike,
  onDownload,
  onFullscreen,
  onCopy,
  onCopyPNG,
  onEditWithPrompt,
  onDelete,
  onDuplicate,
  onDescribe,
  onExport,
  imageUrl,
  isLiked,
}) => {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({
    left: `${x}px`,
    top: `${y}px`,
  });
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Calculate menu position to avoid being cut off
  React.useLayoutEffect(() => {
    if (!menuRef.current) return;

    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    
    // Wait for menu to render to get its dimensions
    const timeoutId = setTimeout(() => {
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!menuRect) return;

      const menuHeight = menuRect.height;
      const menuWidth = menuRect.width;

      let finalX = x;
      let finalY = y;

      // Position logic: prefer rendering below x/y, but flip if no space
      const isBottomHalf = y > windowHeight / 2;

      if (isBottomHalf && y + menuHeight > windowHeight - 8) {
        // Position above mouse if in bottom half or if it would go off bottom
        finalY = y - menuHeight - 8;
        // Ensure menu doesn't go above viewport
        if (finalY < 8) {
          finalY = 8;
        }
      } else {
        // Position below mouse
        finalY = y + 8;
        // Ensure menu doesn't go below viewport
        if (finalY + menuHeight > windowHeight - 8) {
          finalY = windowHeight - menuHeight - 8;
        }
      }

      // Adjust horizontal position if menu goes off screen
      if (finalX + menuWidth > windowWidth - 8) {
        finalX = windowWidth - menuWidth - 8;
      }
      if (finalX < 8) {
        finalX = 8;
      }

      setMenuStyle({
        left: `${finalX}px`,
        top: `${finalY}px`,
        maxHeight: `${windowHeight - 16}px`
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [x, y]);

  // Improved download handler - ensures proper download behavior
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // If an external onDownload handler is provided, use it primarily
      if (onDownload) {
        await onDownload();
      } else if (imageUrl) {
        await downloadImage(imageUrl);
      }
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
      onClose();
    }
  };

  // Fullscreen handler - uses the original onFullscreen callback for in-app fullscreen
  const handleFullscreen = () => {
    try {
      onFullscreen();
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      data-context-menu
      className="fixed z-50 bg-neutral-950/70 backdrop-blur-xl border border-neutral-800/50 rounded-md shadow-2xl min-w-[200px] flex flex-col overflow-hidden transition-all duration-200 ease-out"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2.5 border-b border-neutral-800/30 flex items-center justify-between sticky top-0 bg-neutral-950/70 backdrop-blur-xl z-10 rounded-t-2xl">
        <span className="text-xs font-semibold text-neutral-300 uppercase ">Image Actions</span>
        <Button variant="ghost" onClick={onClose}
          className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors duration-150 cursor-pointer"
        >
          <X size={16} />
        </Button>
      </div>

      <div className="p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent flex-1">

        <Button variant="ghost" onClick={() => {
          onLike();
          onClose();
        }}
          className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
        >
          <Heart size={16} className={cn("text-neutral-400 flex-shrink-0", isLiked && "fill-current text-brand-cyan")} />
          <span className="font-medium text-[11px] tracking-wide flex-1 text-left">{isLiked ? 'Unlike' : 'Like'}</span>
        </Button>

        <Button variant="ghost" onClick={handleDownload}
          disabled={isDownloading}
          className={cn(
            "w-full px-2 py-1.5 text-left text-sm text-neutral-400 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md",
            isDownloading ? "cursor-not-allowed opacity-50" : "hover:bg-neutral-800/50 hover:text-neutral-200"
          )}
        >
          {isDownloading ? <GlitchLoader size={16} /> : <Download size={16} className="text-neutral-400 flex-shrink-0" />}
          <span className="font-medium text-[11px] tracking-wide flex-1 text-left">{isDownloading ? 'Downloading...' : 'Download'}</span>
        </Button>

        {onExport && (
          <Button variant="ghost" onClick={() => {
            onExport();
            onClose();
          }}
            className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
          >
            <Upload size={16} className="text-neutral-400 flex-shrink-0" />
            <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Export</span>
          </Button>
        )}

        <Button variant="ghost" onClick={handleFullscreen}
          className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
        >
          <Maximize2 size={16} className="text-neutral-400 flex-shrink-0" />
          <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Fullscreen</span>
        </Button>

        {imageUrl && (
          <Button variant="ghost" onClick={() => {
            window.open(imageUrl, '_blank', 'noopener,noreferrer');
            onClose();
          }}
            className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
          >
            <ExternalLink size={16} className="text-neutral-400 flex-shrink-0" />
            <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Open in New Tab</span>
          </Button>
        )}

        <Button variant="ghost" onClick={() => {
          onCopy();
          onClose();
        }}
          className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
        >
          <Copy size={16} className="text-neutral-400 flex-shrink-0" />
          <div className="flex-1 flex items-center justify-between gap-4">
            <span className="font-medium text-[11px] tracking-wide text-left">Copy</span>
            <span className="text-[10px] text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded flex-shrink-0">Ctrl+C</span>
          </div>
        </Button>

        {onCopyPNG && (
          <Button variant="ghost" onClick={() => {
            onCopyPNG();
            onClose();
          }}
            className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
          >
            <CopyIcon size={16} className="text-neutral-400 flex-shrink-0" />
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="font-medium text-[11px] tracking-wide text-left">Copy as PNG</span>
              <span className="text-[10px] text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded flex-shrink-0">Ctrl+Shift+C</span>
            </div>
          </Button>
        )}

        {onDescribe && (
          <Button variant="ghost" onClick={() => {
            onDescribe();
            onClose();
          }}
            className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
          >
            <FileText size={16} className="text-neutral-400 flex-shrink-0" />
            <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Describe Image</span>
          </Button>
        )}

        <div className="h-px bg-neutral-800/30 my-1.5" />

        <Button variant="ghost" onClick={() => {
          onEditWithPrompt();
          onClose();
        }}
          className="w-full px-2 py-1.5 text-left text-sm text-brand-cyan hover:bg-brand-cyan/10 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md font-semibold"
        >
          <Wand2 size={16} className="text-brand-cyan flex-shrink-0" />
          <span className="text-[11px] tracking-wide flex-1 text-left">Edit with Prompt</span>
        </Button>

        <div className="h-px bg-neutral-800/30 my-1.5" />

        <Button variant="ghost" onClick={() => {
          onDuplicate();
          onClose();
        }}
          className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
        >
          <CopyIcon size={16} className="text-neutral-400 flex-shrink-0" />
          <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Duplicate</span>
        </Button>
        <Button variant="ghost" onClick={() => {
          onDelete();
          onClose();
        }}
          className="w-full px-2 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md"
        >
          <Trash2 size={16} className="text-red-400 flex-shrink-0" />
          <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Delete</span>
        </Button>
      </div>
    </div>
  );
};
