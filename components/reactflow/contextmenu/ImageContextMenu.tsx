import React from 'react';
import { Heart, Download, Maximize2, Copy, Wand2, X, Trash2, Copy as CopyIcon, FileText, Upload, ExternalLink } from 'lucide-react';
import { GlitchLoader } from '../../ui/GlitchLoader';
import { cn } from '../../../lib/utils';

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
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);

          // Determine extension from content-type or url
          let extension = '.png';
          const contentType = response.headers.get('content-type');
          if (contentType) {
            if (contentType.includes('video/mp4')) extension = '.mp4';
            else if (contentType.includes('image/jpeg')) extension = '.jpg';
            else if (contentType.includes('image/webp')) extension = '.webp';
            else if (contentType.includes('image/gif')) extension = '.gif';
            else if (contentType.includes('image/png')) extension = '.png';
          } else {
            // Fallback to URL extension
            const urlExt = imageUrl.split('.').pop()?.split('?')[0];
            if (urlExt && ['mp4', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt.toLowerCase())) {
              extension = `.${urlExt}`;
            }
          }

          const link = document.createElement('a');
          link.href = url;
          link.download = `image-${Date.now()}${extension}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (fetchError) {
          console.error('Fetch download failed, falling back to direct link:', fetchError);
          // Fallback: try to download directly if fetch fails
          const link = document.createElement('a');
          link.href = imageUrl;

          // Attempt to guess extension for fallback
          let extension = '.png';
          const urlExt = imageUrl.split('.').pop()?.split('?')[0];
          if (urlExt && ['mp4', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt.toLowerCase())) {
            extension = `.${urlExt}`;
          }

          link.download = `image-${Date.now()}${extension}`;
          // link.target = '_blank'; // Removed to avoid opening in new tab if possible
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }

      // Execute the provided onDownload callback if it exists, for any additional side effects
      // We wrap it in a try-catch to ensure it doesn't break the flow if it fails
      try {
        if (onDownload) onDownload();
      } catch (e) {
        console.error('onDownload callback error:', e);
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
      className="fixed z-50 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-lg shadow-2xl min-w-[180px] max-h-[80vh] overflow-y-auto"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1.5 border-b border-zinc-700/30 flex items-center justify-between sticky top-0 bg-zinc-900/95 backdrop-blur-md z-10">
        <span className="text-xs font-mono text-zinc-400 uppercase">Image Actions</span>
        <button
          onClick={onClose}
          className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <button
        onClick={() => {
          onLike();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Heart size={14} className={isLiked ? "fill-current text-brand-cyan" : ""} />
        {isLiked ? 'Unlike' : 'Like'}
      </button>

      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className={cn(
          "w-full px-3 py-2 text-left text-sm text-zinc-300 transition-colors flex items-center gap-2 font-mono cursor-pointer",
          isDownloading ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-800/50 hover:text-brand-cyan"
        )}
      >
        {isDownloading ? <GlitchLoader size={14} /> : <Download size={14} />}
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>

      {onExport && (
        <button
          onClick={() => {
            onExport();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
        >
          <Upload size={14} />
          Export
        </button>
      )}

      <button
        onClick={handleFullscreen}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Maximize2 size={14} />
        Fullscreen
      </button>

      {imageUrl && (
        <button
          onClick={() => {
            window.open(imageUrl, '_blank', 'noopener,noreferrer');
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
        >
          <ExternalLink size={14} />
          Open in New Tab
        </button>
      )}

      <button
        onClick={() => {
          onCopy();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Copy size={14} />
        <div className="flex-1 flex items-center justify-between gap-4">
          <span>Copy</span>
          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1 rounded">Ctrl+C</span>
        </div>
      </button>

      {onCopyPNG && (
        <button
          onClick={() => {
            onCopyPNG();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
        >
          <CopyIcon size={14} />
          <div className="flex-1 flex items-center justify-between gap-4">
            <span>Copy as PNG</span>
            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1 rounded">Ctrl+Shift+C</span>
          </div>
        </button>
      )}

      {onDescribe && (
        <button
          onClick={() => {
            onDescribe();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
        >
          <FileText size={14} />
          Describe Image
        </button>
      )}

      <div className="px-2 py-1.5 border-t border-zinc-700/30 mt-1">
        <button
          onClick={() => {
            onEditWithPrompt();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-brand-cyan hover:bg-brand-cyan/10 transition-colors flex items-center gap-2 font-mono font-semibold cursor-pointer"
        >
          <Wand2 size={14} />
          Edit with Prompt
        </button>
      </div>

      <div className="px-2 py-1.5 border-t border-zinc-700/30 mt-1">
        <button
          onClick={() => {
            onDuplicate();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-brand-cyan transition-colors flex items-center gap-2 font-mono cursor-pointer"
        >
          <CopyIcon size={14} />
          Duplicate
        </button>
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 font-mono cursor-pointer"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
};
