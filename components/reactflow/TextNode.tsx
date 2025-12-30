import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import { FileText, Wand2 } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import type { TextNodeData } from '../../types/reactFlow';
import { Textarea } from '../ui/textarea';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
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
  const { handleResize: handleResizeWithDebounce } = useNodeResize();
  const [text, setText] = useState(nodeData.text || '');
  const [isImproving, setIsImproving] = useState(false);
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
      const minHeight = 80;
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

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[320px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#52ddeb"
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

      {/* Header */}
      <NodeHeader icon={FileText} title={t('canvasNodes.textNode.title') || 'Text Node'} />

      {/* Text Input */}
      <div className="mb-4">
        <div className="relative">
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
            className="min-h-[80px] max-h-[400px] resize-y w-full nodrag nopan text-xs pr-10"
            style={{
              overflowY: textareaRef.current && textareaRef.current.scrollHeight > 400 ? 'auto' : 'hidden',
            }}
          />
          {/* Improve Prompt Button */}
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
                "absolute top-2 right-2 p-1.5 rounded-md transition-all backdrop-blur-sm node-interactive",
                isImproving || !text.trim()
                  ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed"
                  : "bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 text-[#52ddeb] hover:text-[#52ddeb] border border-[#52ddeb]/30"
              )}
              title={isImproving ? (t('canvasNodes.textNode.improvingPrompt') || 'Improving prompt...') : (t('canvasNodes.textNode.improvePrompt') || 'Improve prompt')}
            >
              {isImproving ? (
                <Spinner size={14} color="currentColor" />
              ) : (
                <Wand2 size={14} strokeWidth={2} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="node-handle handle-text"
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

