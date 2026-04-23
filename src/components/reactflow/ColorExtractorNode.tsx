import React, { useState, useRef, useCallback, memo, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react';
import { UploadCloud, Palette, X, RefreshCw, Diamond } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Tooltip } from '@/components/ui/Tooltip';
import type { ColorExtractorNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { fileToBase64 } from '@/utils/fileUtils';
import { toast } from 'sonner';
import { normalizeImageToBase64 } from '@/services/reactFlowService';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { NodeButton } from './shared/node-button';
import { NodeActionBar } from './shared/NodeActionBar';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { Input } from '@/components/ui/input'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ColorExtractorNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { getZoom } = useReactFlow();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const nodeData = data as ColorExtractorNodeData;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [glitchText, setGlitchText] = useState('');

  useEffect(() => {
    if (!nodeData.isExtracting) {
      setGlitchText('');
      return;
    }

    const glitchInterval = setInterval(() => {
      const glitchChars = '*-•.';
      const randomGlitch = Array.from({ length: 4 }, () =>
        glitchChars[Math.floor(Math.random() * glitchChars.length)]
      ).join('');
      setGlitchText(randomGlitch);
    }, 150);

    return () => clearInterval(glitchInterval);
  }, [nodeData.isExtracting]);

  const connectedImage = nodeData.connectedImage;
  const imageBase64 = connectedImage || nodeData.imageBase64;
  const extractedColors = nodeData.extractedColors || [];
  const isExtracting = nodeData.isExtracting || false;

  const imageUrl = imageBase64
    ? (imageBase64.startsWith('data:') || imageBase64.startsWith('http')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`)
    : undefined;

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    imageInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUpload) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('canvasNodes.imageNode.pleaseSelectImageFile'), { duration: 3000 });
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('canvasNodes.imageNode.fileSizeExceedsLimitMessage'), { duration: 5000 });
      return;
    }

    try {
      const imageData = await fileToBase64(file);
      nodeData.onUpload(id, imageData.base64);
      toast.success(t('canvasNodes.imageNode.imageSavedSuccessfully'), { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || t('canvas.failedToProcessImage'), { duration: 5000 });
      console.error('Failed to process image:', error);
    }
  };

  const handleExtract = useCallback(async (isRegeneration = false) => {
    if (!nodeData.onExtract || !imageBase64) {
      toast.error(t('canvasNodes.directorNode.connectImageFirst'), { duration: 3000 });
      return;
    }

    let imageForExtraction = imageBase64;

    if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
      try {
        imageForExtraction = await normalizeImageToBase64(imageBase64);
      } catch (error: any) {
        toast.error(t('canvas.failedToLoadImage'), { duration: 3000 });
        return;
      }
    }

    await nodeData.onExtract(id, imageForExtraction, isRegeneration);
  }, [nodeData, id, imageBase64]);

  const handleRemoveImage = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { imageBase64: undefined });
    }
  };

  const handleCopyColor = useCallback(async (color: string) => {
    try {
      await navigator.clipboard.writeText(color);
      toast.success(t('canvasNodes.chatNode.messageCopied'), { duration: 2000 });
    } catch (error) {
      console.error('Failed to copy color:', error);
    }
  }, []);

  const handleColorChange = useCallback((index: number, newColor: string) => {
    if (!nodeData.onUpdateData || !extractedColors) return;

    const updatedColors = [...extractedColors];
    updatedColors[index] = newColor.toUpperCase();
    nodeData.onUpdateData(id, { extractedColors: updatedColors });
  }, [nodeData, id, extractedColors]);

  const canExtract = !!(imageBase64 && !isExtracting);

  const handleRegenerateOne = useCallback(async (index: number) => {
    if (!nodeData.onRegenerateOne || !imageBase64) return;
    try {
      await nodeData.onRegenerateOne(id, imageBase64, index);
    } catch (error) {
      console.error('Failed to regenerate color:', error);
    }
  }, [nodeData, id, imageBase64]);

  const handleFitToContent = useCallback(() => {
    const width = nodeData.imageWidth;
    const height = nodeData.imageHeight;

    if (width && height) {
      let targetWidth = width;
      let targetHeight = height;
      const MAX_FIT_WIDTH = 1000;

      if (targetWidth > MAX_FIT_WIDTH) {
        const ratio = MAX_FIT_WIDTH / targetWidth;
        targetWidth = MAX_FIT_WIDTH;
        targetHeight = targetHeight * ratio;
      }

      fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), nodeData.onResize);
    } else {
      fitToContent(id, 320, 'auto', nodeData.onResize);
    }
  }, [id, nodeData.imageWidth, nodeData.imageHeight, nodeData.onResize, fitToContent]);

  const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
    handleResizeWithDebounce(id, params.width, params.height, nodeData.onResize as any);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="min-w-[320px] max-w-[400px]"
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={280}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          keepAspectRatio={!!imageUrl}
          onResize={handleResize}
        />
      )}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="image-input"
        label={t('canvasNodes.imageNode.imageInput')}
        handleType="image"
        style={{ top: '90px' }}
      />

      <Handle
        type="source"
        position={Position.Right}
        className="node-handle"
      />

      <NodeHeader icon={Palette} title={t('canvasNodes.colorExtractorNode.title') || "Color Extractor"} selected={selected} />

      <div className="mb-4">
        <NodeLabel>
          {t('canvasNodes.imageNode.imageInput')} {connectedImage && <span className="text-[10px] text-neutral-500">({t('common.connected')})</span>}
        </NodeLabel>
        {imageUrl ? (
          <div className="relative">
            <div className="relative w-full h-auto min-h-[1210px] bg-neutral-900/50 rounded border-node border-neutral-700/30 overflow-hidden">
              <img
                src={imageUrl}
                alt={t('canvasNodes.colorExtractorNode.imageToExtractFrom') || "Image to extract colors from"}
                className="w-full h-full object-contain p-2"
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    if (nodeData.onUpdateData) {
                      nodeData.onUpdateData(id, {
                        imageWidth: img.naturalWidth,
                        imageHeight: img.naturalHeight,
                      });
                    }
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <Input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <NodeButton onClick={handleUploadClick} className="w-full">
              <UploadCloud size={14} />
              {t('canvasNodes.imageNode.uploadImage')}
            </NodeButton>
          </>
        )}
      </div>

      <Tooltip
        content={`${t('canvasNodes.promptNode.creditsRequired') || 'Costs'} 1 ${t('canvasNodes.promptNode.credits')}`}
        delay={500}
      >
        <NodeButton
          onClick={() => handleExtract(false)}
          disabled={!canExtract}
          variant="primary"
          size="full"
          className="node-interactive group/gen mb-4"
        >
          {isExtracting ? (
            <div className="flex items-center justify-center gap-2">
              <GlitchLoader size={14} color="brand-cyan" />
              <span>{t('canvasNodes.colorExtractorNode.extracting')} {glitchText}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Palette size={14} className="group-hover/gen:rotate-12 transition-transform" />
              <span className="font-semibold tracking-tight">{t('canvasNodes.colorExtractorNode.extractColors')}</span>
              <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] text-foreground/80">
                <Diamond size={10} className="opacity-50 fill-current" />
                1
              </div>
            </div>
          )}
        </NodeButton>
      </Tooltip>

      {extractedColors.length > 0 && (
        <div className="border-t border-neutral-700/30 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <NodeLabel className="mb-0">{t('canvasNodes.colorExtractorNode.extractedColors')} ({extractedColors.length})</NodeLabel>
            <NodeButton
              onClick={() => handleExtract(true)}
              disabled={!canExtract}
              variant="default"
              size="xs"
              className="px-2"
            >
              <RefreshCw size={12} />
              {t('canvasNodes.colorExtractorNode.regenerateAll')}
            </NodeButton>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {extractedColors.map((color, index) => (
              <div
                key={`${color}-${index}`}
                className="flex items-center gap-2 p-2 bg-neutral-900/50 rounded border-node border-neutral-700/30 hover:border-[brand-cyan]/50 transition-colors group/color cursor-pointer hover:bg-neutral-800/50 relative"
                onClick={() => handleCopyColor(color)}
                title={t('canvasNodes.colorExtractorNode.clickToCopy') || "Click to copy hex code"}
              >
                <div
                  className="w-8 h-8 rounded border-node border-neutral-700/50 flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-mono text-neutral-400 flex-1 truncate">
                  {color}
                </span>

                <div className="flex items-center gap-1 flex-shrink-0 relative z-20" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label="Regenerar cor"
                    className="p-1 rounded hover:bg-neutral-700/50 opacity-0 group-hover/color:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRegenerateOne(index);
                    }}
                  >
                    <RefreshCw size={10} aria-hidden="true" className="text-neutral-400 hover:text-brand-cyan" />
                  </button>
                  <div className="relative w-5 h-5 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => handleColorChange(index, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                    />
                    <div className="w-2.5 h-2.5 rounded-full border-node border-neutral-400/50 bg-neutral-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!dragging && imageUrl && !connectedImage && (
        <NodeActionBar selected={selected} getZoom={getZoom}>
          <NodeButton variant="ghost" size="xs"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 backdrop-blur-sm border-node border-red-500/20 hover:border-red-500/30"
            title={t('canvasNodes.imageNode.removeImage')}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={12} strokeWidth={2} />
          </NodeButton>
        </NodeActionBar>
      )}
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data.isExtracting === nextProps.data.isExtracting &&
    prevProps.data.imageBase64 === nextProps.data.imageBase64 &&
    prevProps.data.connectedImage === nextProps.data.connectedImage &&
    prevProps.data.extractedColors === nextProps.data.extractedColors
  );
});

ColorExtractorNode.displayName = 'ColorExtractorNode';
