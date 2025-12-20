import { useCallback } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { toast } from 'sonner';
import type { FlowNodeData, ImageNodeData, OutputNodeData } from '../../types/reactFlow';
import { getImageUrl } from '../../utils/imageUtils';
import { generateNodeId, copyMediaFromNode, getMediaFromNodeForCopy } from '../../utils/canvas/canvasNodeUtils';
import { canvasApi } from '../../services/canvasApi';
import { mockupApi } from '../../services/mockupApi';
import type { Mockup } from '../../services/mockupApi';
import { aiApi } from '../../services/aiApi';
import { normalizeImageToBase64 } from '../../services/reactFlowService';
import type { ReactFlowInstance } from '../../types/reactflow-instance';
import { collectR2UrlsForDeletion } from './utils/r2UploadHelpers';

interface UseImageNodeHandlersParams {
  imageContextMenu: { x: number; y: number; nodeId: string } | null;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setExportPanel: React.Dispatch<React.SetStateAction<{
    nodeId: string;
    nodeName: string;
    imageUrl: string | null;
    nodeType: string;
  } | null>>;
  reactFlowInstance: ReactFlowInstance | null;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  addPromptNode: (position?: { x: number; y: number }) => string | undefined;
  onConnect: (connection: any) => void;
  onNodesChange: (changes: any[]) => void;
  isAuthenticated: boolean | null;
  handleImageNodeDataUpdate?: (nodeId: string, newData: Partial<ImageNodeData>) => void;
  handleView?: (mockup: Mockup) => void;
  handleEdit?: (mockup: Mockup) => void;
  onDeleteMockup?: (id: string) => void;
  handlersRef?: React.MutableRefObject<any>;
  t: (key: string) => string;
}

/**
 * Unified hook for ImageNode and OutputNode handlers
 * Provides common handlers for download, copy, export, fullscreen, edit, delete, and duplicate operations
 */
export const useImageNodeHandlers = ({
  imageContextMenu,
  nodes,
  edges,
  setNodes,
  setEdges,
  setExportPanel,
  reactFlowInstance,
  reactFlowWrapper,
  addToHistory,
  addPromptNode,
  onConnect,
  onNodesChange,
  isAuthenticated,
  handleImageNodeDataUpdate,
  handleView,
  handleEdit,
  onDeleteMockup,
  handlersRef,
  t,
}: UseImageNodeHandlersParams) => {
  // Helper to get image URL from node
  const getImageUrlFromNode = useCallback((node: Node<FlowNodeData>): string | null => {
    if (node.type === 'image') {
      const imageData = node.data as ImageNodeData;
      return getImageUrl(imageData.mockup);
    }
    if (node.type === 'output') {
      const outputData = node.data as OutputNodeData;
      if (outputData.resultImageUrl) {
        return outputData.resultImageUrl;
      }
      if (outputData.resultImageBase64) {
        return outputData.resultImageBase64.startsWith('data:')
          ? outputData.resultImageBase64
          : `data:image/png;base64,${outputData.resultImageBase64}`;
      }
    }
    return null;
  }, []);

  // Helper to get node name
  const getNodeName = useCallback((node: Node<FlowNodeData>): string => {
    if (node.type === 'image') {
      const imageData = node.data as ImageNodeData;
      return imageData.mockup.prompt || `node-${node.id}`;
    }
    if (node.type === 'output') {
      const outputData = node.data as OutputNodeData;
      return outputData.label || `output-${node.id}`;
    }
    return `node-${node.id}`;
  }, []);

  // Generic download handler
  const handleDownload = useCallback(async () => {
    if (!imageContextMenu?.nodeId) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || (node.type !== 'image' && node.type !== 'output')) {
      toast.error(t('canvas.nodeNotFound'), { duration: 2000 });
      return;
    }

    const imageUrl = getImageUrlFromNode(node);
    if (!imageUrl) {
      toast.error(t('canvas.noImageAvailableToDownload'), { duration: 2000 });
      return;
    }

    try {
      let blob: Blob;
      let fileName = `${node.type === 'image' ? 'image' : 'output'}-${Date.now()}.png`;

      // If it's a base64 image, convert it to blob
      if (imageUrl.startsWith('data:')) {
        try {
          const base64Match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            const mimeType = base64Match[1] || 'image/png';
            const base64Data = base64Match[2];

            // Determine file extension from mime type
            const extension = mimeType.includes('jpeg') ? 'jpg' :
              mimeType.includes('webp') ? 'webp' :
                mimeType.includes('gif') ? 'gif' : 'png';
            fileName = `${node.type === 'image' ? 'image' : 'output'}-${Date.now()}.${extension}`;

            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: mimeType });
          } else {
            // Fallback: try to extract base64 without data URL prefix
            const base64Data = imageUrl.includes(',') ? imageUrl.split(',')[1] : imageUrl;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: 'image/png' });
          }
        } catch (base64Error) {
          console.error('Base64 conversion error:', base64Error);
          toast.error(t('canvas.failedToProcessImage'), { duration: 2000 });
          return;
        }
      } else {
        // Fetch the image as blob
        try {
          const response = await fetch(imageUrl, {
            mode: 'cors',
            credentials: 'omit',
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          blob = await response.blob();

          // Try to determine file extension from response or URL
          const contentType = response.headers.get('content-type') || '';
          const extension = contentType.includes('jpeg') ? 'jpg' :
            contentType.includes('webp') ? 'webp' :
              contentType.includes('gif') ? 'gif' :
                imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'png';
          fileName = `${node.type === 'image' ? 'image' : 'output'}-${Date.now()}.${extension}`;
        } catch (fetchError: any) {
          console.error('Fetch error:', fetchError);

          // If CORS fails, try to use the image URL directly (browser will handle download)
          if (fetchError.name === 'TypeError' || fetchError.message.includes('CORS')) {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = fileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(t('canvas.imageDownloadStarted'), { duration: 2000 });
            return;
          }

          throw fetchError;
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up after a short delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success(t('canvas.imageDownloaded') || 'Image downloaded!', { duration: 2000 });
    } catch (error: any) {
      console.error('Download error:', error);
      const errorMessage = error?.message || t('canvas.failedToDownloadImage') || 'Failed to download image';
      toast.error(errorMessage, { duration: 3000 });
    }
  }, [imageContextMenu, nodes, getImageUrlFromNode, t]);

  // Generic export handler
  const handleExport = useCallback(() => {
    if (!imageContextMenu?.nodeId) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || (node.type !== 'image' && node.type !== 'output')) return;

    const imageUrl = getImageUrlFromNode(node);
    const nodeName = getNodeName(node);

    setExportPanel({
      nodeId: node.id,
      nodeName,
      imageUrl: imageUrl || null,
      nodeType: node.type,
    });
  }, [imageContextMenu, nodes, getImageUrlFromNode, getNodeName, setExportPanel]);

  // Generic fullscreen handler
  const handleFullscreen = useCallback(() => {
    if (!imageContextMenu?.nodeId) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || (node.type !== 'image' && node.type !== 'output')) return;

    const imageUrl = getImageUrlFromNode(node);
    if (!imageUrl) return;

    if (node.type === 'image') {
      const imageData = node.data as ImageNodeData;
      if (imageData.onView) {
        imageData.onView(imageData.mockup);
      } else {
        window.open(imageUrl, '_blank');
      }
    } else if (node.type === 'output') {
      const outputData = node.data as OutputNodeData;
      if (outputData.onView) {
        outputData.onView(imageUrl);
      } else {
        window.open(imageUrl, '_blank');
      }
    }
  }, [imageContextMenu, nodes, getImageUrlFromNode]);

  // Generic copy handler - supports all node types with media
  const handleCopy = useCallback(async () => {
    if (!imageContextMenu?.nodeId) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node) return;

    const media = getMediaFromNodeForCopy(node);
    if (!media) {
      toast.error('No media found in node', { duration: 2000 });
      return;
    }

    const result = await copyMediaFromNode(node);
    if (result.success) {
      toast.success(
        media.isVideo
          ? 'Video copied to clipboard!'
          : 'Image copied to clipboard!',
        { duration: 2000 }
      );
    } else {
      toast.error(result.error || 'Failed to copy media to clipboard', { duration: 3000 });
    }
  }, [imageContextMenu, nodes]);

  // Generic edit with prompt handler
  const handleEditWithPrompt = useCallback(() => {
    if (!imageContextMenu?.nodeId) return;

    const imageNode = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!imageNode || (imageNode.type !== 'image' && imageNode.type !== 'output')) return;

    // Check if there's already a connected PromptNode
    const connectedPromptEdge = edges.find(
      e => e.source === imageNode.id && e.target && nodes.find(n => n.id === e.target && n.type === 'prompt')
    );

    if (connectedPromptEdge) {
      // Focus on existing PromptNode
      const promptNode = nodes.find(n => n.id === connectedPromptEdge.target);
      if (promptNode) {
        onNodesChange([
          {
            id: promptNode.id,
            type: 'select',
            selected: true,
          } as any,
        ]);
        toast.success(t('canvas.openedExistingPromptNode'), { duration: 2000 });
      }
    } else {
      // Create new PromptNode and connect
      if (reactFlowInstance) {
        const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
        if (pane) {
          const newNodeId = addPromptNode({
            x: imageNode.position.x + 300,
            y: imageNode.position.y,
          });

          if (newNodeId) {
            setTimeout(() => {
              onConnect({
                source: imageNode.id,
                target: newNodeId,
                targetHandle: 'input-1', // Connect to the first image input handle
              } as any);
              toast.success(t('canvas.createdAndConnectedPromptNode'), { duration: 2000 });
            }, 100);
          }
        }
      }
    }
  }, [imageContextMenu, nodes, edges, reactFlowInstance, reactFlowWrapper, addPromptNode, onConnect, onNodesChange, t]);

  // Generic delete handler
  const handleDeleteNode = useCallback(async () => {
    if (!imageContextMenu?.nodeId) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || (node.type !== 'image' && node.type !== 'output')) return;

    addToHistory(nodes, edges);

    // Check if the image is liked (should be preserved in R2)
    let isLiked = false;
    if (node.type === 'image') {
      const imageData = node.data as ImageNodeData;
      isLiked = imageData.mockup?.isLiked === true;
    } else if (node.type === 'output') {
      const outputData = node.data as any;
      isLiked = outputData.isLiked === true;
    }

    // Coletar todas as URLs do R2 que precisam ser deletadas
    const urlsToDelete = collectR2UrlsForDeletion(node, isLiked);

    // Deletar todas as URLs do R2
    if (urlsToDelete.length > 0) {
      await Promise.allSettled(
        urlsToDelete.map(url => canvasApi.deleteImageFromR2(url))
      ).catch((error) => {
        console.error('Failed to delete files from R2:', error);
      });
    }

    // For ImageNode, also delete from backend if saved AND not liked
    if (node.type === 'image' && isAuthenticated && !isLiked) {
      const imageData = node.data as ImageNodeData;
      const mockupId = imageData.mockup._id || '';
      if (mockupId && /^[0-9a-fA-F]{24}$/.test(mockupId)) {
        try {
          await mockupApi.delete(mockupId);
        } catch (error) {
          console.error('Failed to delete mockup from backend:', error);
        }
      }
    }

    // Remove node and connected edges
    const nodeIdsToRemove = new Set([node.id]);
    const newNodes = nodes.filter(n => !nodeIdsToRemove.has(n.id));
    const newEdges = edges.filter(e =>
      !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target)
    );

    setNodes(newNodes);
    setEdges(newEdges);

    setTimeout(() => {
      addToHistory(newNodes, newEdges);
    }, 0);

    toast.success(t('canvas.nodeDeleted'), { duration: 2000 });
  }, [imageContextMenu, nodes, edges, isAuthenticated, setNodes, setEdges, addToHistory, getImageUrlFromNode, t]);

  // Generic duplicate handler
  const handleDuplicate = useCallback(() => {
    if (!imageContextMenu?.nodeId || !reactFlowInstance) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || (node.type !== 'image' && node.type !== 'output')) return;

    addToHistory(nodes, edges);

    const newPosition = {
      x: node.position.x + 50,
      y: node.position.y + 50,
    };

    if (node.type === 'image') {
      const imageData = node.data as ImageNodeData;

      // Create a copy of the mockup with new temp ID
      const duplicatedMockup: Mockup = {
        ...imageData.mockup,
        _id: `temp-${Date.now()}`,
      };

      const duplicatedNode: Node<FlowNodeData> = {
        ...node,
        id: generateNodeId('image'),
        position: newPosition,
        selected: false,
        data: {
          ...imageData,
          mockup: duplicatedMockup,
          onView: handleView,
          onEdit: handleEdit,
          onDelete: onDeleteMockup,
          onUpload: handlersRef?.current?.handleUploadImage || (() => { }),
          onUpdateData: handleImageNodeDataUpdate,
        } as ImageNodeData,
      };

      setNodes((nds: Node<FlowNodeData>[]) => {
        const newNodes = [...nds, duplicatedNode];
        setTimeout(() => {
          addToHistory(newNodes, edges);
        }, 0);
        return newNodes;
      });
    } else if (node.type === 'output') {
      const outputData = node.data as OutputNodeData;

      const duplicatedNode: Node<FlowNodeData> = {
        ...node,
        id: generateNodeId('output'),
        position: newPosition,
        selected: false,
        data: {
          ...outputData,
          onView: (imageUrl: string) => {
            window.open(imageUrl, '_blank');
          },
        } as OutputNodeData,
      };

      setNodes((nds: Node<FlowNodeData>[]) => {
        const newNodes = [...nds, duplicatedNode];
        setTimeout(() => {
          addToHistory(newNodes, edges);
        }, 0);
        return newNodes;
      });
    }

    toast.success(t('canvas.nodeDuplicatedSingular'), { duration: 2000 });
  }, [imageContextMenu, nodes, edges, reactFlowInstance, setNodes, addToHistory, handleView, handleEdit, onDeleteMockup, handleImageNodeDataUpdate, handlersRef, t]);

  // Image-specific handlers
  const handleImageLike = useCallback(() => {
    if (!imageContextMenu?.nodeId || !handleImageNodeDataUpdate) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || node.type !== 'image') return;

    const imageData = node.data as ImageNodeData;
    const mockupId = imageData.mockup._id || '';
    const isLiked = imageData.mockup.isLiked || false;
    const newLikedState = !isLiked;

    // Update local state immediately
    handleImageNodeDataUpdate(imageContextMenu.nodeId, {
      mockup: { ...imageData.mockup, isLiked: newLikedState },
    });

    // Update in backend if saved
    const isValidObjectId = mockupId && /^[0-9a-fA-F]{24}$/.test(mockupId);
    if (isValidObjectId) {
      mockupApi.update(mockupId, { isLiked: newLikedState }).catch((error) => {
        console.error('Failed to update like status:', error);
        // Revert on error
        handleImageNodeDataUpdate(imageContextMenu.nodeId, {
          mockup: { ...imageData.mockup, isLiked: isLiked },
        });
        toast.error(t('canvas.failedToUpdateLikeStatus'), { duration: 3000 });
      });
    }

    toast.success(newLikedState ? t('canvas.addedToFavorites') : t('canvas.removedFromFavorites'), { duration: 2000 });
  }, [imageContextMenu, nodes, handleImageNodeDataUpdate, t]);

  const handleImageDescribe = useCallback(async () => {
    if (!imageContextMenu?.nodeId || !handleImageNodeDataUpdate) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || node.type !== 'image') return;

    const imageData = node.data as ImageNodeData;
    const imageUrl = getImageUrl(imageData.mockup);
    if (!imageUrl) {
      toast.error(t('canvas.noImageAvailableToDescribe'), { duration: 3000 });
      return;
    }

    // Check if already describing
    if (imageData.isDescribing) return;

    // Set loading state
    handleImageNodeDataUpdate(imageContextMenu.nodeId, { isDescribing: true });

    try {
      // Get image base64 from mockup or convert from URL
      let imageInput: string | { base64: string; mimeType: string };

      // Prefer imageBase64 from mockup if available
      if (imageData.mockup.imageBase64) {
        const base64 = imageData.mockup.imageBase64.trim();
        // Remove data URL prefix if present
        const cleanBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
        imageInput = {
          base64: cleanBase64,
          mimeType: imageData.mockup.mimeType || 'image/png',
        };
      } else if (imageUrl.startsWith('data:')) {
        // Already a data URL, use directly
        imageInput = imageUrl;
      } else {
        // Convert URL to base64 using utility function (with base64 fallback if available)
        try {
          const base64Fallback = imageData.mockup.imageBase64;
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
          handleImageNodeDataUpdate(imageContextMenu.nodeId, { isDescribing: false });
          return;
        }
      }

      const generatedDescription = await aiApi.describeImage(imageInput);

      // Update node data with description
      handleImageNodeDataUpdate(imageContextMenu.nodeId, {
        description: generatedDescription,
        isDescribing: false,
      });

      toast.success(t('canvas.imageDescriptionGenerated'), { duration: 2000 });
    } catch (error: any) {
      console.error('Failed to describe image:', error);
      toast.error(error?.message || t('canvas.failedToGenerateDescription'), { duration: 3000 });

      // Clear loading state on error
      handleImageNodeDataUpdate(imageContextMenu.nodeId, { isDescribing: false });
    }
  }, [imageContextMenu, nodes, handleImageNodeDataUpdate, t]);

  // Output-specific handlers
  const handleOutputLike = useCallback(async () => {
    if (!imageContextMenu?.nodeId) return;

    const node = nodes.find(n => n.id === imageContextMenu.nodeId);
    if (!node || node.type !== 'output') return;

    const outputData = node.data as OutputNodeData;
    const imageUrl = outputData.resultImageUrl || (outputData.resultImageBase64 ? `data:image/png;base64,${outputData.resultImageBase64}` : null);

    if (!imageUrl || imageUrl.startsWith('data:')) {
      toast.error(t('canvas.pleaseSaveImageFirst'), { duration: 3000 });
      return;
    }

    try {
      const savedMockup = await mockupApi.save({
        imageUrl: imageUrl,
        prompt: 'Canvas output image',
        designType: 'other',
        tags: [],
        brandingTags: [],
        aspectRatio: '16:9',
        isLiked: true,
      });

      toast.success(t('canvas.savedToFavorites'), { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || t('canvas.failedToSaveToFavorites'), { duration: 3000 });
    }
  }, [imageContextMenu, nodes, t]);

  return {
    // Generic handlers (work for both ImageNode and OutputNode)
    handleDownload,
    handleExport,
    handleFullscreen,
    handleCopy,
    handleEditWithPrompt,
    handleDelete: handleDeleteNode,
    handleDuplicate,
    // Image-specific handlers
    handleImageLike,
    handleImageDescribe,
    // Output-specific handlers
    handleOutputLike,
  };
};

