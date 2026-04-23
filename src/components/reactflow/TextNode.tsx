import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import { Diamond, Type, Copy, Check } from 'lucide-react';
import { NodeHeader } from './shared/node-header';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { TextNodeData } from '@/types/reactFlow';
import { Textarea } from '@/components/ui/textarea';
import { NodeContainer } from './shared/NodeContainer';
import { useTranslation } from '@/hooks/useTranslation';
import { aiApi } from '@/services/aiApi';
import { useNodeDataUpdater } from '@/hooks/canvas/useNodeDataUpdater';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeButton } from './shared/node-button'
import { NODE_LAYOUT } from '@/constants/nodeLayout';
import { useBaseNode } from '@/hooks/canvas/useBaseNode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TextNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const nodeData = data as TextNodeData;
  const { handleResize: baseResize, handleFitToContent: baseFitToContent } = useBaseNode(id, nodeData);
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



  const { debouncedUpdate: debouncedUpdateData } = useNodeDataUpdater<TextNodeData>(nodeData.onUpdateData, id);

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

  // Handle resize from NodeResizer
  const handleResize = useCallback((width: number, height: number) => {
    baseResize(width, height);
  }, [baseResize]);

  const handleFitToContent = useCallback(() => {
    baseFitToContent();
  }, [baseFitToContent]);

  // Character count with visual feedback
  const charCount = text.length;
  const isLongText = charCount > 500;
  const isVeryLongText = charCount > 1000;

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className={cn(
        "flex flex-col overflow-hidden",
        `min-w-[${NODE_LAYOUT.MIN_WIDTH}px]`,
        `min-h-[${NODE_LAYOUT.MIN_HEIGHT}px]`,
        "h-auto"
      )}
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={NODE_LAYOUT.MIN_WIDTH}
          minHeight={NODE_LAYOUT.MIN_HEIGHT}
          maxWidth={NODE_LAYOUT.MAX_WIDTH}
          maxHeight={NODE_LAYOUT.MAX_HEIGHT}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}

      <NodeHeader icon={Type} title={t('canvasNodes.textNode.title') || 'Text Node'} selected={selected}>
        {text.trim() && (
          <NodeButton
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); handleCopyText(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag"
            title={t('canvasNodes.textNode.copy') || 'Copy text'}
          >
            {isCopied ? <Check size={14} className="text-brand-cyan" /> : <Copy size={14} />}
          </NodeButton>
        )}
      </NodeHeader>

      {/* Text Input Area */}
      <div className="node-margin flex-1 flex flex-col overflow-hidden">
        <div className="relative group flex-1 overflow-hidden">
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
              "h-full w-full resize-none nodrag nopan text-xs",
              "pr-12 pb-8",
              "bg-neutral-900/60 border-neutral-700/40",
              "focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20",
              "backdrop-blur-sm transition-all duration-200",
              "placeholder:text-neutral-500 placeholder:font-mono",
              "overflow-y-auto"
            )}
          />

          {/* Improve Prompt Button - Enhanced */}
          {text.trim() && (
            <NodeButton
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleImprovePrompt();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isImproving || !text.trim()}
              className={cn(
                "absolute top-2 right-2 transition-all nodrag shadow-sm backdrop-blur-sm",
                !isImproving && text.trim() && "text-brand-cyan border-brand-cyan/30 bg-brand-cyan/5 hover:bg-brand-cyan/10"
              )}
              title={isImproving
                ? (t('canvasNodes.textNode.improvingPrompt') || 'Improving prompt...')
                : (t('canvasNodes.textNode.improvePrompt') || 'Improve with AI')}
            >
              {isImproving ? (
                <GlitchLoader size={14} color="currentColor" />
              ) : (
                <Diamond size={14} strokeWidth={2} />
              )}
            </NodeButton>
          )}

          {/* Character Counter - Bottom Right */}
          <div className={cn(
            "absolute bottom-2 right-2 text-[10px] font-mono transition-all duration-200",
            "px-2 py-0.5 rounded-full backdrop-blur-sm",
            isVeryLongText
              ? "text-amber-400 bg-amber-400/10 border-node border-amber-400/20"
              : isLongText
                ? "text-neutral-400 bg-neutral-800/50"
                : "text-neutral-500 bg-neutral-800/30"
          )}>
            {charCount.toLocaleString()} {t('canvasNodes.textNode.characters') || 'chars'}
          </div>
        </div>

        {/* AI Enhancement Hint */}
        {text.trim() && !isImproving && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-neutral-500 font-mono animate-in fade-in duration-300">
            <Diamond size={10} className="text-brand-cyan/70" />
            <span>{t('canvasNodes.textNode.aiHint') || 'Click the wand to enhance with AI'}</span>
          </div>
        )}
      </div>

      {/* Output Handle - Subtle styling */}
      <Handle
        type="source"
        position={Position.Right}
        className="node-handle handle-text !w-3 !h-3"
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

