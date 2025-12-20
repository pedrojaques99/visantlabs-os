import React from 'react';
import { Heart, Download, Maximize2, Copy, Wand2, X, Trash2, Copy as CopyIcon, FileText, Upload, ExternalLink } from 'lucide-react';

interface ImageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onLike: () => void;
  onDownload: () => void;
  onFullscreen: () => void;
  onCopy: () => void;
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
  onEditWithPrompt,
  onDelete,
  onDuplicate,
  onDescribe,
  onExport,
  imageUrl,
  isLiked,
}) => {
  // Improved download handler - ensures proper download behavior
  const handleDownload = () => {
    try {
      onDownload();
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: try to download directly if handler fails
      if (imageUrl) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `image-${Date.now()}.png`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
    onClose();
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
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Heart size={14} className={isLiked ? "fill-current text-[#52ddeb]" : ""} />
        {isLiked ? 'Unlike' : 'Like'}
      </button>
      
      <button
        onClick={handleDownload}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Download size={14} />
        Download
      </button>
      
      {onExport && (
        <button
          onClick={() => {
            onExport();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
        >
          <Upload size={14} />
          Export
        </button>
      )}
      
      <button
        onClick={handleFullscreen}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
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
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
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
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
      >
        <Copy size={14} />
        Copy
      </button>
      
      {onDescribe && (
        <button
          onClick={() => {
            onDescribe();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
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
          className="w-full px-3 py-2 text-left text-sm text-[#52ddeb] hover:bg-[#52ddeb]/10 transition-colors flex items-center gap-2 font-mono font-semibold cursor-pointer"
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
          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-[#52ddeb] transition-colors flex items-center gap-2 font-mono cursor-pointer"
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
