import React, { memo, useState, useCallback } from 'react';
import { type NodeProps, type Node } from '@xyflow/react';
import { Maximize2, Heart } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { UpscaleNodeData } from '../../types/reactFlow';
import type { Resolution, GeminiModel } from '../../types';
import { cn } from '../../lib/utils';
import { Select } from '../ui/select';
import { mockupApi } from '../../services/mockupApi';
import { toast } from 'sonner';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { NodeHandles } from './shared/NodeHandles';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { useTranslation } from '../../hooks/useTranslation';
import { getCreditsRequired } from '../../utils/creditCalculator';

export const UpscaleNode: React.FC<NodeProps<Node<UpscaleNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const isLoading = data.isLoading || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64);
  const targetResolution = data.targetResolution || '4K';
  const [isSaving, setIsSaving] = useState(false);
  const resultImageUrl = data.resultImageUrl;
  const connectedImage = (data as any).connectedImage as string | undefined;
  const hasConnectedImage = !!connectedImage;
  // Upscale uses gemini-3-pro-image-preview for 4K, gemini-2.5-flash-image for 2K
  const upscaleModel: GeminiModel = targetResolution === '4K' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const creditsRequired = getCreditsRequired(upscaleModel, targetResolution);

  const handleUpscale = async () => {
    if (!data.onUpscale) {
      console.warn('Upscale handler not available');
      return;
    }

    // Read connected image directly from nodeData to ensure we have the latest value
    // This prevents synchronization issues between local state and nodeData
    const connectedImageFromData = (data as any).connectedImage as string | undefined;

    console.log('[UpscaleNode] Upscaling with:', {
      nodeId: id,
      targetResolution,
      hasConnectedImage: !!connectedImageFromData,
      imageType: connectedImageFromData?.startsWith('http') ? 'URL' : connectedImageFromData?.startsWith('data:') ? 'dataURL' : connectedImageFromData ? 'base64' : 'none',
    });

    try {
      // Pass image reference directly to handler - conversion handled by service layer
      await data.onUpscale(id, connectedImageFromData || '', targetResolution);
    } catch (error) {
      console.error('Error in handleUpscale:', error);
      // Error is already handled by the handler, we just need to catch it here
    }
  };

  const handleSave = useCallback(async () => {
    if (!resultImageUrl || isSaving) return;

    // Only save if imageUrl is from R2 (not a data URL)
    if (resultImageUrl.startsWith('data:')) {
      toast.error(t('canvasNodes.upscaleNode.pleaseUseImageFromR2'), { duration: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      const savedMockup = await mockupApi.save({
        imageUrl: resultImageUrl, // Use only R2 URL, no base64
        prompt: `Upscaled image (${targetResolution})`,
        designType: 'other',
        tags: [],
        brandingTags: [],
        aspectRatio: '16:9',
        isLiked: false,
      });

      toast.success(t('canvasNodes.upscaleNode.imageSavedSuccessfully'), { duration: 3000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save image', { duration: 3000 });
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [resultImageUrl, isSaving, targetResolution]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      className="p-5 min-w-[240px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      <NodeHandles />

      {/* Header */}
      <NodeHeader icon={Maximize2} title={t('canvasNodes.upscaleNode.title')} />

      {/* Connected Image Thumbnail - unified component */}
      <ConnectedImagesDisplay
        images={[connectedImage]}
        label={t('canvasNodes.upscaleNode.inputImage')}
        showLabel={hasConnectedImage}
      />

      {!hasConnectedImage && (
        <div className="mb-4">
          <span className="text-xs font-mono text-zinc-500">Connect an image node</span>
        </div>
      )}

      {/* Resolution Selector */}
      <div
        className="mb-4"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <NodeLabel className="text-zinc-500">Target Resolution</NodeLabel>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="node-interactive-z"
        >
          <Select
            value={targetResolution}
            onChange={(value) => {
              try {
                if (data.onUpdateData) {
                  data.onUpdateData(id, { targetResolution: value as Resolution });
                } else {
                  console.warn('onUpdateData handler not available for upscale node:', id);
                }
              } catch (error) {
                console.error('Error updating target resolution:', error);
              }
            }}
            options={[
              { value: '2K', label: '2K' },
              { value: '4K', label: '4K' },
            ]}
            disabled={isLoading || !data.onUpdateData}
            className="text-xs"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </div>
      </div>

      {/* Upscale Button */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!isLoading && data.onUpscale) {
            await handleUpscale();
          }
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        disabled={isLoading || !data.onUpscale}
        className={cn(
          'w-full px-3 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[#brand-cyan]/30 rounded text-xs font-mono text-brand-cyan transition-colors flex items-center justify-center gap-3 node-interactive-z',
          (isLoading || !data.onUpscale) ? 'opacity-50 node-button-disabled' : 'node-button-enabled'
        )}
      >
        {isLoading ? (
          <>
            <GlitchLoader size={14} color="currentColor" />
            Upscaling...
          </>
        ) : (
          <>
            <Maximize2 size={14} />
            <span>Upscale</span>
            <span className="text-brand-cyan/70">({creditsRequired} credits)</span>
          </>
        )}
      </button>

    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render if connectedImage changes (including to/from undefined)
  // This ensures thumbnails are shown/removed when edges are connected/disconnected
  const prevConnectedImage = (prevProps.data as any).connectedImage ?? undefined;
  const nextConnectedImage = (nextProps.data as any).connectedImage ?? undefined;
  const connectedImageChanged = prevConnectedImage !== nextConnectedImage;

  // If connectedImage changed, force re-render
  if (connectedImageChanged) {
    return false; // Re-render
  }

  // Otherwise, check other important props
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data.isLoading === nextProps.data.isLoading &&
    prevProps.data.resultImageUrl === nextProps.data.resultImageUrl &&
    prevProps.data.resultImageBase64 === nextProps.data.resultImageBase64 &&
    prevProps.data.targetResolution === nextProps.data.targetResolution
  );
});

