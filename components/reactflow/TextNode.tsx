import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import { FileText, Wand2, Type, Sparkles, Copy, Check } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { TextNodeData } from '../../types/reactFlow';
import { Textarea } from '../ui/textarea';
import { NodeContainer } from './shared/NodeContainer';
import { useTranslation } from '../../hooks/useTranslation';
import { aiApi } from '../../services/aiApi';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useNodeResize } from '../../hooks/canvas/useNodeResize';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TextNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const nodeData = data as TextNodeData;
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const [text, setText] = useState(nodeData.text || '');
  const [isImproving, setIsImproving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync text with data
  useEffect(() => {
    if (nodeData.text !== undefined) {
      setText(nodeData.text);
    }
  }, [nodeData.text]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = 100;
      const maxHeight = 400;
      textareaRef.current.style.height = `${Math.max(minHeight, Math.min(scrollHeight, maxHeight))}px`;
    }
  }, [text]);

  // Debounced update for data changes
  const debouncedUpdateData = useDebouncedCallback((updates: Partial<TextNodeData>) => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, updates);
    }
  }, 500);

  const handleTextChange = (value: string) => {
    setText(value);
    debouncedUpdateData({ text: value });
  };

  const handleImprovePrompt = async () => {
    if (!text.trim() || isImproving) return;

    setIsImproving(true);
    try {
      const improvedText = await aiApi.improvePrompt(text);
      setText(improvedText);
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, { text: improvedText });
      }
      toast.success(t('canvasNodes.textNode.promptImproved') || 'Prompt improved!');
    } catch (error: any) {
      console.error('Error improving prompt:', error);
      toast.error(
        error?.message || t('canvasNodes.textNode.errorImprovingPrompt') || 'Failed to improve prompt'
      );
    } finally {
      setIsImproving(false);
    }
  };

  const handleCopyText = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success(t('canvasNodes.textNode.copied') || 'Text copied!', { duration: 2000 });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error(t('canvasNodes.textNode.copyFailed') || 'Failed to copy text');
    }
  };

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    const onResize = typeof nodeData.onResize === 'function'
      ? nodeData.onResize as (nodeId: string, width: number, height: number) => void
      : undefined;
    handleResizeWithDebounce(id, width, height, onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    // For text nodes, we set height to auto to let it grow/shrink based on content
    fitToContent(id, 'auto', 'auto', nodeData.onResize as any);
  }, [id, nodeData.onResize, fitToContent]);

  // Character count with visual feedback
  const charCount = text.length;
  const isLongText = charCount > 500;
  const isVeryLongText = charCount > 1000;

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="p-0 min-w-[320px] overflow-hidden"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#brand-cyan"
          isVisible={selected}
          minWidth={280}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}

      {/* Enhanced Header with Glassmorphism */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700/30 bg-gradient-to-r from-zinc-900/60 to-zinc-900/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 shadow-sm">
            <Type size={16} className="text-brand-cyan" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200 font-mono tracking-tight uppercase">
            {t('canvasNodes.textNode.title') || 'Text Node'}
          </h3>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5">
          {/* Copy Button */}
          {text.trim() && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "p-2 rounded-md border transition-all nodrag",
                "bg-zinc-900/60 border-zinc-700/40 text-zinc-400",
                "hover:bg-zinc-800/70 hover:border-zinc-600/60 hover:text-zinc-200",
                "backdrop-blur-sm shadow-sm hover:shadow-md",
                "hover:scale-105 active:scale-95"
              )}
              title={t('canvasNodes.textNode.copy') || 'Copy text'}
            >
              {isCopied ? (
                <Check size={14} className="text-brand-cyan" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Text Input Area */}
      <div className="p-4">
        <div className="relative group">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              e.stopPropagation();
              handleTextChange(e.target.value);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder={t('canvasNodes.textNode.placeholder') || 'Enter text...'}
            className={cn(
              "min-h-[100px] max-h-[400px] resize-y w-full nodrag nopan text-xs",
              "pr-12 pb-8",
              "bg-zinc-900/60 border-zinc-700/40",
              "focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20",
              "backdrop-blur-sm transition-all duration-200",
              "placeholder:text-zinc-500 placeholder:font-mono"
            )}
            style={{
              overflowY: textareaRef.current && textareaRef.current.scrollHeight > 400 ? 'auto' : 'hidden',
            }}
          />

          {/* Improve Prompt Button - Enhanced */}
          {text.trim() && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleImprovePrompt();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isImproving || !text.trim()}
              className={cn(
                "absolute top-2 right-2 p-2 rounded-md transition-all node-interactive",
                "shadow-sm hover:shadow-md",
                "hover:scale-105 active:scale-95",
                isImproving || !text.trim()
                  ? "bg-zinc-800/50 text-zinc-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-brand-cyan/20 to-brand-cyan/10 hover:from-brand-cyan/30 hover:to-brand-cyan/20 text-brand-cyan border border-[#brand-cyan]/30 hover:border-[#brand-cyan]/50"
              )}
              title={isImproving
                ? (t('canvasNodes.textNode.improvingPrompt') || 'Improving prompt...')
                : (t('canvasNodes.textNode.improvePrompt') || 'Improve with AI')}
            >
              {isImproving ? (
                <GlitchLoader size={14} color="currentColor" />
              ) : (
                <Wand2 size={14} strokeWidth={2} className="animate-pulse" />
              )}
            </button>
          )}

          {/* Character Counter - Bottom Right */}
          <div className={cn(
            "absolute bottom-2 right-2 text-[10px] font-mono transition-all duration-200",
            "px-2 py-0.5 rounded-full backdrop-blur-sm",
            isVeryLongText
              ? "text-amber-400 bg-amber-400/10 border border-amber-400/20"
              : isLongText
                ? "text-zinc-400 bg-zinc-800/50"
                : "text-zinc-500 bg-zinc-800/30"
          )}>
            {charCount.toLocaleString()} {t('canvasNodes.textNode.characters') || 'chars'}
          </div>
        </div>

        {/* AI Enhancement Hint */}
        {text.trim() && !isImproving && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500 font-mono animate-in fade-in duration-300">
            <Sparkles size={10} className="text-brand-cyan/70" />
            <span>{t('canvasNodes.textNode.aiHint') || 'Click the wand to enhance with AI'}</span>
          </div>
        )}
      </div>

      {/* Output Handle - Enhanced styling */}
      <Handle
        type="source"
        position={Position.Right}
        className="node-handle handle-text !w-3 !h-3 !bg-brand-cyan/80 !border-brand-cyan/40 hover:!bg-brand-cyan hover:!border-brand-cyan/60 transition-all"
        data-handle-type="text"
      />
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render if text changes
  const prevData = prevProps.data as TextNodeData;
  const nextData = nextProps.data as TextNodeData;

  if (prevData.text !== nextData.text ||
    prevProps.selected !== nextProps.selected ||
    prevProps.dragging !== nextProps.dragging) {
    return false; // Re-render
  }

  return true; // Skip re-render
});

