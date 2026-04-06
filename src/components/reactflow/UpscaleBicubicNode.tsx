import React, { useEffect, memo, useRef, useCallback, useState } from 'react';
import { type NodeProps, type Node, NodeResizer, useReactFlow } from '@xyflow/react';
import { Maximize2, Download, Upload, Diamond, Trash2, Palette, FileText, Heart } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { UpscaleBicubicNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeHandles } from './shared/NodeHandles';
import { NodeContainer } from './shared/NodeContainer';
import { NodeActionBar } from './shared/NodeActionBar';
import { useTranslation } from '@/hooks/useTranslation';
import { useMockupLike } from '@/hooks/useMockupLike';
import { fileToBase64, validateFile } from '@/utils/fileUtils';
import { isSafeUrl } from '@/utils/imageUtils';
import { mockupApi } from '@/services/mockupApi';
import { aiApi } from '@/services/aiApi';
import { normalizeImageToBase64 } from '@/services/reactFlowService';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';
import { MockupPresetModal } from '../MockupPresetModal';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeButton } from './shared/node-button'
import { Input } from '@/components/ui/input'

export const UpscaleBicubicNode: React.FC<NodeProps<Node<UpscaleBicubicNodeData>>> = memo(({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { setNodes, getZoom, getNode } = useReactFlow();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const isLoading = data.isLoading || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64 || data.resultVideoUrl || data.resultVideoBase64);
  const hasVideoResult = !!(data.resultVideoUrl || data.resultVideoBase64);
  const hasConnectedImage = !!data.connectedImage;
  const isVideoInput = data.connectedImage ?
    (data.connectedImage.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(data.connectedImage) || data.connectedImage.includes('video')) :
    false;
  const previousConnectedImageRef = useRef<string | undefined>(undefined);
  const scaleFactor = data.scaleFactor ?? 2.0;
  const sharpening = data.sharpening ?? 0.3;
  const [localSharpening, setLocalSharpening] = useState(sharpening);
  const [isSaving, setIsSaving] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [savedMockupId, setSavedMockupId] = useState<string | null>(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);



  // Prioritize R2 URL for MAXIMUM QUALITY display
  // Only use base64 as fallback when R2 URL is not yet available
  const resultImageUrl = data.resultImageUrl || (data.resultImageBase64 ? `data:image/png;base64,${data.resultImageBase64}` : null);
  const resultVideoUrl = data.resultVideoUrl || (data.resultVideoBase64 ? (data.resultVideoBase64.startsWith('data:') ? data.resultVideoBase64 : `data:video/webm;base64,${data.resultVideoBase64}`) : null);

  // Use centralized like hook
  const { toggleLike: handleToggleLike } = useMockupLike({
    mockupId: savedMockupId || undefined,
    isLiked,
    onLikeStateChange: (newIsLiked) => {
      setIsLiked(newIsLiked);
      if (data.onUpdateData) {
        data.onUpdateData(id, {
          isLiked: newIsLiked,
        });
      }
    },
    translationKeyPrefix: 'canvas',
  });

  const handleSave = useCallback(async () => {
    if (!resultImageUrl || isSaving) return;

    // Only save if resultImageUrl is from R2 (not a data URL)
    if (resultImageUrl.startsWith('data:')) {
      toast.error(t('canvasNodes.outputNode.pleaseUseImageFromR2'), { duration: 3000 });
      return;
    }

    // If already saved, toggle like status using hook
    if (savedMockupId) {
      await handleToggleLike();
      return;
    }

    setIsSaving(true);
    try {
      const savedMockup = await mockupApi.save({
        imageUrl: resultImageUrl,
        prompt: 'Upscale Bicubic output',
        designType: 'other',
        tags: [],
        brandingTags: [],
        aspectRatio: '16:9',
        isLiked: true, // Save as liked by default
      });

      const mockupId = savedMockup._id || null;
      setSavedMockupId(mockupId);
      setIsLiked(true);

      // Update node data with saved mockup info
      if (data.onUpdateData) {
        data.onUpdateData(id, {
          savedMockupId: mockupId,
          isLiked: true,
        });
      }

      toast.success(t('canvasNodes.outputNode.imageSavedToFavorites'), { duration: 3000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save image', { duration: 3000 });
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [resultImageUrl, isSaving, savedMockupId, handleToggleLike, data.onUpdateData, id, t]);

  const handleView = useCallback(() => {
    if (resultImageUrl && data.onView) {
      data.onView(resultImageUrl);
    }
  }, [resultImageUrl, data]);

  const handleDescribe = useCallback(async () => {
    if (!resultImageUrl || isDescribing) return;

    // Pass image reference directly to service - conversion handled by service layer
    const imageInput = resultImageUrl || data.resultImageBase64;
    if (!imageInput) return;

    setIsDescribing(true);
    if (data.onUpdateData) {
      data.onUpdateData(id, { isDescribing: true });
    }

    try {
      const generatedDescription = await aiApi.describeImage(imageInput);



      if (data.addTextNode) {
        const currentNode = getNode(id);
        if (currentNode) {
          const currentHeight = currentNode.measured?.height ??
            (currentNode.style?.height as number) ??
            currentNode.height ??
            300;

          const GAP = 50;

          const newNodePosition = {
            x: currentNode.position.x,
            y: currentNode.position.y + currentHeight + GAP,
          };

          data.addTextNode(newNodePosition, generatedDescription, true);
          toast.success(t('canvasNodes.outputNode.imageDescriptionGenerated'), { duration: 2000 });
        } else {
          toast.error('Failed to find node position');
        }
      } else {
        if (data.onUpdateData) {
          data.onUpdateData(id, {
            description: generatedDescription,
          });
        }
        toast.success(t('canvasNodes.outputNode.imageDescriptionGenerated'), { duration: 2000 });
      }

      setIsDescribing(false);
      if (data.onUpdateData) {
        data.onUpdateData(id, { isDescribing: false });
      }
    } catch (error: any) {
      console.error('Failed to describe image:', error);
      toast.error(error?.message || 'Failed to generate description', { duration: 3000 });
      setIsDescribing(false);
      if (data.onUpdateData) {
        data.onUpdateData(id, { isDescribing: false });
      }
    }
  }, [resultImageUrl, isDescribing, data, id, t, getNode]);

  // Sync local sharpening with node data
  useEffect(() => {
    setLocalSharpening(data.sharpening ?? 0.3);
  }, [data.sharpening]);

  // Handle sharpening change
  const handleSharpeningChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setLocalSharpening(value);
  }, []);

  // Commit sharpening change on mouse up or change end
  const handleSharpeningCommit = useCallback(() => {
    if (data.onUpdateData && localSharpening !== sharpening) {
      data.onUpdateData(id, { sharpening: localSharpening });
    }
  }, [data, id, localSharpening, sharpening]);

  // Custom download handler that prioritizes R2 URL for maximum quality
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (hasVideoResult) {
      // Handle video download
      const videoUrl = data.resultVideoUrl || (data.resultVideoBase64 ? (data.resultVideoBase64.startsWith('data:') ? data.resultVideoBase64 : `data:video/webm;base64,${data.resultVideoBase64}`) : null);
      if (!videoUrl) return;

      try {
        // If it's a URL (R2), fetch and download as blob
        if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
          const response = await fetch(videoUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `upscale-bicubic-result-${Date.now()}.webm`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } else {
          // Base64 video
          const link = document.createElement('a');
          link.href = videoUrl;
          link.download = `upscale-bicubic-result-${Date.now()}.webm`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        toast.success(t('canvasNodes.shared.imageDownloaded'), { duration: 2000 });
      } catch (error) {
        console.error('Error downloading video:', error);
        toast.error('Failed to download video');
      }
      return;
    }

    // Handle image download - prioritize R2 URL for maximum quality
    const imageUrlToDownload = data.resultImageUrl || (data.resultImageBase64 ? `data:image/png;base64,${data.resultImageBase64}` : null);
    if (!imageUrlToDownload) return;

    try {
      // If it's a URL (R2), fetch and download as blob for maximum quality
      if (imageUrlToDownload.startsWith('http://') || imageUrlToDownload.startsWith('https://')) {
        const response = await fetch(imageUrlToDownload);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `upscale-bicubic-result-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Base64 image
        const link = document.createElement('a');
        link.href = imageUrlToDownload;
        link.download = `upscale-bicubic-result-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast.success(t('canvasNodes.shared.imageDownloaded'), { duration: 2000 });
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Failed to download image');
    }
  }, [data.resultImageUrl, data.resultImageBase64, data.resultVideoUrl, data.resultVideoBase64, hasVideoResult, t]);

  // Handle image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file, 'image');
    if (error) {
      toast.error(error);
      return;
    }

    try {
      const imageData = await fileToBase64(file);

      // Convert to data URL format
      const dataUrl = `data:${imageData.mimeType};base64,${imageData.base64}`;

      // Update node with uploaded image
      if (data.onUpdateData) {
        data.onUpdateData(id, { connectedImage: dataUrl });
      }

      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }

    // Reset input to allow uploading the same file again
    e.target.value = '';
  }, [data, id]);

  // Auto-apply upscale when image is connected
  useEffect(() => {
    const currentConnectedImage = data.connectedImage;
    const previousConnectedImage = previousConnectedImageRef.current;

    // Check if image changed
    const imageChanged = currentConnectedImage !== previousConnectedImage;
    const isInitialMount = previousConnectedImage === undefined;


    // Only auto-apply if:
    // 1. There's a connected image
    // 2. (Initial mount without result OR the connected image changed)
    // 3. Not currently loading
    // 4. Handler is available
    const shouldApply = currentConnectedImage &&
      !isLoading &&
      data.onApply &&
      (
        (isInitialMount && !hasResult) || // Initial mount: only if no result exists
        imageChanged // Always reapply when image changes
      );

    if (shouldApply) {
      // Update ref immediately to prevent duplicate calls
      previousConnectedImageRef.current = currentConnectedImage;

      // Apply upscale immediately
      data.onApply(id, currentConnectedImage).catch((error) => {
        console.error('[UpscaleBicubicNode] Error auto-applying upscale:', error);
      });
    } else if (!currentConnectedImage) {
      // Clear ref when image is disconnected
      previousConnectedImageRef.current = undefined;
    }
  }, [
    data.connectedImage,
    data.onApply,
    id,
    isLoading,
    hasResult,
  ]);

  const handleApply = async () => {
    if (!data.onApply) {
      return;
    }

    const connectedImageFromData = data.connectedImage;

    if (!connectedImageFromData) {
      return;
    }

    await data.onApply(id, connectedImageFromData);
  };

  const handleFitToContent = useCallback(() => {
    const width = data.imageWidth as number;
    const height = data.imageHeight as number;
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
    }
  }, [id, data.imageWidth, data.imageHeight, data.onResize, fitToContent]);

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
    const { width } = params;
    handleResizeWithDebounce(id, width, 'auto');
  }, [id, handleResizeWithDebounce]);

  const handleDuplicate = () => {
    if (data.onDuplicate) {
      data.onDuplicate(id);
    }
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      onFitToContent={handleFitToContent}
      className="min-w-[320px] w-full h-full flex flex-col"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={320}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          keepAspectRatio={true}
          onResize={handleResize}
        />
      )}
      <NodeHandles />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700/30 bg-gradient-to-r from-neutral-900/60 to-neutral-900/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 shadow-sm">
            <Maximize2 size={16} className="text-brand-cyan" />
          </div>
          <h3 className="text-xs font-semibold text-neutral-200 font-mono tracking-tight uppercase">
            {t('canvasNodes.upscaleNode.title') || 'Upscale'}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          <span className="text-[10px] text-neutral-500 font-mono uppercase  bg-neutral-900/40 px-2 py-0.5 rounded border border-neutral-700/30">
            {scaleFactor}x
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-[var(--node-gap)] flex-1 overflow-hidden">
        {/* Sharpening Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Diamond size={12} className="text-brand-cyan" />
              <span className="text-[10px] font-mono text-neutral-400 uppercase ">Sharpening</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">{Math.round(localSharpening * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={localSharpening}
            onChange={handleSharpeningChange}
            onMouseUp={handleSharpeningCommit}
            onTouchEnd={handleSharpeningCommit}
            className="w-full h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
          />
        </div>

        {/* Status/Info */}
        {!isLoading && hasConnectedImage && !hasResult ? (
          <div className="w-full px-2 py-3 bg-neutral-900/40 border border-neutral-700/30 rounded-md text-[10px] font-mono text-neutral-400 flex items-center justify-center gap-3 uppercase  backdrop-blur-sm">
            <Maximize2 size={14} />
            Ready to upscale
          </div>
        ) : null}

        {/* Floating Processing Indicator */}
        {isLoading && !hasResult && hasConnectedImage && (
          <div className="relative mt-2 min-h-[200px] flex items-center justify-center bg-neutral-950/20 rounded-md border border-neutral-700/30 backdrop-blur-sm">
            <div className="p-3 rounded-md bg-neutral-950/40 backdrop-blur-md border border-brand-cyan/20 shadow-xl">
              <GlitchLoader size={16} color="brand-cyan" />
            </div>
          </div>
        )}

        {!hasConnectedImage ? (
          <div className="w-full space-y-3">
            <div className="w-full px-2 py-3 bg-neutral-900/40 border border-neutral-700/30 rounded-md text-[10px] font-mono text-neutral-500 flex items-center justify-center gap-3 opacity-70 uppercase  backdrop-blur-sm">
              <Maximize2 size={14} />
              Connect an image or video
            </div>
            <label className="w-full px-4 py-2.5 bg-brand-cyan/5 hover:bg-brand-cyan/10 border border-brand-cyan/20 hover:border-brand-cyan/40 rounded-md text-[10px] font-mono font-bold text-brand-cyan flex items-center justify-center gap-2 cursor-pointer transition-all uppercase tracking-widest nodrag shadow-sm backdrop-blur-sm">
              <Upload size={14} />
              Upload Image
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : null}

        {/* Result Display */}
        {hasResult && !isLoading && (
          <div className="space-y-2 flex-1 min-h-[240px] flex flex-col pt-2">
            {hasVideoResult ? (
              <div className="relative w-full h-full bg-neutral-950/20 rounded-md overflow-hidden border border-neutral-700/50 flex-1 min-h-0">
                <video
                  src={resultVideoUrl || undefined}
                  controls
                  className="w-full h-full object-contain"
                  onLoadedMetadata={(e) => {
                    const video = e.target as HTMLVideoElement;
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      if (data.onUpdateData) {
                        data.onUpdateData(String(id), {
                          imageWidth: video.videoWidth,
                          imageHeight: video.videoHeight,
                        });
                      }
                    }
                  }}
                  onError={(e) => {
                    console.error('Video load error:', e);
                  }}
                />
              </div>
            ) : resultImageUrl ? (
              <div className="relative w-full h-full bg-neutral-950/20 rounded-md overflow-hidden border border-neutral-700/50 flex items-center justify-center flex-1 min-h-0">
                <img
                  src={isSafeUrl(resultImageUrl) ? resultImageUrl : ''}
                  alt="Upscaled result"
                  className="w-full h-full object-contain rounded"
                  style={{
                    display: 'block',
                    imageRendering: 'auto', // Use browser's best quality rendering
                    ['WebkitImageSmoothing' as any]: 'high',
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      if (data.onUpdateData) {
                        data.onUpdateData(String(id), {
                          imageWidth: img.naturalWidth,
                          imageHeight: img.naturalHeight,
                        });
                      }
                    }
                  }}
                  loading="eager"
                  decoding="sync"
                  onError={(e) => {
                    console.error('Image load error:', e);
                  }}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!dragging && (resultImageUrl || resultVideoUrl) && (
        <NodeActionBar selected={selected} getZoom={getZoom}>
          {data.onView && (
            <NodeButton variant="ghost" size="xs" onClick={(e) => {
              e.stopPropagation();
              handleView();
            }}
              className="bg-neutral-950/70 hover:bg-neutral-950/60 text-neutral-400 hover:text-neutral-200 transition-colors backdrop-blur-sm border border-neutral-700/30 hover:border-neutral-600/50"
              title={t('canvasNodes.imageNode.viewFullScreen')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Maximize2 size={12} strokeWidth={2} />
            </NodeButton>
          )}
          <NodeButton variant="ghost" size="xs" onClick={handleDownload}
            className="bg-neutral-950/70 hover:bg-neutral-950/60 text-neutral-400 hover:text-neutral-200 transition-colors backdrop-blur-sm border border-neutral-700/30 hover:border-neutral-600/50"
            title={t('canvasNodes.imageNode.downloadImage')}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Download size={12} strokeWidth={2} />
          </NodeButton>
          <NodeButton variant="ghost" size="xs" onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
            disabled={isSaving}
            className={cn(
              "transition-colors backdrop-blur-sm border",
              isSaving
                ? "bg-neutral-950/70 text-neutral-500 cursor-wait border border-neutral-700/30"
                : isLiked
                  ? "bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 border border-[brand-cyan]/20"
                  : "bg-neutral-950/70 hover:bg-neutral-950/60 border border-neutral-700/30"
            )}
            title={isLiked ? t('canvasNodes.outputNode.removeFromFavorites') : t('canvasNodes.outputNode.saveToCollection')}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isSaving ? (
              <GlitchLoader size={12} color="currentColor" />
            ) : (
              <Heart size={12} className={isLiked ? "fill-current" : ""} strokeWidth={2} />
            )}
          </NodeButton>
          {data.onDelete && savedMockupId && (
            <NodeButton variant="ghost" size="xs" onClick={(e) => {
              e.stopPropagation();
              setShowDeleteModal(true);
            }}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors backdrop-blur-sm border border-red-500/30"
              title={t('canvasNodes.imageNode.delete')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Trash2 size={12} strokeWidth={2} />
            </NodeButton>
          )}
          {data.onBrandKit && (resultImageUrl || resultVideoUrl) && (
            <NodeButton variant="ghost" size="xs" onClick={(e) => {
              e.stopPropagation();
              setShowBrandKitModal(true);
            }}
              className="bg-neutral-950/70 hover:bg-neutral-950/60 text-neutral-400 hover:text-neutral-200 transition-colors backdrop-blur-sm border border-neutral-700/30 hover:border-neutral-600/50"
              title={t('canvasNodes.imageNode.brandKit')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Palette size={12} strokeWidth={2} />
            </NodeButton>
          )}
          <NodeButton variant="ghost" size="xs" onClick={(e) => {
            e.stopPropagation();
            handleDescribe();
          }}
            disabled={isDescribing || !resultImageUrl}
            className={cn(
              "transition-colors backdrop-blur-sm border",
              isDescribing || !resultImageUrl
                ? "bg-neutral-700/20 text-neutral-500 cursor-not-allowed border-neutral-700/20"
                : "bg-neutral-950/70 hover:bg-neutral-950/60 border border-neutral-700/30 hover:border-neutral-600/50"
            )}
            title={isDescribing ? t('canvasNodes.imageNode.analyzingImage') : t('canvasNodes.imageNode.describeImageWithAI')}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isDescribing ? (
              <GlitchLoader size={12} color="currentColor" />
            ) : (
              <FileText size={12} strokeWidth={2} />
            )}
          </NodeButton>
        </NodeActionBar>
      )}

      {/* Brand Kit Modal */}
      {data.onBrandKit && (
        <MockupPresetModal
          isOpen={showBrandKitModal}
          selectedPresetId=""
          onClose={() => setShowBrandKitModal(false)}
          onSelectPresets={(presetIds) => {
            data.onBrandKit?.(String(id), presetIds);
            setShowBrandKitModal(false);
          }}
          userMockups={data.userMockups || []}
          isLoading={false}
          multiSelect={true}
          maxSelections={5}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          if (savedMockupId) {
            data.onDelete?.(savedMockupId);
          }
          setShowDeleteModal(false);
        }}
        title={t('canvasNodes.imageNode.deleteMockup')}
        message={t('canvasNodes.imageNode.deleteMockupMessage')}
        confirmText={t('canvasNodes.imageNode.deleteButton')}
        cancelText={t('canvasNodes.imageNode.cancelButton')}
        variant="danger"
      />
    </NodeContainer>
  );
});

UpscaleBicubicNode.displayName = 'UpscaleBicubicNode';

