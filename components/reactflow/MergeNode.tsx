import React, { useState, memo, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow, NodeResizer } from '@xyflow/react';
import { Wrench, Wand2 } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import type { MergeNodeData } from '../../types/reactFlow';
import type { GeminiModel } from '../../types';
import { cn } from '../../lib/utils';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { NodeContainer } from './shared/NodeContainer';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { useTranslation } from '../../hooks/useTranslation';
import { getCreditsRequired } from '../../utils/creditCalculator';
import { isSafeUrl } from '../../utils/imageUtils';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';

export const MergeNode: React.FC<NodeProps<Node<MergeNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [model, setModel] = useState<GeminiModel>(data.model || 'gemini-2.5-flash-image');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = data.isLoading || false;
  const isGeneratingPrompt = data.isGeneratingPrompt || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64);
  const connectedImages = data.connectedImages || [];
  const hasEnoughImages = connectedImages.length >= 2;
  const creditsRequired = getCreditsRequired(model);

  // Auto-resize textarea to fit content
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = 60; // ~3 rows
      textareaRef.current.style.height = `${Math.max(minHeight, scrollHeight)}px`;
    }
  };

  // Sync prompt and model with data
  useEffect(() => {
    if (data.prompt !== undefined) {
      setPrompt(data.prompt);
    }
  }, [data.prompt]);

  // Adjust textarea height when prompt changes or component mounts
  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt]);

  // Initial resize on mount
  useEffect(() => {
    adjustTextareaHeight();
  }, []);

  useEffect(() => {
    if (data.model) {
      setModel(data.model);
    }
  }, [data.model]);

  const handleGeneratePrompt = async () => {
    if (!data.onGeneratePrompt || !hasEnoughImages) {
      return;
    }

    await data.onGeneratePrompt(id, connectedImages);
  };

  const handleGenerateImage = async () => {
    if (!data.onGenerate || !prompt.trim()) {
      return;
    }

    // Update model in node data
    if (data.onUpdateData && model !== data.model) {
      data.onUpdateData(id, { model });
    }

    // Read connected images directly from nodeData to ensure we have the latest values
    // This prevents synchronization issues between local state and nodeData
    const connectedImagesFromData = data.connectedImages || [];

    console.log('[MergeNode] Generating with:', {
      prompt: prompt.trim(),
      model,
      connectedImagesCount: connectedImagesFromData.length,
      images: connectedImagesFromData.map((img, idx) => ({
        index: idx,
        type: img?.startsWith('http') ? 'URL' : img?.startsWith('data:') ? 'dataURL' : 'base64',
        length: img?.length || 0,
      })),
    });

    await data.onGenerate(id, connectedImagesFromData, prompt, model);
  };

  // Debounced update for data changes
  const debouncedUpdateData = useDebouncedCallback((updates: Partial<MergeNodeData>) => {
    if (data.onUpdateData) {
      data.onUpdateData(id, updates);
    }
  }, 500);

  // Handle resize from NodeResizer
  const handleResize = useCallback((width: number, height: number) => {
    if (data.onResize && typeof data.onResize === 'function') {
      data.onResize(id, width, height);
    }

    setNodes((nds) => {
      return nds.map((n) => {
        if (n.id === id && n.type === 'merge') {
          return {
            ...n,
            style: {
              ...n.style,
              width,
              height,
            },
          };
        }
        return n;
      });
    });
  }, [id, data, setNodes]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      className="p-5 min-w-[280px]"
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

      {/* Input Handles - up to 3 images */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-1"
        className="node-handle"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-2"
        className="node-handle"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-3"
        className="node-handle"
      />

      {/* Header */}
      <NodeHeader icon={Wrench} title={t('canvasNodes.mergeNode.title')} />

      {/* Connected Images Thumbnails - unified component */}
      <ConnectedImagesDisplay
        images={connectedImages}
        label={t('canvasNodes.mergeNode.inputImages')}
        showLabel={connectedImages.length > 0}
        maxThumbnails={3}
      />

      {/* Generate Prompt Button */}
      {hasEnoughImages && (
        <NodeButton
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleGeneratePrompt();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          disabled={isGeneratingPrompt || isLoading}
          variant="purple"
          className="mb-4"
        >
          {isGeneratingPrompt ? (
            <>
              <Spinner size={14} color="currentColor" />
              Generating Prompt...
            </>
          ) : (
            <>
              <Wand2 size={14} />
              Generate Prompt
            </>
          )}
        </NodeButton>
      )}

      {/* Prompt Input */}
      <Textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => {
          e.stopPropagation();
          const newPrompt = e.target.value;
          setPrompt(newPrompt);
          adjustTextareaHeight();
          debouncedUpdateData({ prompt: newPrompt });
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        placeholder={t('canvasNodes.mergeNode.promptPlaceholder')}
        className="text-xs mb-4 nodrag nopan"
        rows={3}
        disabled={isLoading || isGeneratingPrompt}
      />

      {/* Model Selector */}
      <Select
        value={model}
        onChange={(value) => {
          const newModel = value as GeminiModel;
          setModel(newModel);
          if (data.onUpdateData) {
            data.onUpdateData(id, { model: newModel });
          }
        }}
        variant="node"
        disabled={isLoading || isGeneratingPrompt}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        className="mb-4"
        options={[
          { value: 'gemini-2.5-flash-image', label: 'HD' },
          { value: 'gemini-3-pro-image-preview', label: '4K' }
        ]}
      />

      {/* Generate Image Button */}
      <NodeButton
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleGenerateImage();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        disabled={isLoading || isGeneratingPrompt || !prompt.trim()}
        variant="primary"
      >
        {isLoading ? (
          <>
            <Spinner size={14} className="mr-1" color="#52ddeb" />
            Generating Image...
          </>
        ) : (
          <>
            <Wrench size={14} />
            <span>Generate Image</span>
            <span className="opacity-70">({creditsRequired} credits)</span>
          </>
        )}
      </NodeButton>

      {/* Result Preview */}
      {hasResult && (data.resultImageUrl || data.resultImageBase64) && (
        <div className="mt-3 pt-3 border-t border-zinc-700/30">
          <img
            src={(data.resultImageUrl && isSafeUrl(data.resultImageUrl)) ? data.resultImageUrl : (data.resultImageBase64 ? `data:image/png;base64,${data.resultImageBase64}` : '')}
            alt="Merged result"
            className="w-full h-auto rounded"
          />
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "w-2 h-2 bg-[#52ddeb] border-2 border-black node-handle",
          !hasResult && "opacity-50"
        )}
      />
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render if connectedImages change
  // This ensures thumbnails are shown/removed when edges are connected/disconnected
  const prevImages = prevProps.data.connectedImages || [];
  const nextImages = nextProps.data.connectedImages || [];

  // Compare arrays - re-render if length or content changed
  if (prevImages.length !== nextImages.length) {
    return false; // Re-render
  }

  for (let i = 0; i < prevImages.length; i++) {
    if (prevImages[i] !== nextImages[i]) {
      return false; // Re-render
    }
  }

  // Otherwise, check other important props
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data.isLoading === nextProps.data.isLoading &&
    prevProps.data.resultImageUrl === nextProps.data.resultImageUrl &&
    prevProps.data.resultImageBase64 === nextProps.data.resultImageBase64 &&
    prevProps.data.prompt === nextProps.data.prompt &&
    prevProps.data.model === nextProps.data.model
  );
});

