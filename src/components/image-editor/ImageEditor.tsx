import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const reset = useImageEditorStore((s) => s.reset);
  const setActiveAction = useImageEditorStore((s) => s.setActiveAction);
  const isGenerating = useImageEditorStore((s) => s.isGenerating);

  useEffect(() => {
    reset();
    setActiveAction(initialAction);
    return () => reset();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isGenerating) {
      onClose();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      useImageEditorStore.getState().undoMask();
    }
  }, [onClose, isGenerating]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const content = (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col',
        IMAGE_EDITOR.canvas.bg,
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
            Image Editor
          </span>
          <span className="text-xs text-neutral-600">
            {imageWidth}×{imageHeight}
          </span>
        </div>
        <button
          onClick={onClose}
          disabled={isGenerating}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors disabled:opacity-30"
        >
          <X size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <ImageEditorToolbar />

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <ImageEditorCanvas
          imageUrl={imageUrl}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
        <GeneratingOverlay />
      </div>

      {/* Action panel */}
      <ImageEditorActionPanel
        imageUrl={imageUrl}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        onResult={onResult}
      />
    </div>
  );

  return createPortal(content, document.body);
};
