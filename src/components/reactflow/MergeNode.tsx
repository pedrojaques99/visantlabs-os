import React, { useState, memo, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow, NodeResizer } from '@xyflow/react';
import { Wrench, Wand2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { MergeNodeData } from '@/types/reactFlow';
import type { GeminiModel } from '@/types/types';
import { cn } from '@/lib/utils';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { NodeContainer } from './shared/NodeContainer';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { useTranslation } from '@/hooks/useTranslation';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { GEMINI_MODELS, DEFAULT_MODEL, DEFAULT_ASPECT_RATIO, isAdvancedModel } from '@/constants/geminiModels';
import { isSafeUrl } from '@/utils/imageUtils';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';

export const MergeNode: React.FC<NodeProps<Node<MergeNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [model, setModel] = useState<GeminiModel>(data.model || DEFAULT_MODEL);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = data.isLoading || false;
  const isGeneratingPrompt = data.isGeneratingPrompt || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64);
  const connectedImages = data.connectedImages || [];
  const hasEnoughImages = connectedImages.length >= 2;
  const creditsRequired = getCreditsRequired(model, isAdvancedModel(model) ? '1K' : undefined);

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

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, data.onResize);
  }, [id, data.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    const width = data.imageWidth;
    const height = data.imageHeight;

    if (width && height) {
      // Calculate a reasonable size if image is too large
      let targetWidth = width;
      let targetHeight = height;
      const MAX_FIT_WIDTH = 1200;

      if (targetWidth > MAX_FIT_WIDTH) {
        const ratio = MAX_FIT_WIDTH / targetWidth;
        targetWidth = MAX_FIT_WIDTH;
        targetHeight = targetHeight * ratio;
      }

      fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), data.onResize);
    } else {
      // For nodes without result image yet, reset to a clean state
      fitToContent(id, 280, 'auto', data.onResize);
    }
  }, [id, data.imageWidth, data.imageHeight, data.onResize, fitToContent]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      warning={data.oversizedWarning}
      className="p-5 min-w-[280px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={280}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          keepAspectRatio={hasResult}
          onResize={(_, { width, height }) => handleResize(width, height)}
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
              <GlitchLoader size={14} color="currentColor" />
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
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newModel = GEMINI_MODELS.FLASH as GeminiModel;
              setModel(newModel);
              if (data.onUpdateData) {
                data.onUpdateData(id, { model: newModel });
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isLoading || isGeneratingPrompt}
            className={cn(
              'w-full aspect-square max-h-32 flex flex-col items-center justify-center gap-1 p-2 text-xs font-mono rounded border transition-colors cursor-pointer node-interactive',
              model === GEMINI_MODELS.FLASH
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50',
              (isLoading || isGeneratingPrompt) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="text-2xl">⛏️</span>
            <span className="font-semibold text-sm">HD</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">
              {getCreditsRequired(GEMINI_MODELS.FLASH)} {t('canvasNodes.promptNode.credits')}
            </span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const newModel = GEMINI_MODELS.NB2 as GeminiModel;
              setModel(newModel);
              if (data.onUpdateData) {
                data.onUpdateData(id, { model: newModel });
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isLoading || isGeneratingPrompt}
            className={cn(
              'w-full aspect-square max-h-32 flex flex-col items-center justify-center gap-1 p-2 text-xs font-mono rounded border transition-colors cursor-pointer node-interactive',
              model === GEMINI_MODELS.NB2
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50',
              (isLoading || isGeneratingPrompt) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="text-2xl">🍌</span>
            <span className="font-semibold text-sm">NB2</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">
              {getCreditsRequired(GEMINI_MODELS.NB2, isAdvancedModel(model) ? '1K' : undefined)} {t('canvasNodes.promptNode.credits')}
            </span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const newModel = GEMINI_MODELS.PRO as GeminiModel;
              setModel(newModel);
              if (data.onUpdateData) {
                data.onUpdateData(id, { model: newModel });
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isLoading || isGeneratingPrompt}
            className={cn(
              'w-full aspect-square max-h-32 flex flex-col items-center justify-center gap-1 p-2 text-xs font-mono rounded border transition-colors cursor-pointer node-interactive',
              model === GEMINI_MODELS.PRO
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50',
              (isLoading || isGeneratingPrompt) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="text-2xl">⛏️💎</span>
            <span className="font-semibold text-sm">4K Pro</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">
              {getCreditsRequired(GEMINI_MODELS.PRO, isAdvancedModel(model) ? '1K' : undefined)} {t('canvasNodes.promptNode.credits')}
            </span>
          </button>
        </div>
      </div>

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
            <GlitchLoader size={14} className="mr-1" color="brand-cyan" />
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
        <div className="mt-3 pt-3 border-t border-neutral-700/30">
          <img
            src={data.resultImageUrl || (data.resultImageBase64 ? `data:image/png;base64,${data.resultImageBase64}` : '')}
            alt={t('canvasNodes.mergeNode.result')}
            className="w-full h-auto rounded"
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                if (data.onUpdateData) {
                  data.onUpdateData(id, {
                    imageWidth: img.naturalWidth,
                    imageHeight: img.naturalHeight,
                  });
                }
              }
            }}
          />
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "w-2 h-2 bg-brand-cyan border-2 border-black node-handle",
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

