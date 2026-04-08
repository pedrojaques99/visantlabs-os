import React, { useState, memo, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node, useReactFlow, NodeResizer } from '@xyflow/react';
import { Wrench, Wand2, Diamond } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Tooltip } from '@/components/ui/Tooltip';
import type { MergeNodeData } from '@/types/reactFlow';
import type { GeminiModel, SeedreamModel, Resolution } from '@/types/types';
import { cn } from '@/lib/utils';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { NodeContainer } from './shared/NodeContainer';
import { Textarea } from '@/components/ui/textarea';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { ModelSelector } from '../shared/ModelSelector';
import { useTranslation } from '@/hooks/useTranslation';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { DEFAULT_MODEL, isAdvancedModel } from '@/constants/geminiModels';
import { isSeedreamModel, getSeedreamModelConfig } from '@/constants/seedreamModels';
import { useNodeDataUpdater } from '@/hooks/canvas/useNodeDataUpdater';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';

export const MergeNode: React.FC<NodeProps<Node<MergeNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [model, setModel] = useState<GeminiModel | SeedreamModel>(data.model || DEFAULT_MODEL);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = data.isLoading || false;
  const isGeneratingPrompt = data.isGeneratingPrompt || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64);
  const connectedImages = data.connectedImages || [];
  const hasEnoughImages = connectedImages.length >= 2;
  const isSeedream = isSeedreamModel(model);
  const seedreamResolution = isSeedream ? (data.resolution as Resolution | undefined) || getSeedreamModelConfig(model)?.defaultResolution : undefined;
  const geminiResolution = !isSeedream && isAdvancedModel(model as GeminiModel) ? ((data.resolution as Resolution | undefined) || '1K') : undefined;
  const creditsRequired = getCreditsRequired(model, isSeedream ? seedreamResolution : geminiResolution, isSeedream ? 'seedream' : 'gemini');

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
    if (data.prompt !== undefined) setPrompt(data.prompt);
    if (data.model) setModel(data.model);
  }, [data.prompt, data.model]);

  // Adjust textarea height when prompt changes or component mounts
  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt]);

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

    await data.onGenerate(id, connectedImagesFromData, prompt, model);
  };

  const { debouncedUpdate: debouncedUpdateData } = useNodeDataUpdater<MergeNodeData>(data.onUpdateData, id);

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, 'auto', data.onResize);
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
      className="min-w-[280px]"
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
      <NodeHeader 
        icon={Wrench} 
        title={t('canvasNodes.mergeNode.title') || 'Merge Node'} 
        selected={selected} 
      />

      <div className="p-4 flex flex-col gap-[var(--node-gap)]">
        {/* Connected Images Thumbnails - unified component */}
        <ConnectedImagesDisplay
          images={connectedImages}
          label={t('canvasNodes.mergeNode.inputImages')}
          showLabel={connectedImages.length > 0}
          maxThumbnails={3}
        />

        {/* Generate Prompt Button */}
        {hasEnoughImages && (
          <div className="w-full">
            <NodeButton
              onClick={(e) => {
                e.stopPropagation();
                handleGeneratePrompt();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isGeneratingPrompt || isLoading}
              variant="purple"
              size="full"
              className="node-interactive group/prompt"
            >
              {isGeneratingPrompt ? (
                <div className="flex items-center justify-center gap-2">
                  <GlitchLoader size={14} color="currentColor" />
                  <span>{t('canvasNodes.mergeNode.generatingPrompt') || 'Generating...'}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Wand2 size={14} className="group-hover/prompt:rotate-12 transition-transform" />
                  <span className="font-semibold tracking-tight">{t('canvasNodes.mergeNode.generatePrompt') || 'Generate Prompt'}</span>
                </div>
              )}
            </NodeButton>
          </div>
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
          className="text-xs nodrag nopan bg-neutral-900/40 border-neutral-700/40 focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 backdrop-blur-sm"
          rows={3}
          disabled={isLoading || isGeneratingPrompt}
        />

        <div className="flex flex-col gap-3">
          <ModelSelector
            type="image"
            variant="node"
            selectedModel={model}
            onModelChange={(newModel, provider) => {
              setModel(newModel);
              if (data.onUpdateData) {
                data.onUpdateData(id, { model: newModel, provider });
              }
            }}
            disabled={isLoading || isGeneratingPrompt}
          />
        </div>

        {/* Generate Image Button */}
        <Tooltip 
          content={`${t('canvasNodes.promptNode.creditsRequired') || 'Costs'} ${creditsRequired} ${t('canvasNodes.promptNode.credits')}`}
          delay={500}
        >
          <NodeButton
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateImage();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isLoading || isGeneratingPrompt || !prompt.trim()}
            variant="primary"
            size="full"
            className="node-interactive group/gen"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <GlitchLoader size={14} color="brand-cyan" />
                <span>{t('canvasNodes.mergeNode.generatingImage') || 'Generating Image...'}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Wrench size={14} className="group-hover/gen:rotate-12 transition-transform" />
                <span className="font-semibold tracking-tight">{t('canvasNodes.mergeNode.generateImage') || 'Generate Image'}</span>
                <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] text-foreground/80">
                  <Diamond size={10} className="opacity-50 fill-current" />
                  {creditsRequired}
                </div>
              </div>
            )}
          </NodeButton>
        </Tooltip>

        {/* Result Preview */}
        {hasResult && (data.resultImageUrl || data.resultImageBase64) && (
          <div className="pt-2">
            <img
              src={data.resultImageUrl || (data.resultImageBase64 ? `data:image/png;base64,${data.resultImageBase64}` : '')}
              alt={t('canvasNodes.mergeNode.result')}
              className="w-full h-auto rounded-md border border-neutral-700/30 shadow-sm"
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
      </div>

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

