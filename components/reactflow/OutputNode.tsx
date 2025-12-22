import React, { useRef, useState, useCallback, memo, useEffect } from 'react';
import { type NodeProps, useNodes, useEdges, useReactFlow, NodeResizer } from '@xyflow/react';
import { Maximize2, Heart, Loader2, Download, FileText, Edit, Trash2, Palette } from 'lucide-react';
import type { OutputNodeData, FlowNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { isSafeUrl } from '../../utils/imageUtils';
import { mockupApi } from '../../services/mockupApi';
import { aiApi } from '../../services/aiApi';
import { normalizeImageToBase64 } from '../../services/reactFlowService';
import { toast } from 'sonner';
import { NodeHandles } from './shared/NodeHandles';
import { NodeLabel } from './shared/NodeLabel';
import { NodePlaceholder } from './shared/NodePlaceholder';
import { NodeContainer } from './shared/NodeContainer';
import { NodeImageContainer } from './shared/NodeImageContainer';
import { NodeActionBar } from './shared/NodeActionBar';
import { useNodeDownload } from './shared/useNodeDownload';
import { useTranslation } from '../../hooks/useTranslation';
import { useMockupLike } from '../../hooks/useMockupLike';
import { ConfirmationModal } from '../ConfirmationModal';
import { MockupPresetModal } from '../MockupPresetModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const OutputNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodes = useNodes();
  const edges = useEdges();
  const { getZoom, setNodes, getNode } = useReactFlow();
  const nodeData = data as OutputNodeData;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [savedMockupId, setSavedMockupId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const previousImageUrlRef = useRef<string | null>(null);
  const previousVideoUrlRef = useRef<string | null>(null);
  const loadingStartTimeRef = useRef<number | null>(null);
  const { handleDownload, isDownloading } = useNodeDownload(imageUrl || videoUrl, 'output-media');

  // Extract values from nodeData to avoid object recreation issues in dependencies
  const resultImageUrl = nodeData.resultImageUrl;
  const resultImageBase64 = nodeData.resultImageBase64;
  const resultVideoUrl = nodeData.resultVideoUrl;
  const resultVideoBase64 = nodeData.resultVideoBase64;
  const savedMockupIdFromData = (nodeData as any).savedMockupId;
  const isLikedFromData = (nodeData as any).isLiked;
  const isLoading = nodeData.isLoading || false;

  // Sync state with nodeData
  useEffect(() => {
    if (savedMockupIdFromData !== undefined) {
      setSavedMockupId(savedMockupIdFromData);
    }
    if (isLikedFromData !== undefined) {
      setIsLiked(isLikedFromData);
    }
  }, [savedMockupIdFromData, isLikedFromData]);

  // Timer for loading state
  useEffect(() => {
    if (isLoading) {
      // Start timer when loading begins
      if (loadingStartTimeRef.current === null) {
        loadingStartTimeRef.current = Date.now();
        setElapsedTime(0);
      }

      // Update timer every second
      const interval = setInterval(() => {
        if (loadingStartTimeRef.current !== null) {
          const elapsed = Math.floor((Date.now() - loadingStartTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    } else {
      // Reset timer when loading ends
      loadingStartTimeRef.current = null;
      setElapsedTime(0);
    }
  }, [isLoading]);

  // Lock node deletion while generating (TEMPORARILY REMOVED)
  /*
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          const shouldBeDeletable = !isLoading;
          const isDeletable = node.deletable ?? true;

          if (isDeletable !== shouldBeDeletable) {
            return {
              ...node,
              deletable: shouldBeDeletable,
            };
          }
        }
        return node;
      })
    );
  }, [isLoading, id, setNodes]);
  */

  // Use centralized like hook
  const { toggleLike: handleToggleLike } = useMockupLike({
    mockupId: savedMockupId || undefined,
    isLiked,
    onLikeStateChange: (newIsLiked) => {
      setIsLiked(newIsLiked);
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), {
          isLiked: newIsLiked,
        } as any);
      }
    },
    translationKeyPrefix: 'canvas',
  });

  // Get image from connected source node
  useEffect(() => {
    if (!nodes || !edges) return;

    // PRIORITY 1: Use result from THIS node if available (OutputNode's own memory)
    // This ensures that once an output is generated, it stays fixed and doesn't change when PromptNode updates
    if (resultImageUrl || resultImageBase64) {
      const newImageUrl = resultImageUrl || (resultImageBase64 ? `data:image/png;base64,${resultImageBase64}` : null);
      if (newImageUrl !== previousImageUrlRef.current) {
        previousImageUrlRef.current = newImageUrl;
        setImageUrl(newImageUrl);
        // Reset video state if we have an image result
        setVideoUrl(null);
        setIsVideo(false);
      }
      return;
    }

    // PRIORITY 2: If no result yet, look for connected source node (Preview/Loading state)

    // Find edge connecting to this node
    const incomingEdge = edges.find(e => e.target === id);
    if (!incomingEdge) {
      // No edge and no result -> clear
      if (previousImageUrlRef.current !== null) {
        previousImageUrlRef.current = null;
        setImageUrl(null);
      }
      return;
    }

    // Find source node
    const sourceNode = nodes.find(n => n.id === incomingEdge.source);
    if (!sourceNode) {
      // Source node missing -> keep current state or clear? Better clear if strictly following state.
      // But to avoid flicker, maybe do nothing? Let's clear to be safe state-wise.
      if (previousImageUrlRef.current !== null) {
        previousImageUrlRef.current = null;
        setImageUrl(null);
      }
      return;
    }

    // Get image from source node based on type
    let sourceImageUrl: string | null = null;
    const sourceData = sourceNode.data as FlowNodeData;

    if (sourceData.type === 'merge') {
      sourceImageUrl = (sourceData as any).resultImageUrl ||
        ((sourceData as any).resultImageBase64 ? `data:image/png;base64,${(sourceData as any).resultImageBase64}` : null);
    } else if (sourceData.type === 'edit') {
      sourceImageUrl = (sourceData as any).resultImageUrl ||
        ((sourceData as any).resultImageBase64 ? `data:image/png;base64,${(sourceData as any).resultImageBase64}` : null);
    } else if (sourceData.type === 'upscale') {
      sourceImageUrl = (sourceData as any).resultImageUrl ||
        ((sourceData as any).resultImageBase64 ? `data:image/png;base64,${(sourceData as any).resultImageBase64}` : null);
    } else if (sourceData.type === 'mockup') {
      sourceImageUrl = (sourceData as any).resultImageUrl ||
        ((sourceData as any).resultImageBase64 ? `data:image/png;base64,${(sourceData as any).resultImageBase64}` : null);
    } else if (sourceData.type === 'prompt') {
      sourceImageUrl = (sourceData as any).resultImageUrl ||
        ((sourceData as any).resultImageBase64 ? `data:image/png;base64,${(sourceData as any).resultImageBase64}` : null);
    } else if (sourceData.type === 'video') {
      // Check for video from video node (generated)
      const videoUrl = (sourceData as any).resultVideoUrl;
      const videoBase64 = (sourceData as any).resultVideoBase64;
      if (videoUrl) {
        sourceImageUrl = videoUrl;
      } else if (videoBase64) {
        sourceImageUrl = `data:video/mp4;base64,${videoBase64}`;
      }
    } else if (sourceData.type === 'videoInput') {
      // Check for video from video input node (uploaded)
      const uploadedVideoUrl = (sourceData as any).uploadedVideoUrl;
      const uploadedVideo = (sourceData as any).uploadedVideo;
      if (uploadedVideoUrl) {
        sourceImageUrl = uploadedVideoUrl;
      } else if (uploadedVideo) {
        // uploadedVideo might be a data URL or base64
        if (typeof uploadedVideo === 'string' && uploadedVideo.startsWith('data:')) {
          sourceImageUrl = uploadedVideo;
        } else {
          sourceImageUrl = `data:video/mp4;base64,${uploadedVideo}`;
        }
      }
    } else if (sourceData.type === 'output') {
      // Check for video first, then image
      const outputVideoUrl = (sourceData as any).resultVideoUrl;
      const outputVideoBase64 = (sourceData as any).resultVideoBase64;
      if (outputVideoUrl) {
        sourceImageUrl = outputVideoUrl;
      } else if (outputVideoBase64) {
        sourceImageUrl = `data:video/mp4;base64,${outputVideoBase64}`;
      } else {
        sourceImageUrl = (sourceData as any).resultImageUrl ||
          ((sourceData as any).resultImageBase64 ? `data:image/png;base64,${(sourceData as any).resultImageBase64}` : null);
      }
    }

    // Check if we have video data
    const hasVideo = !!(resultVideoUrl || resultVideoBase64 ||
      (sourceData?.type === 'video' && ((sourceData as any).resultVideoUrl || (sourceData as any).resultVideoBase64)) ||
      (sourceData?.type === 'videoInput' && ((sourceData as any).uploadedVideoUrl || (sourceData as any).uploadedVideo)) ||
      (sourceData?.type === 'output' && ((sourceData as any).resultVideoUrl || (sourceData as any).resultVideoBase64)));

    if (hasVideo) {
      // Check if resultVideoBase64 is already a data URL (starts with "data:")
      const videoBase64Url = resultVideoBase64
        ? (typeof resultVideoBase64 === 'string' && resultVideoBase64.startsWith('data:')
          ? resultVideoBase64
          : `data:video/mp4;base64,${resultVideoBase64}`)
        : null;

      const newVideoUrl = resultVideoUrl || videoBase64Url || sourceImageUrl;


      if (newVideoUrl && newVideoUrl !== previousVideoUrlRef.current) {
        previousVideoUrlRef.current = newVideoUrl;
        setVideoUrl(newVideoUrl);
        setImageUrl(null);
        setIsVideo(true);
      }
    } else {
      const newImageUrl = sourceImageUrl; // Only use source if we didn't have a result (handled at top)

      if (newImageUrl !== previousImageUrlRef.current) {
        previousImageUrlRef.current = newImageUrl;
        setImageUrl(newImageUrl);
        setVideoUrl(null);
        setIsVideo(false);
      }
    }
  }, [nodes, edges, id, resultImageUrl, resultImageBase64, resultVideoUrl, resultVideoBase64]);

  const handleSave = useCallback(async () => {
    if (!imageUrl || isSaving) return;

    // Only save if imageUrl is from R2 (not a data URL)
    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
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
        imageUrl: imageUrl,
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
        } as any);
      }

      toast.success(t('canvasNodes.outputNode.imageSavedToFavorites'), { duration: 3000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save image', { duration: 3000 });
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [imageUrl, isSaving, savedMockupId, handleToggleLike]);

  const handleView = useCallback(() => {
    if (imageUrl && nodeData.onView) {
      nodeData.onView(imageUrl);
    }
  }, [imageUrl, nodeData]);

  const handleDescribe = useCallback(async () => {
    if (!imageUrl || isDescribing) return;

    // Get image base64 from URL or use base64 fallback
    let imageInput: string | { base64: string; mimeType: string };

    // Check for base64 fallback first (from resultImageBase64)
    const outputData = nodeData as any;
    const base64Fallback = outputData.resultImageBase64;

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
      // Already a data URL, use directly
      imageInput = imageUrl;
    } else if (base64Fallback && typeof base64Fallback === 'string') {
      // Use base64 fallback if available (avoids fetch)
      const cleanBase64 = base64Fallback.startsWith('data:')
        ? base64Fallback.split(',')[1] || base64Fallback
        : base64Fallback;
      // Try to detect mimeType from URL or default to png
      let mimeType = 'image/png';
      if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (imageUrl.includes('.webp')) {
        mimeType = 'image/webp';
      } else if (imageUrl.includes('.gif')) {
        mimeType = 'image/gif';
      }
      imageInput = {
        base64: cleanBase64,
        mimeType: mimeType,
      };
    } else {
      // Convert URL to base64 using utility function (with base64 fallback if available)
      try {
        const base64 = await normalizeImageToBase64(imageUrl, base64Fallback);
        // Try to detect mimeType from URL or default to png
        let mimeType = 'image/png';
        if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (imageUrl.includes('.webp')) {
          mimeType = 'image/webp';
        } else if (imageUrl.includes('.gif')) {
          mimeType = 'image/gif';
        }
        imageInput = {
          base64: base64,
          mimeType: mimeType,
        };
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load image for analysis', { duration: 3000 });
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
          toast.error('Failed to find node position');
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
      toast.error(error?.message || 'Failed to generate description', { duration: 3000 });

      // Clear loading state on error
      setIsDescribing(false);
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), { isDescribing: false });
      }
    }
  }, [imageUrl, isDescribing, nodeData, id]);

  const handleResize = useCallback((_: any, params: { width: number; height: number; x: number; y: number }) => {
    const { width, height } = params;
    setNodes((nds) => {
      return nds.map((n) => {
        if (n.id === id) {
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
  }, [id, setNodes]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      containerRef={containerRef}
      warning={nodeData.oversizedWarning}
      className={cn(
        'group node-wrapper min-w-[400px]',
        dragging ? 'node-dragging' : 'node-dragging-static'
      )}
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#52ddeb"
          isVisible={selected}
          minWidth={400}
          minHeight={300}
          maxWidth={2000}
          maxHeight={2000}
          onResize={handleResize}
        />
      )}
      <NodeHandles />

      <NodeImageContainer className="flex items-center justify-center" style={{ width: '100%', height: '100%', flex: '1 1 0%', minHeight: 0 }}>
        {isVideo && videoUrl ? (
          <div className="relative flex items-center justify-center group/video" style={{ width: '100%', height: '100%' }}>
            <video
              src={videoUrl}
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
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              Your browser does not support the video tag.
            </video>
            {isLoading && elapsedTime > 0 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
                <span className="text-zinc-500/40 text-[10px] font-mono">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        ) : imageUrl ? (
          <div className="relative flex items-center justify-center group/image" style={{ width: '100%', height: '100%' }}>
            <img
              src={imageUrl && (isSafeUrl(imageUrl) || imageUrl.startsWith('http') || imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) ? imageUrl : ''}
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
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target) {
                  target.style.display = 'none';
                }
              }}
            />
            {/* Save and View buttons overlay */}
            <div
              className={cn(
                "absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity z-10",
                selected ? "opacity-100" : "group-hover/image:opacity-100"
              )}
              style={{ transform: `scale(${Math.min(1 / getZoom(), 3)})`, transformOrigin: 'top right' }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDescribe();
                }}
                disabled={isDescribing || !imageUrl}
                className={cn(
                  "p-1 rounded-md transition-all backdrop-blur-sm",
                  isDescribing || !imageUrl
                    ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed"
                    : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200"
                )}
                title={isDescribing ? t('canvasNodes.outputNode.analyzingImage') : t('canvasNodes.outputNode.describeImageWithAI')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isDescribing ? (
                  <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                ) : (
                  <FileText size={12} strokeWidth={2} />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                disabled={isSaving}
                className={cn(
                  "p-1 rounded-md transition-all backdrop-blur-sm",
                  isSaving
                    ? "bg-black/40 text-zinc-500 cursor-wait border border-zinc-700/30"
                    : isLiked
                      ? "bg-[#52ddeb]/20 text-[#52ddeb] hover:bg-[#52ddeb]/30 border border-[#52ddeb]/20"
                      : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30"
                )}
                title={isLiked ? t('canvasNodes.outputNode.removeFromFavorites') : t('canvasNodes.outputNode.saveToCollection')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isSaving ? (
                  <Loader2 size={12} className="animate-spin" strokeWidth={2} />
                ) : (
                  <Heart size={12} className={isLiked ? "fill-current" : ""} strokeWidth={2} />
                )}
              </button>
            </div>
            {isLoading && elapsedTime > 0 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
                <span className="text-zinc-500/40 text-[10px] font-mono">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <NodePlaceholder
            isLoading={isLoading}
            emptyMessage={t('canvasNodes.outputNode.noOutput')}
            emptySubmessage="Connect a node to see result"
            elapsedTime={isLoading ? elapsedTime : 0}
          />
        )}
      </NodeImageContainer>

      {!dragging && (imageUrl || videoUrl) && (
        <NodeActionBar selected={selected} getZoom={getZoom}>
          {nodeData.onView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleView();
              }}
              className="p-1 bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 rounded transition-colors backdrop-blur-sm border border-zinc-700/30 hover:border-zinc-600/50"
              title={t('canvasNodes.imageNode.viewFullScreen')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Maximize2 size={12} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={cn(
              "p-1 rounded transition-colors backdrop-blur-sm border",
              isDownloading
                ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed border-zinc-700/20"
                : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30 hover:border-zinc-600/50"
            )}
            title={isDownloading ? t('canvasNodes.shared.downloading') : t('canvasNodes.imageNode.downloadImage')}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isDownloading ? (
              <Loader2 size={12} strokeWidth={2} className="animate-spin" />
            ) : (
              <Download size={12} strokeWidth={2} />
            )}
          </button>
          {nodeData.onDelete && savedMockupId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteModal(true);
              }}
              className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors backdrop-blur-sm border border-red-500/20 hover:border-red-500/30"
              title={t('canvasNodes.imageNode.delete')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          )}
          {nodeData.onBrandKit && (imageUrl || videoUrl) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBrandKitModal(true);
              }}
              className="p-1 bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 rounded transition-colors backdrop-blur-sm border border-zinc-700/30 hover:border-zinc-600/50"
              title={t('canvasNodes.imageNode.brandKit')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Palette size={12} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDescribe();
            }}
            disabled={isDescribing || !imageUrl}
            className={cn(
              "p-1 rounded transition-colors backdrop-blur-sm border",
              isDescribing || !imageUrl
                ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed border-zinc-700/20"
                : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border-zinc-700/30 hover:border-zinc-600/50"
            )}
            title={isDescribing ? t('canvasNodes.imageNode.analyzingImage') : t('canvasNodes.imageNode.describeImageWithAI')}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isDescribing ? (
              <Loader2 size={12} strokeWidth={2} className="animate-spin" />
            ) : (
              <FileText size={12} strokeWidth={2} />
            )}
          </button>
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

