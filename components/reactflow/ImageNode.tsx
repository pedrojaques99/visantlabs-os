import React, { useRef, useState, useCallback, memo, useEffect } from 'react';
import { type NodeProps, useNodes, useEdges, useReactFlow, NodeResizer } from '@xyflow/react';
import { Trash2, Maximize2, Upload, UploadCloud, Heart, Download, FileText, Copy, X, Palette } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { ImageNodeData } from '../../types/reactFlow';
import { getImageUrl } from '../../utils/imageUtils';
import { cn } from '../../lib/utils';
import { mockupApi } from '../../services/mockupApi';
import { aiApi } from '../../services/aiApi';
import { normalizeImageToBase64 } from '../../services/reactFlowService';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';
import { Textarea } from '../ui/textarea';
import { NodeHandles } from './shared/NodeHandles';
import { NodeLabel } from './shared/NodeLabel';
import { NodePlaceholder } from './shared/NodePlaceholder';
import { NodeContainer } from './shared/NodeContainer';
import { NodeImageContainer } from './shared/NodeImageContainer';
import { NodeActionBar } from './shared/NodeActionBar';
import { useNodeDownload } from './shared/useNodeDownload';
import { MockupPresetModal } from '../MockupPresetModal';
import { useTranslation } from '../../hooks/useTranslation';
import { useMockupLike } from '../../hooks/useMockupLike';
import { NodeButton } from './shared/node-button';
import { fileToBase64 } from '../../utils/fileUtils';
import { useNodeResize } from '../../hooks/canvas/useNodeResize';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ImageNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodes = useNodes();
  const edges = useEdges();
  const { setNodes, getZoom, getNode } = useReactFlow();
  const nodeData = data as ImageNodeData;
  const imageUrl = getImageUrl(nodeData.mockup);
  const mockupId = nodeData.mockup._id || '';
  const nodeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [localDescription, setLocalDescription] = useState(nodeData.description || '');
  const [imageScale, setImageScale] = useState(nodeData.imageScale ?? 1.0);
  const isSaved = !!mockupId;
  const isLiked = nodeData.mockup.isLiked || false;
  const isGenerating = nodeData.isGenerating || false;
  const isDescribing = nodeData.isDescribing || false;
  const description = nodeData.description || localDescription;
  const { handleDownload, isDownloading } = useNodeDownload(imageUrl, 'generated-image');
  const { handleResize: handleResizeWithDebounce } = useNodeResize();

  // Use centralized like hook
  const { toggleLike: handleToggleLike } = useMockupLike({
    mockupId: nodeData.mockup._id || undefined,
    isLiked,
    onLikeStateChange: (newIsLiked) => {
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), {
          mockup: { ...nodeData.mockup, isLiked: newIsLiked },
        } as any);
      }
    },
    translationKeyPrefix: 'canvasNodes.imageNode',
  });

  // Sync local description with node data
  useEffect(() => {
    if (nodeData.description !== undefined) {
      setLocalDescription(nodeData.description);
    }
  }, [nodeData.description]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (descriptionTextareaRef.current) {
      descriptionTextareaRef.current.style.height = 'auto';
      descriptionTextareaRef.current.style.height = `${descriptionTextareaRef.current.scrollHeight}px`;
    }
  }, [description]);

  // Sync imageScale with node data
  useEffect(() => {
    if (nodeData.imageScale !== undefined) {
      setImageScale(nodeData.imageScale);
    }
  }, [nodeData.imageScale]);

  // Track previous dimensions to avoid unnecessary re-runs
  const prevDimensionsRef = useRef<{ width?: number; height?: number }>({});

  // Auto-resize node to match image aspect ratio when dimensions are available
  useEffect(() => {
    if (!imageUrl || !nodeData.imageWidth || !nodeData.imageHeight) return;

    const aspectRatio = nodeData.imageWidth / nodeData.imageHeight;

    // Skip if dimensions haven't changed
    if (
      prevDimensionsRef.current.width === nodeData.imageWidth &&
      prevDimensionsRef.current.height === nodeData.imageHeight
    ) {
      return;
    }

    // Update ref with current dimensions
    prevDimensionsRef.current = {
      width: nodeData.imageWidth,
      height: nodeData.imageHeight,
    };

    // Get current node using getNode instead of searching through nodes array
    const currentNode = getNode(id);

    if (currentNode && aspectRatio > 0) {
      const currentWidth = (currentNode.style?.width as number) || currentNode.width || 300;
      const currentHeight = (currentNode.style?.height as number) || currentNode.height;
      const expectedHeight = currentWidth / aspectRatio;

      // Only resize if height doesn't match aspect ratio (within 5px tolerance)
      const heightDiff = currentHeight ? Math.abs(currentHeight - expectedHeight) : Infinity;

      if (!currentHeight || heightDiff > 5) {
        const newHeight = Math.max(150, Math.min(2000, expectedHeight));

        setNodes((nds) => {
          return nds.map((n) => {
            if (n.id === id && n.type === 'image') {
              return {
                ...n,
                style: {
                  ...n.style,
                  width: currentWidth,
                  height: newHeight,
                },
              };
            }
            return n;
          });
        });

        if (nodeData.onResize) {
          nodeData.onResize(id, currentWidth, newHeight);
        }
      }
    }
  }, [imageUrl, nodeData.imageWidth, nodeData.imageHeight, id, getNode, setNodes, nodeData]);

  // Store image dimensions (resizing is handled by useEffect)
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !imageUrl) return;

    const img = imageRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (naturalWidth > 0 && naturalHeight > 0) {
      // Store image dimensions in node data
      // The useEffect watching imageWidth/imageHeight will handle resizing
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), {
          imageWidth: naturalWidth,
          imageHeight: naturalHeight,
        });
      }
    }
  }, [imageUrl, id, nodeData]);

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  // Check if this image was generated (connected from a generating node)
  // Compute directly without state/useEffect to avoid infinite loops
  // Extract source node type inline - this is fast and avoids state updates
  const isGenerated = (() => {
    if (!imageUrl || !edges?.length || !nodes?.length) {
      return false;
    }

    const incomingEdge = edges.find(e => e.target === id);
    if (!incomingEdge) {
      return false;
    }

    const sourceNode = nodes.find(n => n.id === incomingEdge.source);
    if (!sourceNode) {
      return false;
    }

    // Check if source is a generating node type
    const generatingTypes = ['merge', 'edit', 'upscale', 'mockup', 'prompt'];
    return generatingTypes.includes(sourceNode.type || '');
  })();



  const handleSave = useCallback(async () => {
    if (!imageUrl || isSaving || isSaved) return;

    // Only save if imageUrl is from R2 (not a data URL)
    if (imageUrl.startsWith('data:')) {
      toast.error(t('canvasNodes.imageNode.pleaseUseImageFromR2'), { duration: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      const savedMockup = await mockupApi.save({
        imageUrl: imageUrl, // Use only R2 URL, no base64
        prompt: nodeData.mockup.prompt || t('canvasNodes.imageNode.canvasImage'),
        designType: nodeData.mockup.designType || 'other',
        tags: nodeData.mockup.tags || [],
        brandingTags: nodeData.mockup.brandingTags || [],
        aspectRatio: nodeData.mockup.aspectRatio || '16:9',
        isLiked: isLiked,
      });

      // Update node data with saved mockup ID
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), {
          mockup: { ...nodeData.mockup, _id: savedMockup._id, imageUrl: imageUrl, isLiked: isLiked },
        } as any);
      }

      toast.success(t('canvasNodes.imageNode.imageSavedSuccessfully'), { duration: 3000 });
    } catch (error: any) {
      toast.error(error?.message || t('canvasNodes.imageNode.failedToSaveImage'), { duration: 3000 });
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [imageUrl, isSaving, isSaved, isLiked, nodeData, id]);


  const handleDescribe = useCallback(async () => {
    if (!imageUrl || isDescribing || !nodeData.addTextNode) return;

    // Get image base64 from mockup or convert from URL
    let imageInput: string | { base64: string; mimeType: string };

    // Prefer imageBase64 from mockup if available
    if (nodeData.mockup.imageBase64) {
      const base64 = nodeData.mockup.imageBase64.trim();
      // Remove data URL prefix if present
      const cleanBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
      imageInput = {
        base64: cleanBase64,
        mimeType: nodeData.mockup.mimeType || 'image/png',
      };
    } else if (imageUrl.startsWith('data:')) {
      // Already a data URL, use directly
      imageInput = imageUrl;
    } else {
      // Convert URL to base64 using utility function (with base64 fallback if available)
      try {
        const base64Fallback = nodeData.mockup.imageBase64;
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
        toast.error(error?.message || t('canvas.failedToLoadImageForAnalysis'), { duration: 3000 });
        console.error('Failed to convert image to base64:', error);
        return;
      }
    }

    // Set loading state
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(String(id), { isDescribing: true });
    }

    try {
      const generatedDescription = await aiApi.describeImage(imageInput);

      // Get current node position
      const currentNode = nodes.find(n => n.id === id);
      if (!currentNode) {
        toast.error(t('canvasNodes.imageNode.failedToFindCurrentNode'), { duration: 3000 });
        if (nodeData.onUpdateData) {
          nodeData.onUpdateData(String(id), { isDescribing: false });
        }
        return;
      }

      // Calculate dynamic offset based on node height
      // Use measured height if available, otherwise fallback to style height or default
      const currentHeight = currentNode.measured?.height ??
        (currentNode.style?.height as number) ??
        currentNode.height ??
        300;

      const GAP = 50;

      // Create TextNode below the ImageNode
      // We pass the position in flow coordinates with isFlowPosition=true
      const newNodePosition = {
        x: currentNode.position.x,
        y: currentNode.position.y + currentHeight + GAP,
      };

      // Validate position before creating node
      if (isNaN(newNodePosition.x) || isNaN(newNodePosition.y)) {
        toast.error(t('canvasNodes.imageNode.invalidNodePosition'), { duration: 3000 });
        if (nodeData.onUpdateData) {
          nodeData.onUpdateData(String(id), { isDescribing: false });
        }
        return;
      }

      const newNodeId = nodeData.addTextNode(newNodePosition, generatedDescription, true);

      if (newNodeId) {
        toast.success(t('canvas.imageDescriptionGenerated'), { duration: 2000 });
      } else {
        toast.error(t('canvasNodes.imageNode.failedToCreateTextNode'), { duration: 3000 });
      }

      // Clear loading state
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), { isDescribing: false });
      }
    } catch (error: any) {
      console.error('Failed to describe image:', error);
      toast.error(error?.message || t('canvas.failedToGenerateDescription'), { duration: 3000 });

      // Clear loading state on error
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(String(id), { isDescribing: false });
      }
    }
  }, [imageUrl, isDescribing, nodeData, id, nodes]);

  const handleDescriptionChange = useCallback((value: string) => {
    setLocalDescription(value);
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(String(id), { description: value });
    }
  }, [nodeData, id]);

  const handleCopyDescription = useCallback(() => {
    if (!description) return;
    navigator.clipboard.writeText(description);
    toast.success(t('canvasNodes.imageNode.descriptionCopied'), { duration: 2000 });
  }, [description]);

  const handleClearDescription = useCallback(() => {
    setLocalDescription('');
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(String(id), { description: undefined });
    }
    toast.success(t('canvasNodes.imageNode.descriptionCleared'), { duration: 2000 });
  }, [nodeData, id]);

  const handleScaleChange = useCallback((newScale: number) => {
    const clampedScale = Math.max(0.25, Math.min(2.0, newScale));
    setImageScale(clampedScale);
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(String(id), { imageScale: clampedScale });
    }
  }, [nodeData, id]);

  // Handle image upload
  const handleUploadClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    imageInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUpload) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('upload.unsupportedFileType') || 'Please select an image file', { duration: 3000 });
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('upload.imageTooLarge')?.replace('{size}', (file.size / 1024 / 1024).toFixed(2)).replace('{max}', '10') || 'File size exceeds 10MB limit', { duration: 5000 });
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }

    try {
      const imageData = await fileToBase64(file);
      nodeData.onUpload(id, imageData.base64);
      toast.success(t('canvasNodes.imageNode.uploadImageTitle') || 'Image uploaded successfully!', { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || t('upload.couldNotProcess') || 'Failed to process image', { duration: 5000 });
      console.error('Failed to process image:', error);
    }
  }, [nodeData, id, t]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      containerRef={containerRef}
      warning={nodeData.oversizedWarning}
      className={cn(
        'group node-wrapper',
        dragging ? 'node-dragging' : 'node-dragging-static',
        imageUrl && 'p-0'
      )}
      style={imageUrl ? {
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        boxSizing: 'border-box'
      } : undefined}
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#52ddeb"
          isVisible={selected}
          minWidth={150}
          minHeight={150}
          maxWidth={2000}
          maxHeight={2000}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}

      <NodeHandles />

      <NodeImageContainer
        className={cn("flex items-center justify-center", imageUrl && "p-0 m-0 !absolute inset-0 z-0")}
        style={{ width: '100%', height: '100%', padding: 0, margin: 0, boxSizing: 'border-box' }}
      >
        {imageUrl ? (
          <div className="relative w-full h-full group/image" style={{ width: '100%', height: '100%', margin: 0, padding: 0, boxSizing: 'border-box' }}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt={t('mockup.input') || 'Mockup'}
              className={cn(
                'object-contain w-full h-full node-image',
                dragging ? 'node-image-dragging' : 'node-image-static'
              )}
              style={{
                width: '100%',
                height: '100%',
                margin: 0,
                padding: 0,
                display: 'block',
                transformOrigin: 'center',
                boxSizing: 'border-box',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
              draggable={false}
              onLoad={handleImageLoad}
              onContextMenu={(e) => {
                // Allow ReactFlow to handle the context menu event
                // Don't prevent default or stop propagation - let it bubble to ReactFlow
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target) {
                  target.style.display = 'none';
                }
              }}
            />
            {/* Like and Describe buttons overlay */}
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
                title={isDescribing ? t('canvasNodes.imageNode.analyzingImage') : t('canvasNodes.imageNode.describeImageWithAI')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isDescribing ? (
                  <GlitchLoader size={12} />
                ) : (
                  <FileText size={12} strokeWidth={2} />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLike();
                }}
                className={cn(
                  "p-1 rounded-md transition-all backdrop-blur-sm",
                  isLiked
                    ? "bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30"
                    : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200"
                )}
                title={isLiked ? t('canvasNodes.imageNode.removeFromFavorites') : t('canvasNodes.imageNode.addToFavorites')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Heart size={12} className={isLiked ? "fill-current" : ""} strokeWidth={2} />
              </button>
            </div>
          </div>
        ) : (
          <NodePlaceholder
            isLoading={isGenerating}
            emptyIcon={<Upload size={32} className="text-zinc-600" />}
            emptyMessage={t('canvasNodes.imageNode.noImage')}
            emptySubmessage={t('canvasNodes.imageNode.uploadImage')}
            uploadButton={
              !isGenerating && nodeData.onUpload ? (
                <>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <NodeButton onClick={handleUploadClick}>
                    <UploadCloud size={14} />
                    {t('canvasNodes.imageNode.uploadImageTitle') || 'Upload Image'}
                  </NodeButton>
                </>
              ) : undefined
            }
          />
        )}
      </NodeImageContainer>

      <div className={cn(imageUrl && "absolute top-0 left-0 w-full z-10 bg-gradient-to-b from-black/50 to-transparent pointer-events-none")}>
        <NodeLabel label={(data as ImageNodeData).label} />
      </div>

      {/* Description Section */}
      {description && (
        <div className={cn(
          "px-2 py-2 border-t border-zinc-700/30 flex-shrink-0",
          imageUrl && "absolute bottom-0 left-0 w-full z-10 bg-black/60 backdrop-blur-md border-t-0"
        )}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-zinc-400 font-mono">{t('canvasNodes.imageNode.description')}</label>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyDescription();
                }}
                className="p-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan rounded transition-colors backdrop-blur-sm border border-[#52ddeb]/20 hover:border-[#52ddeb]/30"
                title={t('canvasNodes.imageNode.copyDescription')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Copy size={10} strokeWidth={2} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearDescription();
                }}
                className="p-1 bg-zinc-700/20 hover:bg-zinc-700/30 text-zinc-400 rounded transition-colors backdrop-blur-sm border border-zinc-700/20 hover:border-zinc-700/30"
                title={t('canvasNodes.imageNode.clearDescription')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X size={10} strokeWidth={2} />
              </button>
            </div>
          </div>
          <Textarea
            ref={descriptionTextareaRef}
            value={description}
            onChange={(e) => {
              e.stopPropagation();
              // Auto-resize
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              handleDescriptionChange(e.target.value);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="text-xs resize-none nodrag nopan overflow-hidden"
            placeholder={t('canvasNodes.imageNode.imageDescriptionPlaceholder')}
            style={{ minHeight: '24px' }}
          />
        </div>
      )}

      {!dragging && imageUrl && (
        <NodeActionBar selected={selected} getZoom={getZoom}>
          {(data as ImageNodeData).onView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nodeData = data as ImageNodeData;
                nodeData.onView?.(nodeData.mockup);
              }}
              className="p-1 bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 rounded transition-colors backdrop-blur-sm border border-zinc-700/30 hover:border-zinc-600/50"
              title={t('canvasNodes.imageNode.viewFullScreen')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Maximize2 size={12} strokeWidth={2} />
            </button>
          )}
          {isGenerated && (
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
                <GlitchLoader size={12} />
              ) : (
                <Download size={12} strokeWidth={2} />
              )}
            </button>
          )}
          {(data as ImageNodeData).onDelete && (
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
          {(data as ImageNodeData).onBrandKit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBrandKitModal(true);
              }}
              disabled={!imageUrl}
              className={cn(
                "p-1 rounded transition-colors backdrop-blur-sm border",
                !imageUrl
                  ? "bg-zinc-700/20 text-zinc-500 cursor-not-allowed border-zinc-700/20"
                  : "bg-black/40 hover:bg-black/60 text-zinc-400 hover:text-zinc-200 border-zinc-700/30 hover:border-zinc-600/50"
              )}
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
              <GlitchLoader size={12} />
            ) : (
              <FileText size={12} strokeWidth={2} />
            )}
          </button>
        </NodeActionBar>
      )}

      {/* Brand Kit Modal */}
      {(data as ImageNodeData).onBrandKit && (
        <MockupPresetModal
          isOpen={showBrandKitModal}
          selectedPresetId=""
          onClose={() => setShowBrandKitModal(false)}
          onSelectPresets={(presetIds) => {
            const nodeData = data as ImageNodeData;
            nodeData.onBrandKit?.(String(id), presetIds);
            setShowBrandKitModal(false);
          }}
          userMockups={(data as ImageNodeData).userMockups || []}
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
          const nodeData = data as ImageNodeData;
          nodeData.onDelete?.(mockupId);
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

