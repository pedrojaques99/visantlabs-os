import React from 'react';
import { Zap } from '@/lib/ui/icons';
import { useImageEditorStore, type InpaintMode } from '@/stores/imageEditorStore';
import { useImageEditorActions } from '@/hooks/image-editor/useImageEditorActions';
import { IMAGE_EDITOR } from '@/constants/imageEditorTokens';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
// label/desc em imageEditor.modes.<id>.*
const MODES: InpaintMode[] = ['replace', 'remove', 'retouch'];

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

export const ImageEditorActionPanel: React.FC<Props> = ({ imageUrl, imageWidth, imageHeight }) => {
  const { t } = useTranslation();
  const activeAction = useImageEditorStore((s) => s.activeAction);
  const activeMode = useImageEditorStore((s) => s.activeMode);
  const prompt = useImageEditorStore((s) => s.prompt);
  const isGenerating = useImageEditorStore((s) => s.isGenerating);
  const maskOperations = useImageEditorStore((s) => s.maskOperations);
  const expandEdges = useImageEditorStore((s) => s.expandEdges);
  const setActiveMode = useImageEditorStore((s) => s.setActiveMode);
  const setPrompt = useImageEditorStore((s) => s.setPrompt);

  const { handleGenerate } = useImageEditorActions({
    imageUrl,
    imageWidth,
    imageHeight,
  });

  const hasExpansion =
    expandEdges.top > 0 || expandEdges.right > 0 || expandEdges.bottom > 0 || expandEdges.left > 0;

  const canGenerate =
    (activeAction === 'inpaint' &&
      maskOperations.length > 0 &&
      (activeMode !== 'replace' || prompt.trim().length > 0)) ||
    (activeAction === 'expand' && hasExpansion) ||
    activeAction === 'remove-bg';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-t border-border',
        IMAGE_EDITOR.toolbar.bg
      )}
    >
      {/* Inpaint mode selector */}
      {activeAction === 'inpaint' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            {MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                disabled={isGenerating}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-xs font-medium transition-colors',
                  activeMode === mode
                    ? IMAGE_EDITOR.toolbar.activeTool
                    : IMAGE_EDITOR.toolbar.inactiveTool
                )}
              >
                {t(`imageEditor.modes.${mode}.label`)}
              </button>
            ))}
          </div>
          <span className="text-2xs text-muted-foreground pl-0.5">
            {t(`imageEditor.modes.${activeMode}.desc`)}
          </span>
        </div>
      )}

      {/* Prompt input */}
      {activeAction !== 'remove-bg' && (
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canGenerate && !isGenerating) {
              handleGenerate();
            }
          }}
          placeholder={
            activeAction === 'inpaint'
              ? activeMode === 'replace'
                ? t('imageEditor.promptReplace')
                : t('imageEditor.promptOptional')
              : t('imageEditor.promptExpand')
          }
          disabled={isGenerating}
          className={cn(
            'flex-1 px-3 py-2 rounded-xl text-sm bg-muted border border-border',
            'text-foreground placeholder:text-muted-foreground outline-none',
            'focus:border-ring transition-colors',
            'disabled:opacity-50'
          )}
        />
      )}

      {/* Remove BG info */}
      {activeAction === 'remove-bg' && (
        <span className="flex-1 text-xs text-muted-foreground">
          {t('imageEditor.removeBgInfo')}
        </span>
      )}

      {/* Generate button */}
      <Button
        type="button"
        variant="primary"
        onClick={handleGenerate}
        disabled={!canGenerate || isGenerating}
        className={cn(isGenerating && 'animate-pulse')}
      >
        <Zap size={14} />
        {isGenerating ? t('imageEditor.generating') : t('imageEditor.generate')}
      </Button>
    </div>
  );
};
