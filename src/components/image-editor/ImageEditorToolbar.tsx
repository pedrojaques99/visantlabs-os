import React from 'react';
import {
  Square, Circle, Paintbrush, Eraser,
  Maximize, Scissors, ImageOff,
} from 'lucide-react';
import { useImageEditorStore, type EditorTool, type EditorAction } from '@/stores/imageEditorStore';
import { IMAGE_EDITOR } from '@/constants/imageEditorTokens';
import { cn } from '@/lib/utils';

const TOOLS: { id: EditorTool; icon: React.ElementType; label: string }[] = [
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'brush', icon: Paintbrush, label: 'Brush' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
];

const ACTIONS: { id: EditorAction; icon: React.ElementType; label: string }[] = [
  { id: 'inpaint', icon: Scissors, label: 'Inpaint' },
  { id: 'expand', icon: Maximize, label: 'Expand' },
  { id: 'remove-bg', icon: ImageOff, label: 'Remove BG' },
];

const Divider = () => <div className={IMAGE_EDITOR.toolbar.divider} />;

export const ImageEditorToolbar: React.FC = () => {
  const activeTool = useImageEditorStore((s) => s.activeTool);
  const activeAction = useImageEditorStore((s) => s.activeAction);
  const brushSize = useImageEditorStore((s) => s.brushSize);
  const isGenerating = useImageEditorStore((s) => s.isGenerating);
  const setActiveTool = useImageEditorStore((s) => s.setActiveTool);
  const setActiveAction = useImageEditorStore((s) => s.setActiveAction);
  const setBrushSize = useImageEditorStore((s) => s.setBrushSize);
  const clearMask = useImageEditorStore((s) => s.clearMask);
  const undoMask = useImageEditorStore((s) => s.undoMask);
  const maskOperations = useImageEditorStore((s) => s.maskOperations);

  return (
    <div className={cn(
      'flex items-center justify-center gap-1 px-3 py-1.5 mx-auto',
      IMAGE_EDITOR.toolbar.bg,
      IMAGE_EDITOR.toolbar.border,
      IMAGE_EDITOR.toolbar.radius,
      'mt-2 w-fit',
      isGenerating && 'opacity-50 pointer-events-none',
    )}>
      {/* Action tabs */}
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => setActiveAction(action.id)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
            activeAction === action.id
              ? IMAGE_EDITOR.toolbar.activeTool
              : IMAGE_EDITOR.toolbar.inactiveTool,
          )}
          title={action.label}
        >
          <action.icon size={14} />
          <span className="hidden sm:inline">{action.label}</span>
        </button>
      ))}

      <Divider />

      {/* Selection/painting tools (only for inpaint) */}
      {activeAction === 'inpaint' && (
        <>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                activeTool === tool.id
                  ? IMAGE_EDITOR.toolbar.activeTool
                  : IMAGE_EDITOR.toolbar.inactiveTool,
              )}
              title={tool.label}
            >
              <tool.icon size={16} />
            </button>
          ))}

          <Divider />

          {/* Brush size */}
          {(activeTool === 'brush' || activeTool === 'eraser') && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] text-neutral-500 font-mono w-4 text-right">
                {brushSize}
              </span>
              <input
                type="range"
                min={IMAGE_EDITOR.brush.minSize}
                max={IMAGE_EDITOR.brush.maxSize}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20 h-1 accent-brand-cyan bg-neutral-700 rounded-full appearance-none cursor-pointer"
              />
            </div>
          )}

          <Divider />

          {/* Undo / Clear */}
          <button
            onClick={undoMask}
            disabled={maskOperations.length === 0}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors',
              IMAGE_EDITOR.toolbar.inactiveTool,
              'disabled:opacity-30',
            )}
          >
            Undo
          </button>
          <button
            onClick={clearMask}
            disabled={maskOperations.length === 0}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors',
              IMAGE_EDITOR.toolbar.inactiveTool,
              'disabled:opacity-30',
            )}
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
};
