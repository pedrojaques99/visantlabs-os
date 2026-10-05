import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Heart,
  Download,
  Maximize2,
  Copy,
  Diamond,
  X,
  Trash2,
  Copy as CopyIcon,
  FileText,
  Upload,
  ExternalLink,
  Scissors,
} from '@/lib/ui/icons';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { cn } from '@/lib/utils';
import { downloadImage } from '@/utils/imageUtils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

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
  onOpenImageEditor?: () => void;
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
  onOpenImageEditor,
  imageUrl,
  isLiked,
}) => {
  const { t } = useTranslation();
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
    <DropdownMenu.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenu.Trigger
        style={{
          position: 'fixed',
          left: x,
          top: y,
          width: 0,
          height: 0,
          border: 'none',
          background: 'transparent',
          padding: 0,
        }}
        aria-hidden
      />
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-context-menu
          className="fixed z-50 bg-neutral-950/70 backdrop-blur-xl border-node border-neutral-800/50 rounded-md shadow-2xl min-w-[200px] flex flex-col overflow-hidden transition-[color,background-color,border-color,box-shadow,filter] duration-200 ease-out"
          sideOffset={0}
          onInteractOutside={() => onClose()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2.5 border-b border-neutral-800/30 flex items-center justify-between sticky top-0 bg-neutral-950/70 backdrop-blur-xl z-10 rounded-t-2xl">
            <span className="text-xs font-semibold text-neutral-300">
              {t('canvasNodes.imageContextMenu.title')}
            </span>
            <Button
              variant="ghost"
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors duration-150 cursor-pointer"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent flex-1">
            <DropdownMenu.Item
              onSelect={() => {
                onLike();
                onClose();
              }}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Heart
                size={16}
                className={cn(
                  'text-neutral-400 flex-shrink-0',
                  isLiked && 'fill-current text-brand-cyan'
                )}
              />
              <span className="font-medium text-2xs flex-1 text-left">
                {isLiked
                  ? t('canvasNodes.imageContextMenu.unlike')
                  : t('canvasNodes.imageContextMenu.like')}
              </span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={handleDownload}
              disabled={isDownloading}
              className={cn(
                'w-full px-2 py-1.5 text-left text-sm text-neutral-400 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none',
                isDownloading
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-neutral-800/50 hover:text-neutral-200'
              )}
            >
              {isDownloading ? (
                <GlitchLoader size={16} />
              ) : (
                <Download size={16} className="text-neutral-400 flex-shrink-0" />
              )}
              <span className="font-medium text-2xs flex-1 text-left">
                {isDownloading ? t('canvasNodes.shared.downloading') : t('common.download')}
              </span>
            </DropdownMenu.Item>

            {onExport && (
              <DropdownMenu.Item
                onSelect={() => {
                  onExport();
                  onClose();
                }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <Upload size={16} className="text-neutral-400 flex-shrink-0" />
                <span className="font-medium text-2xs flex-1 text-left">{t('common.export')}</span>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Item
              onSelect={handleFullscreen}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Maximize2 size={16} className="text-neutral-400 flex-shrink-0" />
              <span className="font-medium text-2xs flex-1 text-left">
                {t('common.viewFullscreen')}
              </span>
            </DropdownMenu.Item>

            {imageUrl && (
              <DropdownMenu.Item
                onSelect={() => {
                  window.open(imageUrl, '_blank', 'noopener,noreferrer');
                  onClose();
                }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <ExternalLink size={16} className="text-neutral-400 flex-shrink-0" />
                <span className="font-medium text-2xs flex-1 text-left">
                  {t('canvasNodes.imageContextMenu.openInNewTab')}
                </span>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Item
              onSelect={() => {
                onCopy();
                onClose();
              }}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Copy size={16} className="text-neutral-400 flex-shrink-0" />
              <div className="flex-1 flex items-center justify-between gap-4">
                <span className="font-medium text-2xs text-left">
                  {t('canvasNodes.imageContextMenu.copy')}
                </span>
                <span className="text-2xs text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded flex-shrink-0">
                  Ctrl+C
                </span>
              </div>
            </DropdownMenu.Item>

            {onCopyPNG && (
              <DropdownMenu.Item
                onSelect={() => {
                  onCopyPNG();
                  onClose();
                }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <CopyIcon size={16} className="text-neutral-400 flex-shrink-0" />
                <div className="flex-1 flex items-center justify-between gap-4">
                  <span className="font-medium text-2xs text-left">{t('common.copyAsPng')}</span>
                  <span className="text-2xs text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded flex-shrink-0">
                    Ctrl+Shift+C
                  </span>
                </div>
              </DropdownMenu.Item>
            )}

            {onDescribe && (
              <DropdownMenu.Item
                onSelect={() => {
                  onDescribe();
                  onClose();
                }}
                className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
              >
                <FileText size={16} className="text-neutral-400 flex-shrink-0" />
                <span className="font-medium text-2xs flex-1 text-left">
                  {t('canvasNodes.imageNode.describeImageWithAI')}
                </span>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Separator className="h-px bg-neutral-800/30 my-1.5" />

            <DropdownMenu.Item
              onSelect={() => {
                onEditWithPrompt();
                onClose();
              }}
              className="w-full px-2 py-1.5 text-left text-sm text-foreground hover:bg-neutral-800/50 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md font-semibold outline-none"
            >
              <Diamond size={16} className="text-foreground flex-shrink-0" />
              <span className="text-2xs flex-1 text-left">
                {t('canvasNodes.imageContextMenu.editWithPrompt')}
              </span>
            </DropdownMenu.Item>

            {onOpenImageEditor && (
              <DropdownMenu.Item
                onSelect={() => {
                  onOpenImageEditor();
                  onClose();
                }}
                className="w-full px-2 py-1.5 text-left text-sm text-foreground hover:bg-neutral-800/50 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md font-semibold outline-none"
              >
                <Scissors size={16} className="text-foreground flex-shrink-0" />
                <span className="text-2xs flex-1 text-left">
                  {t('canvasNodes.imageContextMenu.openEditor')}
                </span>
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Separator className="h-px bg-neutral-800/30 my-1.5" />

            <DropdownMenu.Item
              onSelect={() => {
                onDuplicate();
                onClose();
              }}
              className="w-full px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <CopyIcon size={16} className="text-neutral-400 flex-shrink-0" />
              <span className="font-medium text-2xs flex-1 text-left">
                {t('canvasNodes.nodeContextMenu.duplicate')}
              </span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => {
                onDelete();
                onClose();
              }}
              className="w-full px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150 flex items-center justify-start gap-2 cursor-pointer rounded-md outline-none"
            >
              <Trash2 size={16} className="text-destructive flex-shrink-0" />
              <span className="font-medium text-2xs flex-1 text-left">{t('common.delete')}</span>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
