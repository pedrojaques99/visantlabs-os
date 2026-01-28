import React, { useRef, useState, useCallback, memo, useEffect } from 'react';
import { type NodeProps, useNodes, useEdges, useReactFlow, NodeResizer } from '@xyflow/react';
import { Upload, UploadCloud, Copy, X } from 'lucide-react';
import type { ImageNodeData } from '@/types/reactFlow';
import { getImageUrl } from '@/utils/imageUtils';
import { cn } from '@/lib/utils';
import { mockupApi, type Mockup } from '@/services/mockupApi';
import { aiApi } from '@/services/aiApi';
import { normalizeImageToBase64 } from '@/services/reactFlowService';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';
import { Textarea } from '@/components/ui/textarea';
import { NodeHandles } from './shared/NodeHandles';
import { NodeLabel } from './shared/NodeLabel';
import { NodePlaceholder } from './shared/NodePlaceholder';
import { NodeContainer } from './shared/NodeContainer';
import { NodeImageContainer } from './shared/NodeImageContainer';
import { NodeActionBar } from './shared/NodeActionBar';
import { ImageNodeActionButtons } from './shared/ImageNodeActionButtons';
import { useNodeDownload } from './shared/useNodeDownload';
import { MockupPresetModal } from '../MockupPresetModal';
import { useTranslation } from '@/hooks/useTranslation';
import { useMockupLike } from '@/hooks/useMockupLike';
import { NodeButton } from './shared/node-button';
import { fileToBase64 } from '@/utils/fileUtils';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FIT_WIDTH = 1200;
const GENERATING_TYPES = ['merge', 'edit', 'upscale', 'mockup', 'prompt'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ImageNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodes = useNodes();
  const edges = useEdges();
  const { setNodes, getNode, getZoom } = useReactFlow();
  const nodeData = data as ImageNodeData;
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  
  const mockup = nodeData?.mockup ?? ({} as Mockup);
  const imageUrl = getImageUrl(mockup);
  const isSaved = !!mockup._id;
  const isLiked = mockup.isLiked || false;
  const isGenerating = nodeData.isGenerating || false;
  const isDescribing = nodeData.isDescribing || false;
  const description = nodeData.description || '';

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const prevDimensionsRef = useRef<{ width?: number; height?: number }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [localDescription, setLocalDescription] = useState(description);

  const { handleDownload, isDownloading } = useNodeDownload(imageUrl, 'generated-image');
  const { toggleLike: handleToggleLike } = useMockupLike({
    mockupId: mockup._id || undefined,
    isLiked,
    onLikeStateChange: (newIsLiked) => {
      nodeData.onUpdateData?.(String(id), {
        mockup: { ...mockup, isLiked: newIsLiked },
      } as any);
    },
    translationKeyPrefix: 'canvasNodes.imageNode',
  });

  // Check if image was generated from a generating node
  const isGenerated = imageUrl && edges?.length > 0 && nodes?.length > 0 && (() => {
    const incomingEdge = edges.find(e => e.target === id);
    const sourceNode = incomingEdge ? nodes.find(n => n.id === incomingEdge.source) : null;
    return sourceNode ? GENERATING_TYPES.includes(sourceNode.type || '') : false;
  })();

  // Sync local description with node data
  useEffect(() => {
    if (nodeData.description !== undefined) {
      setLocalDescription(nodeData.description);
    }
  }, [nodeData.description]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = descriptionTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [description]);

  // Auto-resize node to match image aspect ratio
  useEffect(() => {
    if (!imageUrl || !nodeData.imageWidth || !nodeData.imageHeight) return;

    const { imageWidth, imageHeight } = nodeData;
    if (prevDimensionsRef.current.width === imageWidth && prevDimensionsRef.current.height === imageHeight) return;

    prevDimensionsRef.current = { width: imageWidth, height: imageHeight };

    const currentNode = getNode(id);
    if (!currentNode) return;

    const aspectRatio = imageWidth / imageHeight;
    if (aspectRatio <= 0) return;

    const currentWidth = (currentNode.style?.width as number) || currentNode.width || 300;
    const currentHeight = (currentNode.style?.height as number) || currentNode.height;
    const expectedHeight = currentWidth / aspectRatio;
    const heightDiff = currentHeight ? Math.abs(currentHeight - expectedHeight) : Infinity;

    if (!currentHeight || heightDiff > 5) {
      const newHeight = Math.max(150, Math.min(2000, expectedHeight));
      setNodes((nds) => nds.map((n) => 
        n.id === id && n.type === 'image' 
          ? { ...n, style: { ...n.style, width: currentWidth, height: newHeight } }
          : n
      ));
      nodeData.onResize?.(id, currentWidth, newHeight);
    }
  }, [imageUrl, nodeData.imageWidth, nodeData.imageHeight, id, getNode, setNodes, nodeData]);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img || !imageUrl) return;

    const { naturalWidth, naturalHeight } = img;
    if (naturalWidth > 0 && naturalHeight > 0) {
      nodeData.onUpdateData?.(String(id), { imageWidth: naturalWidth, imageHeight: naturalHeight });
    }
  }, [imageUrl, id, nodeData]);

  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    const { imageWidth, imageHeight } = nodeData;
    if (!imageWidth || !imageHeight) return;

    let targetWidth = imageWidth;
    let targetHeight = imageHeight;
    if (targetWidth > MAX_FIT_WIDTH) {
      const ratio = MAX_FIT_WIDTH / targetWidth;
      targetWidth = MAX_FIT_WIDTH;
      targetHeight *= ratio;
    }
    fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), nodeData.onResize);
  }, [id, nodeData.imageWidth, nodeData.imageHeight, nodeData.onResize, fitToContent]);

  const handleSave = useCallback(async () => {
    if (!imageUrl || isSaving || isSaved) return;
    if (imageUrl.startsWith('data:')) {
      toast.error(t('canvasNodes.imageNode.pleaseUseImageFromR2'), { duration: 3000 });
      return;
    }

    setIsSaving(true);
    try {
      const savedMockup = await mockupApi.save({
        imageUrl,
        prompt: mockup.prompt || t('canvasNodes.imageNode.canvasImage'),
        designType: mockup.designType || 'other',
        tags: mockup.tags || [],
        brandingTags: mockup.brandingTags || [],
        aspectRatio: mockup.aspectRatio || '16:9',
        isLiked,
      });

      nodeData.onUpdateData?.(String(id), {
        mockup: { ...mockup, _id: savedMockup._id, imageUrl, isLiked },
      } as any);

      toast.success(t('canvasNodes.imageNode.imageSavedSuccessfully'), { duration: 3000 });
    } catch (error: any) {
      toast.error(error?.message || t('canvasNodes.imageNode.failedToSaveImage'), { duration: 3000 });
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [imageUrl, isSaving, isSaved, isLiked, nodeData, id, mockup, t]);

  const handleDescribe = useCallback(async () => {
    if (!imageUrl || isDescribing || !nodeData.addTextNode) return;

    let imageInput: string | { base64: string; mimeType: string };

    // Prefer imageBase64 from mockup if available
    const rawBase64 = mockup.imageBase64;
    if (typeof rawBase64 === 'string' && rawBase64.trim()) {
      const cleanBase64 = rawBase64.startsWith('data:') && rawBase64.includes(',')
        ? rawBase64.split(',')[1]
        : rawBase64.trim();
      if (cleanBase64) {
        imageInput = { base64: cleanBase64, mimeType: mockup.mimeType || 'image/png' };
      }
    }

    if (!imageInput) {
      if (imageUrl.startsWith('data:')) {
        imageInput = imageUrl;
      } else {
        try {
          const base64Fallback = typeof mockup.imageBase64 === 'string' ? mockup.imageBase64 : undefined;
          const base64 = await normalizeImageToBase64(imageUrl, base64Fallback);
          const mimeType = imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') ? 'image/jpeg'
            : imageUrl.includes('.webp') ? 'image/webp'
            : imageUrl.includes('.gif') ? 'image/gif'
            : 'image/png';
          imageInput = { base64, mimeType };
        } catch (error: any) {
          toast.error(error?.message || t('canvas.failedToLoadImageForAnalysis'), { duration: 3000 });
          console.error('Failed to convert image to base64:', error);
          return;
        }
      }
    }

    nodeData.onUpdateData?.(String(id), { isDescribing: true });

    try {
      const generatedDescription = await aiApi.describeImage(imageInput);
      const currentNode = nodes.find(n => n.id === id);
      
      if (!currentNode) {
        toast.error(t('canvasNodes.imageNode.failedToFindCurrentNode'), { duration: 3000 });
        nodeData.onUpdateData?.(String(id), { isDescribing: false });
        return;
      }

      const currentHeight = currentNode.measured?.height ?? 
        (currentNode.style?.height as number) ?? 
        currentNode.height ?? 300;
      const newNodePosition = {
        x: currentNode.position.x,
        y: currentNode.position.y + currentHeight + 50,
      };

      if (isNaN(newNodePosition.x) || isNaN(newNodePosition.y)) {
        toast.error(t('canvasNodes.imageNode.invalidNodePosition'), { duration: 3000 });
        nodeData.onUpdateData?.(String(id), { isDescribing: false });
        return;
      }

      const newNodeId = nodeData.addTextNode(newNodePosition, generatedDescription, true);
      if (newNodeId) {
        toast.success(t('canvas.imageDescriptionGenerated'), { duration: 2000 });
      } else {
        toast.error(t('canvasNodes.imageNode.failedToCreateTextNode'), { duration: 3000 });
      }
    } catch (error: any) {
      console.error('Failed to describe image:', error);
      toast.error(error?.message || t('canvas.failedToGenerateDescription'), { duration: 3000 });
    } finally {
      nodeData.onUpdateData?.(String(id), { isDescribing: false });
    }
  }, [imageUrl, isDescribing, nodeData, id, nodes, mockup, t]);

  const handleDescriptionChange = useCallback((value: string) => {
    setLocalDescription(value);
    nodeData.onUpdateData?.(String(id), { description: value });
  }, [nodeData, id]);

  const handleCopyDescription = useCallback(() => {
    if (!description) return;
    navigator.clipboard.writeText(description);
    toast.success(t('canvasNodes.imageNode.descriptionCopied'), { duration: 2000 });
  }, [description, t]);

  const handleClearDescription = useCallback(() => {
    setLocalDescription('');
    nodeData.onUpdateData?.(String(id), { description: undefined });
    toast.success(t('canvasNodes.imageNode.descriptionCleared'), { duration: 2000 });
  }, [nodeData, id, t]);

  const handleUploadClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    imageInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUpload) return;

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }

    if (!file.type.startsWith('image/')) {
      toast.error(t('upload.unsupportedFileType') || 'Please select an image file', { duration: 3000 });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const errorMsg = t('upload.imageTooLarge')?.replace('{size}', sizeMB).replace('{max}', '10') 
        || `File size (${sizeMB}MB) exceeds 10MB limit`;
      toast.error(errorMsg, { duration: 5000 });
      return;
    }

    try {
      const imageData = await fileToBase64(file);
      const b64 = imageData?.base64?.trim();
      if (!b64) {
        toast.error(t('upload.couldNotProcess') || 'Failed to process image', { duration: 3000 });
        return;
      }
      nodeData.onUpload(id, b64);
      toast.success(t('canvasNodes.imageNode.uploadImageTitle') || 'Image uploaded successfully!', { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || t('upload.couldNotProcess') || 'Failed to process image', { duration: 5000 });
      console.error('Failed to process image:', error);
    }
  }, [nodeData, id, t]);

  const imageContainerStyle = { width: '100%', height: '100%', padding: 0, margin: 0, boxSizing: 'border-box' as const };
  const imageStyle = {
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    display: 'block' as const,
    transformOrigin: 'center',
    boxSizing: 'border-box' as const,
    maxWidth: '100%',
    maxHeight: '100%',
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      containerRef={containerRef}
      warning={nodeData.oversizedWarning}
      onFitToContent={handleFitToContent}
      className={cn('group', dragging ? 'node-dragging' : 'node-dragging-static', imageUrl && 'p-0')}
      style={imageUrl ? { margin: 0, padding: 0, overflow: 'hidden', boxSizing: 'border-box', opacity: 1 } : undefined}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={150}
          minHeight={150}
          maxWidth={2000}
          maxHeight={2000}
          keepAspectRatio={true}
          onResize={(_, { width, height }) => handleResize(width, height)}
        />
      )}

      <NodeHandles />

      <NodeImageContainer
        className={cn("flex items-center justify-center", imageUrl && "p-0 m-0 !absolute inset-0 z-0")}
        style={imageContainerStyle}
      >
        {imageUrl ? (
          <div className="relative w-full h-full group/image" style={imageContainerStyle}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt={t('mockup.input') || 'Mockup'}
              className={cn('object-contain w-full h-full node-image', dragging ? 'node-image-dragging' : 'node-image-static')}
              style={imageStyle}
              draggable={false}
              onLoad={handleImageLoad}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <NodePlaceholder
            isLoading={isGenerating}
            emptyIcon={<Upload size={32} className="text-neutral-600" />}
            emptyMessage={t('canvasNodes.imageNode.noImage')}
            emptySubmessage={t('canvasNodes.imageNode.uploadImage')}
            uploadButton={!isGenerating && nodeData.onUpload ? (
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
            ) : undefined}
          />
        )}
      </NodeImageContainer>

      {imageUrl && (
        <div className="absolute top-0 left-0 w-full z-10 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
          <NodeLabel label={nodeData.label} />
        </div>
      )}

      {description && (
        <div className={cn(
          "px-2 py-2 border-t border-neutral-700/30 flex-shrink-0",
          imageUrl && "absolute bottom-0 left-0 w-full z-10 bg-neutral-950/60 backdrop-blur-md border-t-0"
        )}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-neutral-400 font-mono">{t('canvasNodes.imageNode.description')}</label>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleCopyDescription(); }}
                className="p-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan rounded transition-colors backdrop-blur-sm border border-[brand-cyan]/20 hover:border-[brand-cyan]/30"
                title={t('canvasNodes.imageNode.copyDescription')}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Copy size={10} strokeWidth={2} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleClearDescription(); }}
                className="p-1 bg-neutral-700/20 hover:bg-neutral-700/30 text-neutral-400 rounded transition-colors backdrop-blur-sm border border-neutral-700/20 hover:border-neutral-700/30"
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
              const textarea = e.currentTarget;
              textarea.style.height = 'auto';
              textarea.style.height = `${textarea.scrollHeight}px`;
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
          <ImageNodeActionButtons
            onView={() => nodeData.onView?.(mockup)}
            showView={!!nodeData.onView}
            onDownload={handleDownload}
            isDownloading={isDownloading}
            showDownload={isGenerated}
            onDelete={() => setShowDeleteModal(true)}
            showDelete={!!nodeData.onDelete}
            onBrandKit={() => setShowBrandKitModal(true)}
            showBrandKit={!!nodeData.onBrandKit}
            brandKitDisabled={!imageUrl}
            onLike={handleToggleLike}
            isLiked={isLiked}
            showLike={true}
            onDescribe={handleDescribe}
            isDescribing={isDescribing}
            describeDisabled={!imageUrl}
            showDescribe={true}
            translationKeyPrefix="canvasNodes.imageNode"
            t={t}
          />
        </NodeActionBar>
      )}

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

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          nodeData.onDelete?.(mockup._id || '');
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

