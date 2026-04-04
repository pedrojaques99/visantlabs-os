import React, { memo, useState, useCallback } from 'react';
import { type NodeProps, type Node, NodeResizer } from '@xyflow/react';
import { Maximize2, Diamond } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { UpscaleNodeData } from '@/types/reactFlow';
import type { Resolution, GeminiModel } from '@/types/types';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { mockupApi } from '@/services/mockupApi';
import { toast } from 'sonner';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { NodeHandles } from './shared/NodeHandles';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { useTranslation } from '@/hooks/useTranslation';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { NodeButton } from './shared/node-button'
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeMediaDisplay } from './shared/NodeMediaDisplay';

export const UpscaleNode: React.FC<NodeProps<Node<UpscaleNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const isLoading = data.isLoading || false;
  const targetResolution = data.targetResolution || '4K';
  const [isSaving, setIsSaving] = useState(false);
  const resultImageUrl = data.resultImageUrl;
  const connectedImage = (data as any).connectedImage as string | undefined;
  const hasConnectedImage = !!connectedImage;
  // Upscale uses gemini-3-pro-image-preview for 4K, gemini-3.1-flash-image-preview for 2K
  const upscaleModel: GeminiModel = targetResolution === '4K' ? GEMINI_MODELS.PRO : GEMINI_MODELS.NB2;
  const creditsRequired = getCreditsRequired(upscaleModel, targetResolution);

  const handleUpscale = async () => {
    if (!data.onUpscale) {
      console.warn('Upscale handler not available');
      return;
    }

    // Read connected image directly from nodeData to ensure we have the latest value
    const connectedImageFromData = (data as any).connectedImage as string | undefined;

    try {
      await data.onUpscale(id, connectedImageFromData || '', targetResolution);
    } catch (error) {
      console.error('Error in handleUpscale:', error);
    }
  };

  const handleSave = useCallback(async () => {
    if (!resultImageUrl || isSaving) return;

    if (resultImageUrl.startsWith('data:')) {
      toast.error(t('canvasNodes.upscaleNode.pleaseUseImageFromR2'), { duration: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      await mockupApi.save({
        imageUrl: resultImageUrl,
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
    } finally {
      setIsSaving(false);
    }
  }, [resultImageUrl, isSaving, targetResolution, t]);

  const handleResize = useCallback((_: any, params: { width: number }) => {
    handleResizeWithDebounce(id, params.width, 'auto', data.onResize);
  }, [id, data.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    fitToContent(id, 'auto', 'auto', data.onResize);
  }, [id, data.onResize, fitToContent]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      onFitToContent={handleFitToContent}
      className="min-w-[240px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={240}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={handleResize}
        />
      )}
      <NodeHandles />

      {/* Header */}
      <NodeHeader icon={Maximize2} title={t('canvasNodes.upscaleNode.title')} selected={selected} />

      {/* Connected Image Thumbnail - unified component */}
      <ConnectedImagesDisplay
        images={[connectedImage]}
        label={t('canvasNodes.upscaleNode.inputImage')}
        showLabel={hasConnectedImage}
      />

      {!hasConnectedImage && (
        <div className="mb-4">
          <span className="text-xs font-mono text-neutral-500">Connect an image node</span>
        </div>
      )}

      {/* Resolution Selector */}
      <div
        className="mb-4"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <NodeLabel className="text-neutral-500">Target Resolution</NodeLabel>
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
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* Result Display Section */}
      {(data.resultImageUrl || data.resultImageBase64) && (
        <div className="node-margin mb-4">
          <NodeMediaDisplay
            url={data.resultImageUrl || (data.resultImageBase64 ? (data.resultImageBase64.startsWith('data:') ? data.resultImageBase64 : `data:image/png;base64,${data.resultImageBase64}`) : null)}
            isLoading={isLoading}
            dragging={dragging}
            alt="Upscale Result"
          />
        </div>
      )}

      {/* Upscale Button */}
      <Tooltip 
        content={`${t('canvasNodes.promptNode.creditsRequired') || 'Costs'} ${creditsRequired} ${t('canvasNodes.promptNode.credits')}`}
        delay={500}
      >
        <NodeButton
          variant="primary"
          size="full"
          onClick={async (e) => {
            e.stopPropagation();
            if (!isLoading && data.onUpscale) {
              await handleUpscale();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isLoading || !data.onUpscale}
          className="node-interactive group/gen"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <GlitchLoader size={14} color="brand-cyan" />
              <span>{t('canvasNodes.upscaleNode.upscaling') || 'Upscaling...'}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Maximize2 size={14} className="group-hover/gen:rotate-12 transition-transform" />
              <span className="font-semibold tracking-tight">{t('canvasNodes.upscaleNode.upscale') || 'Upscale'}</span>
              <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] text-foreground/80">
                <Diamond size={10} className="opacity-50 fill-current" />
                {creditsRequired}
              </div>
            </div>
          )}
        </NodeButton>
      </Tooltip>

    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  const prevConnectedImage = (prevProps.data as any).connectedImage ?? undefined;
  const nextConnectedImage = (nextProps.data as any).connectedImage ?? undefined;
  const connectedImageChanged = prevConnectedImage !== nextConnectedImage;

  if (connectedImageChanged) {
    return false;
  }

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

UpscaleNode.displayName = 'UpscaleNode';
