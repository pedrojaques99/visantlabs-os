import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Heart, Download, Maximize2, Copy, Diamond, X, Trash2, Copy as CopyIcon, FileText, Upload, ExternalLink } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { cn } from '@/lib/utils';
import { downloadImage } from '@/utils/imageUtils';
import { Button } from '@/components/ui/button';

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

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
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

  const handleFullscreen = () => {
    try {
      onFullscreen();
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
    onClose();
  };

  return (
    <DropdownMenu.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DropdownMenu.Trigger
        style={{ position: 'fixed', left: x, top: y, width: 0, height: 0, border: 'none', background: 'transparent', padding: 0 }}
        aria-hidden
      />
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-context-menu
          className="fixed z-50 bg-neutral-950/70 backdrop-blur-xl border-node border-neutral-800/50 rounded-md shadow-2xl min-w-[200px] flex flex-col overflow-hidden transition-all duration-200 ease-out"
          sideOffset={0}
          onInteractOutside={() => onClose()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2.5 border-b border-neutral-800/30 flex items-center justify-between sticky top-0 bg-neutral-950/70 backdrop-blur-xl z-10 rounded-t-2xl">
            <span className="text-xs font-semibold text-neutral-300 uppercase">Image Actions</span>
            <Button variant="ghost" onClick={onClose}
              className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors duration-150 cursor-pointer"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent flex-1">

            <DropdownMenu.Item
              onSelect={() => { onLike(); onClose(); }}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Heart size={16} className={cn("text-neutral-400 flex-shrink-0", isLiked && "fill-current text-brand-cyan")} />
              <span className="font-medium text-[11px] tracking-wide flex-1 text-left">{isLiked ? 'Unlike' : 'Like'}</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={handleDownload}
              disabled={isDownloading}
              className={cn(
                "w-full px-2 py-1.5 text-left text-sm text-neutral-400 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none",
                isDownloading ? "cursor-not-allowed opacity-50" : "hover:bg-neutral-800/50 hover:text-neutral-200"
              )}
            >
              {isDownloading ? <GlitchLoader size={16} /> : <Download size={16} className="text-neutral-400 flex-shrink-0" />}
              <span className="font-medium text-[11px] tracking-wide flex-1 text-left">{isDownloading ? 'Downloading...' : 'Download'}</span>
            </DropdownMenu.Item>

            {onExport && (
              <DropdownMenu.Item
                onSelect={() => { onExport(); onClose(); }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <Upload size={16} className="text-neutral-400 flex-shrink-0" />
                <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Export</span>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Item
              onSelect={handleFullscreen}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Maximize2 size={16} className="text-neutral-400 flex-shrink-0" />
              <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Fullscreen</span>
            </DropdownMenu.Item>

            {imageUrl && (
              <DropdownMenu.Item
                onSelect={() => { window.open(imageUrl, '_blank', 'noopener,noreferrer'); onClose(); }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <ExternalLink size={16} className="text-neutral-400 flex-shrink-0" />
                <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Open in New Tab</span>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Item
              onSelect={() => { onCopy(); onClose(); }}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Copy size={16} className="text-neutral-400 flex-shrink-0" />
              <div className="flex-1 flex items-center justify-between gap-4">
                <span className="font-medium text-[11px] tracking-wide text-left">Copy</span>
                <span className="text-[10px] text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded flex-shrink-0">Ctrl+C</span>
              </div>
            </DropdownMenu.Item>

            {onCopyPNG && (
              <DropdownMenu.Item
                onSelect={() => { onCopyPNG(); onClose(); }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <CopyIcon size={16} className="text-neutral-400 flex-shrink-0" />
                <div className="flex-1 flex items-center justify-between gap-4">
                  <span className="font-medium text-[11px] tracking-wide text-left">Copy as PNG</span>
                  <span className="text-[10px] text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded flex-shrink-0">Ctrl+Shift+C</span>
                </div>
              </DropdownMenu.Item>
            )}

            {onDescribe && (
              <DropdownMenu.Item
                onSelect={() => { onDescribe(); onClose(); }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <FileText size={16} className="text-neutral-400 flex-shrink-0" />
                <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Describe Image</span>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Separator className="h-px bg-neutral-800/30 my-1.5" />

            <DropdownMenu.Item
              onSelect={() => { onEditWithPrompt(); onClose(); }}
              className="w-full px-2 py-1.5 text-left text-sm text-brand-cyan hover:bg-brand-cyan/10 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md font-semibold outline-none"
            >
              <Diamond size={16} className="text-brand-cyan flex-shrink-0" />
              <span className="text-[11px] tracking-wide flex-1 text-left">Edit with Prompt</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-neutral-800/30 my-1.5" />

            <DropdownMenu.Item
              onSelect={() => { onDuplicate(); onClose(); }}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <CopyIcon size={16} className="text-neutral-400 flex-shrink-0" />
              <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Duplicate</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => { onDelete(); onClose(); }}
              className="w-full px-2 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Trash2 size={16} className="text-red-400 flex-shrink-0" />
              <span className="font-medium text-[11px] tracking-wide flex-1 text-left">Delete</span>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
