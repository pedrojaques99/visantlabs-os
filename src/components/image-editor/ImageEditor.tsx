import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useImageEditorStore, type EditorAction } from '@/stores/imageEditorStore';
import { IMAGE_EDITOR } from '@/constants/imageEditorTokens';
import { ImageEditorCanvas } from './ImageEditorCanvas';
import { ImageEditorToolbar } from './ImageEditorToolbar';
import { ImageEditorActionPanel } from './ImageEditorActionPanel';
import { GeneratingOverlay } from './GeneratingOverlay';

export interface ImageEditorResult {
  imageUrl: string;
  base64?: string;
  action: EditorAction;
  mode?: string;
}

export interface ImageEditorProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  initialAction?: EditorAction;
  onResult: (result: ImageEditorResult) => void;
  onClose: () => void;
  className?: string;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  imageUrl,
  imageWidth,
  imageHeight,
  initialAction = 'inpaint',
  onResult,
  onClose,
  className,
}) => {
  const { t } = useTranslation();
  const reset = useImageEditorStore((s) => s.reset);
  const setActiveAction = useImageEditorStore((s) => s.setActiveAction);
  const isGenerating = useImageEditorStore((s) => s.isGenerating);
  const resultUrl = useImageEditorStore((s) => s.resultUrl);
  const resultBase64 = useImageEditorStore((s) => s.resultBase64);
  const activeAction = useImageEditorStore((s) => s.activeAction);
  const activeMode = useImageEditorStore((s) => s.activeMode);
  const currentImageUrl = useImageEditorStore((s) => s.currentImageUrl);
  const pushHistory = useImageEditorStore((s) => s.pushHistory);
  const editHistory = useImageEditorStore((s) => s.editHistory);

  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    reset();
    setActiveAction(initialAction);
    useImageEditorStore.getState().setCurrentImageUrl(imageUrl);
    return () => reset();
  }, []);

  // Show result preview when resultUrl becomes non-null
  useEffect(() => {
    if (resultUrl) {
      setShowResult(true);
    }
  }, [resultUrl]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useImageEditorStore.getState().undoMask();
      }
    },
    [onClose, isGenerating]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const content = (
    <div className={cn('fixed inset-0 z-[9999] flex flex-col', IMAGE_EDITOR.canvas.bg, className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t('imageEditor.title')}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {imageWidth}×{imageHeight}
          </span>
          {editHistory.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t(editHistory.length > 1 ? 'imageEditor.editsApplied' : 'imageEditor.editApplied', {
                count: editHistory.length,
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editHistory.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                const finalUrl = currentImageUrl || imageUrl;
                onResult({
                  imageUrl: finalUrl,
                  action: activeAction,
                  mode: activeAction === 'inpaint' ? activeMode : undefined,
                });
              }}
              disabled={isGenerating}
              className="text-xs"
            >
              <Check size={14} />
              {t('common.done')}
            </Button>
          )}
          <button
            onClick={onClose}
            disabled={isGenerating}
            aria-label={t('common.close')}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <ImageEditorToolbar />

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <ImageEditorCanvas
          imageUrl={currentImageUrl || imageUrl}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
        <GeneratingOverlay />
      </div>

      {/* Action panel */}
      <ImageEditorActionPanel
        imageUrl={currentImageUrl || imageUrl}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
      />

      {/* Result preview overlay */}
      {showResult && resultUrl && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-popover/90 backdrop-blur-sm">
          <img
            src={resultUrl}
            alt={t('imageEditor.result')}
            className="max-w-[80%] max-h-[70vh] rounded-xl border border-border shadow-2xl"
          />
          <div className="flex items-center gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowResult(false);
                useImageEditorStore.getState().setResult(null);
              }}
            >
              {t('imageEditor.rejectRetry')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                // Push to history and continue editing with the new image
                pushHistory(resultUrl, activeAction);
                setShowResult(false);
              }}
            >
              {t('imageEditor.acceptApply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};
