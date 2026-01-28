import React from 'react';
import { Heart, Download, Maximize2, Copy, Wand2, X, Trash2, Copy as CopyIcon, FileText, Upload, ExternalLink } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { cn } from '@/lib/utils';
import { downloadImage } from '@/utils/imageUtils';

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

  // Improved download handler - ensures proper download behavior
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // If an external onDownload handler is provided, use it primarily
      // This prevents duplicate downloads when the parent component already handles the download logic
      if (onDownload) {
        try {
          await onDownload();
        } catch (e) {
          console.error('onDownload callback error:', e);
        }
        return; // Exit early to avoid double download
      }

      // Fallback: Internal download logic if no onDownload handler is provided
      if (imageUrl) {
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
      data-context-menu
      className="fixed z-50 bg-neutral-950/70 backdrop-blur-xl border border-neutral-800/50 rounded-2xl shadow-2xl min-w-[180px] max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2.5 border-b border-neutral-800/30 flex items-center justify-between sticky top-0 bg-neutral-950/70 backdrop-blur-xl z-10 rounded-t-2xl">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Image Actions</span>
        <button
          onClick={onClose}
          className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors duration-150 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-2">

        <button
          onClick={() => {
            onLike();
            onClose();
          }}
          className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
        >
          <Heart size={16} className={cn("text-neutral-400", isLiked && "fill-current text-brand-cyan")} />
          <span className="font-medium text-[11px] tracking-wide">{isLiked ? 'Unlike' : 'Like'}</span>
        </button>

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={cn(
            "w-full px-3 py-2.5 text-left text-sm text-neutral-400 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md",
            isDownloading ? "cursor-not-allowed opacity-50" : "hover:bg-neutral-800/50 hover:text-neutral-200"
          )}
        >
          {isDownloading ? <GlitchLoader size={16} /> : <Download size={16} className="text-neutral-400" />}
          <span className="font-medium text-[11px] tracking-wide">{isDownloading ? 'Downloading...' : 'Download'}</span>
        </button>

        {onExport && (
          <button
            onClick={() => {
              onExport();
              onClose();
            }}
            className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
          >
            <Upload size={16} className="text-neutral-400" />
            <span className="font-medium text-[11px] tracking-wide">Export</span>
          </button>
        )}

        <button
          onClick={handleFullscreen}
          className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
        >
          <Maximize2 size={16} className="text-neutral-400" />
          <span className="font-medium text-[11px] tracking-wide">Fullscreen</span>
        </button>

        {imageUrl && (
          <button
            onClick={() => {
              window.open(imageUrl, '_blank', 'noopener,noreferrer');
              onClose();
            }}
            className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
          >
            <ExternalLink size={16} className="text-neutral-400" />
            <span className="font-medium text-[11px] tracking-wide">Open in New Tab</span>
          </button>
        )}

        <button
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
        >
          <Copy size={16} className="text-neutral-400" />
          <div className="flex-1 flex items-center justify-between gap-4">
            <span className="font-medium text-[11px] tracking-wide">Copy</span>
            <span className="text-[10px] text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded">Ctrl+C</span>
          </div>
        </button>

        {onCopyPNG && (
          <button
            onClick={() => {
              onCopyPNG();
              onClose();
            }}
            className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
          >
            <CopyIcon size={16} className="text-neutral-400" />
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="font-medium text-[11px] tracking-wide">Copy as PNG</span>
              <span className="text-[10px] text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded">Ctrl+Shift+C</span>
            </div>
          </button>
        )}

        {onDescribe && (
          <button
            onClick={() => {
              onDescribe();
              onClose();
            }}
            className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
          >
            <FileText size={16} className="text-neutral-400" />
            <span className="font-medium text-[11px] tracking-wide">Describe Image</span>
          </button>
        )}

        <div className="h-px bg-neutral-800/30 my-1.5" />

        <button
          onClick={() => {
            onEditWithPrompt();
            onClose();
          }}
          className="w-full px-3 py-2.5 text-left text-sm text-brand-cyan hover:bg-brand-cyan/10 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md font-semibold"
        >
          <Wand2 size={16} className="text-brand-cyan" />
          <span className="text-[11px] tracking-wide">Edit with Prompt</span>
        </button>

        <div className="h-px bg-neutral-800/30 my-1.5" />

        <button
          onClick={() => {
            onDuplicate();
            onClose();
          }}
          className="w-full px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
        >
          <CopyIcon size={16} className="text-neutral-400" />
          <span className="font-medium text-[11px] tracking-wide">Duplicate</span>
        </button>
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-150 flex items-center gap-3 cursor-pointer rounded-md"
        >
          <Trash2 size={16} className="text-red-400" />
          <span className="font-medium text-[11px] tracking-wide">Delete</span>
        </button>
      </div>
    </div>
  );
};
