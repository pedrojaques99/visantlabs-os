import React, { useState, useEffect, memo, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Loader2, Video, Image as ImageIcon, X } from 'lucide-react';
import type { VideoNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { PromptInput } from '../PromptInput';
import { GlitchLoader } from '../ui/GlitchLoader';
import { NodeContainer } from './shared/NodeContainer';
import { NodeLabel } from './shared/node-label';
import { NodeHeader } from './shared/node-header';
import { Select } from '../ui/select';
import { useTranslation } from '../../hooks/useTranslation';
import { getImageUrl } from '../../utils/imageUtils';
import { getVideoCreditsRequired } from '../../utils/creditCalculator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VideoNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodeData = data as VideoNodeData;
  const [prompt, setPrompt] = useState(nodeData.prompt || '');
  const [model, setModel] = useState<string>(nodeData.model || 'veo-3.1-generate-preview');
  const [connectedImage, setConnectedImage] = useState<string | undefined>(nodeData.connectedImage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const isLoading = nodeData.isLoading || false;
  const hasConnectedImage = !!connectedImage;
  const creditsRequired = getVideoCreditsRequired();
  

  // Sync prompt and model with data
  useEffect(() => {
    if (nodeData.prompt !== undefined) {
      setPrompt(nodeData.prompt);
    }
  }, [nodeData.prompt]);

  useEffect(() => {
    if (nodeData.model) {
      setModel(nodeData.model);
    }
  }, [nodeData.model]);

  useEffect(() => {
    setConnectedImage(nodeData.connectedImage);
  }, [nodeData.connectedImage]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { prompt: value });
    }
  };

  const handleGenerate = async () => {
    if (!nodeData.onGenerate || !prompt.trim()) {
      return;
    }

    // Update model in node data if changed
    if (nodeData.onUpdateData && model !== nodeData.model) {
      nodeData.onUpdateData(id, { model });
    }

    await nodeData.onGenerate(id, prompt.trim(), connectedImage, model);
  };

  const handleImageRemove = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { connectedImage: undefined });
    }
    setConnectedImage(undefined);
  };

  const getImageDisplayUrl = (image: string): string => {
    if (image.startsWith('data:') || image.startsWith('http')) {
      return image;
    }
    return getImageUrl({ id: image } as any);
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[320px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {/* Input Handle for Image */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-image"
        className="w-2 h-2 bg-[#52ddeb] border-2 border-black node-handle handle-top-50"
      />

      {/* Header */}
      <NodeHeader icon={Video} title={t('canvasNodes.videoNode.title') || 'Video Generator'} />

      {/* Connected Image Display */}
      {hasConnectedImage && (
        <div className="mb-4">
          <NodeLabel>
            {t('canvasNodes.videoNode.referenceImage') || 'Reference Image'}
          </NodeLabel>
          <div className="relative group">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleImageRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-0 right-0 w-5 h-5 bg-red-500/80 hover:bg-red-500 border border-black rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X size={10} className="text-white" strokeWidth={3} />
            </button>
            <img
              src={getImageDisplayUrl(connectedImage)}
              alt={t('common.reference')}
              className="w-full h-32 object-cover rounded border border-[#52ddeb]/30"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {/* Prompt Input */}
      <div className="mb-4">
        <PromptInput
          value={prompt}
          onChange={handlePromptChange}
          onSubmit={handleGenerate}
          placeholder={t('canvasNodes.videoNode.promptPlaceholder') || 'Describe the video you want to generate...'}
          disabled={isLoading}
          className="w-full"
          textareaRef={textareaRef}
        />
      </div>

      {/* Model Selector */}
      <Select
        value={model}
        onChange={(value) => {
          const newModel = value as string;
          setModel(newModel);
          if (nodeData.onUpdateData) {
            nodeData.onUpdateData(id, { model: newModel });
          }
        }}
        variant="node"
        disabled={isLoading}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        className="mb-4"
        options={[
          { value: 'veo-3.1-generate-preview', label: 'Veo 3.1' }
        ]}
      />

      {/* Generate Video Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleGenerate();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        disabled={isLoading || !prompt.trim()}
        className={cn(
          'w-full px-3 py-2 bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 border border-[#52ddeb]/30 rounded text-xs font-mono text-[#52ddeb] transition-colors flex items-center justify-center gap-3 node-interactive',
          (isLoading || !prompt.trim()) ? 'opacity-50 node-button-disabled' : 'node-button-enabled'
        )}
        title={isLoading ? t('canvasNodes.videoNode.generating') : !prompt.trim() ? t('canvasNodes.videoNode.enterPrompt') : t('canvasNodes.videoNode.generateVideo')}
      >
        {isLoading ? (
          <>
            <GlitchLoader size={14} className="mr-1" color="#52ddeb" />
            {t('canvasNodes.videoNode.generating') || 'Generating...'}
          </>
        ) : (
          <>
            <Video size={14} />
            <span>{t('canvasNodes.videoNode.generate') || 'Generate Video'}</span>
            <span className="text-[#52ddeb]/70">({creditsRequired} credits)</span>
          </>
        )}
      </button>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-[#52ddeb] border-2 border-black node-handle"
      />
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render if important data changes
  const prevData = prevProps.data as VideoNodeData;
  const nextData = nextProps.data as VideoNodeData;
  
  if (prevData.isLoading !== nextData.isLoading ||
      prevData.prompt !== nextData.prompt ||
      prevData.model !== nextData.model ||
      prevData.connectedImage !== nextData.connectedImage ||
      prevProps.selected !== nextProps.selected ||
      prevProps.dragging !== nextProps.dragging) {
    return false; // Re-render
  }
  
  return true; // Skip re-render
});

