import React, { useRef, useState, useCallback, memo, useEffect, useMemo } from 'react';
import { type NodeProps, useNodes, useEdges, useReactFlow, NodeResizer } from '@xyflow/react';
import { Maximize2 } from 'lucide-react';
import type { OutputNodeData, FlowNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { mockupApi } from '@/services/mockupApi';
import { aiApi } from '@/services/aiApi';
import { normalizeImageToBase64 } from '@/services/reactFlowService';
import { toast } from 'sonner';
import { NodeHandles } from './shared/NodeHandles';
import { NodeContainer } from './shared/NodeContainer';
import { NodeImageContainer } from './shared/NodeImageContainer';
import { NodePlaceholder } from './shared/NodePlaceholder';
import { NodeActionBar } from './shared/NodeActionBar';
import { ImageNodeActionButtons } from './shared/ImageNodeActionButtons';
import { isSafeUrl } from '@/utils/imageUtils';
import { useNodeDownload } from './shared/useNodeDownload';
import { useTranslation } from '@/hooks/useTranslation';
import { useMockupLike } from '@/hooks/useMockupLike';
import { ConfirmationModal } from '../ConfirmationModal';
import { MockupPresetModal } from '../MockupPresetModal';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { useMediaSource } from '@/hooks/canvas/useMediaSource';
import { NODE_LAYOUT } from '@/constants/nodeLayout';
import { useBaseNode } from '@/hooks/canvas/useBaseNode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const OutputNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodes = useNodes();
  const edges = useEdges();
  const { getNode, getZoom } = useReactFlow();
  const nodeData = data as OutputNodeData;
  const { handleResize: baseResize, handleFitToContent: baseFitToContent } = useBaseNode(id, nodeData);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLiked, setIsLiked] = useState(nodeData.isLiked || false);
  const [savedMockupId, setSavedMockupId] = useState<string | null>(nodeData.savedMockupId || null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const loadingStartTimeRef = useRef<number | null>(null);

  const isLoading = nodeData.isLoading || false;

  // Track elapsed time during loading
  useEffect(() => {
    if (isLoading) {
      loadingStartTimeRef.current = Date.now();
      const interval = setInterval(() => {
        if (loadingStartTimeRef.current) {
          setElapsedTime(Math.floor((Date.now() - loadingStartTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      loadingStartTimeRef.current = null;
      setElapsedTime(0);
    }
  }, [isLoading]);

  // Use centralized media source hook - replaces 130+ lines of useEffect
  const ownResult = useMemo(() => ({
    imageUrl: nodeData.resultImageUrl,
    imageBase64: nodeData.resultImageBase64,
    videoUrl: nodeData.resultVideoUrl,
    videoBase64: nodeData.resultVideoBase64,
  }), [nodeData.resultImageUrl, nodeData.resultImageBase64, nodeData.resultVideoUrl, nodeData.resultVideoBase64]);

  const mediaSource = useMediaSource({
    nodeId: id,
    nodes: nodes as any,
    edges,
    ownResult,
  });

  const mediaUrl = mediaSource.url;
  const isVideo = mediaSource.isVideo;
  const { handleDownload, isDownloading } = useNodeDownload(mediaUrl, 'output-media');

  // Sync state with nodeData
  useEffect(() => {
    if (nodeData.savedMockupId !== undefined) {
      setSavedMockupId(nodeData.savedMockupId);
    }
    if (nodeData.isLiked !== undefined) {
      setIsLiked(nodeData.isLiked);
    }
  }, [nodeData.savedMockupId, nodeData.isLiked]);

  // Use centralized like hook
  const { toggleLike: handleToggleLike } = useMockupLike({
    mockupId: savedMockupId || undefined,
    isLiked,
    onLikeStateChange: (newIsLiked) => {
      setIsLiked(newIsLiked);
      nodeData.onUpdateData(String(id), {
        isLiked: newIsLiked,
      });
    },
    translationKeyPrefix: 'canvas',
  });

  const handleSave = useCallback(async () => {
    if (!mediaUrl || isSaving) return;

    // Only save if mediaUrl is from R2 (not a data URL)
    if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
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
        imageUrl: mediaUrl,
        prompt: 'Canvas output image',
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
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), {
          savedMockupId: mockupId,
          isLiked: true,
        });
      }

      toast.success(t('canvasNodes.outputNode.imageSavedToFavorites'), { duration: 3000 });
    } catch (error: any) {
      toast.error(error?.message || t('common.failedToSaveImage'), { duration: 3000 });
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [mediaUrl, isSaving, savedMockupId, handleToggleLike]);

  const handleView = useCallback(() => {
    if (mediaUrl && nodeData.onView) {
      nodeData.onView(mediaUrl);
    }
  }, [mediaUrl, nodeData]);

  const handleDescribe = useCallback(async () => {
    if (!mediaUrl || isDescribing) return;

    // Get image base64 from URL or use base64 fallback
    let imageInput: string | { base64: string; mimeType: string };

    // Check for base64 fallback first (from resultImageBase64)
    const base64Fallback = nodeData.resultImageBase64;

    if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
      // Already a data URL, use directly
      imageInput = mediaUrl;
    } else if (base64Fallback && typeof base64Fallback === 'string') {
      // Use base64 fallback if available (avoids fetch)
      const cleanBase64 = base64Fallback.startsWith('data:')
        ? base64Fallback.split(',')[1] || base64Fallback
        : base64Fallback;
      // Try to detect mimeType from URL or default to png
      let mimeType = 'image/png';
      if (mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (mediaUrl.includes('.webp')) {
        mimeType = 'image/webp';
      } else if (mediaUrl.includes('.gif')) {
        mimeType = 'image/gif';
      }
      imageInput = {
        base64: cleanBase64,
        mimeType: mimeType,
      };
    } else {
      // Convert URL to base64 using utility function (with base64 fallback if available)
      try {
        const base64 = await normalizeImageToBase64(mediaUrl, base64Fallback);
        // Try to detect mimeType from URL or default to png
        let mimeType = 'image/png';
        if (mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (mediaUrl.includes('.webp')) {
          mimeType = 'image/webp';
        } else if (mediaUrl.includes('.gif')) {
          mimeType = 'image/gif';
        }
        imageInput = {
          base64: base64,
          mimeType: mimeType,
        };
      } catch (error: any) {
        toast.error(error?.message || t('canvas.failedToLoadImageForAnalysis'), { duration: 3000 });
        console.error('Failed to convert image to base64:', error);
        return;
      }
    }

    // Set loading state
    setIsDescribing(true);
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(String(id), { isDescribing: true });
    }

    try {
      const generatedDescription = await aiApi.describeImage(imageInput);

      if (nodeData.addTextNode) {
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

          nodeData.addTextNode(newNodePosition, generatedDescription, true);
          toast.success(t('canvasNodes.outputNode.imageDescriptionGenerated'), { duration: 2000 });
        } else {
          // Fallback if node not found
          toast.error(t('canvas.sourceNodeNotFound'));
        }
      } else {
        // Fallback to internal update if addTextNode not available
        if (nodeData.onUpdateData) {
          nodeData.onUpdateData(String(id), {
            description: generatedDescription,
          });
        }
        toast.success(t('canvasNodes.outputNode.imageDescriptionGenerated'), { duration: 2000 });
      }

      setIsDescribing(false);
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), { isDescribing: false });
      }
    } catch (error: any) {
      console.error('Failed to describe image:', error);
      toast.error(error?.message || t('canvas.failedToGenerateDescription'), { duration: 3000 });

      // Clear loading state on error
      setIsDescribing(false);
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), { isDescribing: false });
      }
    }
  }, [mediaUrl, isDescribing, nodeData, id]);

  // Handle resize from NodeResizer
  const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
    baseResize(params.width, params.height);
  }, [baseResize]);

  const handleDuplicate = () => {
    if (nodeData.onDuplicate) {
      nodeData.onDuplicate(id);
    }
  };

  const handleFitToContent = useCallback(() => {
    baseFitToContent();
  }, [baseFitToContent]);

  const hasMedia = !!mediaUrl;

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      containerRef={containerRef}
      warning={nodeData.oversizedWarning}
      onFitToContent={handleFitToContent}
      className={cn(
        'group',
        `min-w-[${NODE_LAYOUT.MIN_WIDTH}px]`,
        dragging ? 'node-dragging' : 'node-dragging-static'
      )}
      style={hasMedia ? { opacity: 1 } : undefined}
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
          keepAspectRatio={true}
          onResize={handleResize}
        />
      )}
      <NodeHandles />

      <NodeImageContainer className="flex items-center justify-center" style={{ width: '100%', height: '100%', flex: '1 1 0%', minHeight: 0 }}>
        {isVideo && mediaUrl ? (
          <div className="relative flex items-center justify-center group/video" style={{ width: '100%', height: '100%' }}>
            <video
              src={mediaUrl}
              controls
              className={cn(
                'object-contain rounded-md node-image',
                dragging ? 'node-image-dragging' : 'node-image-static'
              )}
              style={{
                width: '100%',
                height: '100%',
              }}
              onContextMenu={(e) => {
                // Allow ReactFlow to handle the context menu event
              }}
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  if (nodeData.onUpdateData) {
                    nodeData.onUpdateData(String(id), {
                      imageWidth: video.videoWidth,
                      imageHeight: video.videoHeight,
                    });
                  }
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              Your browser does not support the video tag.
            </video>
            {isLoading && elapsedTime > 0 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
                <span className="text-neutral-500/40 text-[10px] font-mono">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        ) : mediaUrl ? (
          <div className="relative flex items-center justify-center group/image" style={{ width: '100%', height: '100%' }}>
            <img
              src={mediaUrl && (isSafeUrl(mediaUrl) || mediaUrl.startsWith('http') || mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:')) ? mediaUrl : ''}
              alt="Output"
              className={cn(
                'object-contain rounded-md node-image',
                dragging ? 'node-image-dragging' : 'node-image-static'
              )}
              style={{
                width: '100%',
                height: '100%',
              }}
              draggable={false}
              onContextMenu={(e) => {
                // Allow ReactFlow to handle the context menu event
              }}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  if (nodeData.onUpdateData) {
                    nodeData.onUpdateData(String(id), {
                      imageWidth: img.naturalWidth,
                      imageHeight: img.naturalHeight,
                    });
                  }
                }
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target) {
                  target.style.display = 'none';
                }
              }}
            />
            {isLoading && elapsedTime > 0 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
                <span className="text-neutral-500/40 text-[10px] font-mono">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <NodePlaceholder
            isLoading={isLoading}
            emptyMessage={t('canvasNodes.outputNode.noOutput')}
            emptySubmessage={t('canvasNodes.outputNode.connectNodeToSeeResult')}
            elapsedTime={isLoading ? elapsedTime : 0}
          />
        )}
      </NodeImageContainer>

      {!dragging && mediaUrl && (
        <NodeActionBar selected={selected} getZoom={getZoom}>
          <ImageNodeActionButtons
            onView={handleView}
            showView={!!nodeData.onView}
            onDownload={handleDownload}
            isDownloading={isDownloading}
            showDownload={true}
            onDelete={() => setShowDeleteModal(true)}
            showDelete={!!(nodeData.onDelete && savedMockupId)}
            onBrandKit={() => setShowBrandKitModal(true)}
            showBrandKit={!!(nodeData.onBrandKit && mediaUrl)}
            onSave={() => handleSave()}
            isLiked={isLiked}
            isSaving={isSaving}
            showLike={true}
            onDescribe={handleDescribe}
            isDescribing={isDescribing}
            describeDisabled={!mediaUrl}
            showDescribe={true}
            translationKeyPrefix="canvasNodes.outputNode"
            t={t}
          />
        </NodeActionBar>
      )}

      {/* Brand Kit Modal */}
      {nodeData.onBrandKit && (
        <MockupPresetModal
          isOpen={showBrandKitModal}
          selectedPresetId=""
          onClose={() => setShowBrandKitModal(false)}
          onSelectPresets={(presetIds) => {
            nodeData.onBrandKit?.(String(id), presetIds);
            setShowBrandKitModal(false);
          }}
          userMockups={nodeData.userMockups || []}
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
            nodeData.onDelete?.(savedMockupId);
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
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if important props changed
  const prevData = prevProps.data as OutputNodeData;
  const nextData = nextProps.data as OutputNodeData;

  // Compare important fields
  if (prevData.resultImageUrl !== nextData.resultImageUrl ||
    prevData.resultImageBase64 !== nextData.resultImageBase64 ||
    prevData.resultVideoUrl !== nextData.resultVideoUrl ||
    prevData.resultVideoBase64 !== nextData.resultVideoBase64 ||
    prevData.isLoading !== nextData.isLoading ||
    prevData.onView !== nextData.onView ||
    prevProps.selected !== nextProps.selected ||
    prevProps.dragging !== nextProps.dragging ||
    prevProps.id !== nextProps.id) {
    return false; // Re-render
  }

  return true; // Skip re-render
});

