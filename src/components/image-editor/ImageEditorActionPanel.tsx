import React from 'react';
import { Zap } from 'lucide-react';
import { useImageEditorStore, type InpaintMode } from '@/stores/imageEditorStore';
import { useImageEditorActions } from '@/hooks/image-editor/useImageEditorActions';
import { IMAGE_EDITOR } from '@/constants/imageEditorTokens';
import { cn } from '@/lib/utils';
const MODES: { id: InpaintMode; label: string; desc: string }[] = [
  { id: 'replace', label: 'Replace', desc: 'Fill with new content' },
  { id: 'remove', label: 'Remove', desc: 'Erase and fill background' },
  { id: 'retouch', label: 'Retouch', desc: 'Subtle improvements' },
];

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

export const ImageEditorActionPanel: React.FC<Props> = ({
  imageUrl,
  imageWidth,
  imageHeight,
}) => {
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

  const hasExpansion = expandEdges.top > 0 || expandEdges.right > 0
    || expandEdges.bottom > 0 || expandEdges.left > 0;

  const canGenerate =
    (activeAction === 'inpaint' && maskOperations.length > 0 && (activeMode !== 'replace' || prompt.trim().length > 0))
    || (activeAction === 'expand' && hasExpansion)
    || activeAction === 'remove-bg';

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 border-t border-white/10',
      IMAGE_EDITOR.toolbar.bg,
    )}>
      {/* Inpaint mode selector */}
      {activeAction === 'inpaint' && (
        <div className="flex items-center gap-1">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              disabled={isGenerating}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
                activeMode === mode.id
                  ? IMAGE_EDITOR.toolbar.activeTool
                  : IMAGE_EDITOR.toolbar.inactiveTool,
              )}
              title={mode.desc}
            >
              {mode.label}
            </button>
          ))}
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
              ? activeMode === 'replace' ? 'Describe what to generate...' : 'Optional context...'
              : 'Optional: describe what to generate in expanded area...'
          }
          disabled={isGenerating}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg text-sm bg-neutral-800/50 border border-white/10',
            'text-white placeholder-neutral-500 outline-none',
            'focus:border-brand-cyan/40 transition-colors',
            'disabled:opacity-50',
          )}
        />
      )}

      {/* Remove BG info */}
      {activeAction === 'remove-bg' && (
        <span className="flex-1 text-xs text-neutral-400 font-mono">
          One-click AI background removal (rembg U2-Net)
        </span>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || isGenerating}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
          'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30',
          'hover:bg-brand-cyan/30 hover:border-brand-cyan/50',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          isGenerating && 'animate-pulse',
        )}
      >
        <Zap size={14} />
        {isGenerating ? 'Generating...' : 'Generate'}
      </button>
    </div>
  );
};
