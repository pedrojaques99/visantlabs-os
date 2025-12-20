/**
 * useTextureNodeHandlers
 * 
 * Handlers para gerenciar operações de geração de texturas
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, TextureNodeData } from '../../../types/reactFlow';
import type { UploadedImage } from '../../../types';
import type { ReactFlowInstance } from '../../../types/reactflow-instance';
import { getTexturePreset } from '../../../services/texturePresetsService';
import { normalizeImageToBase64, detectMimeType, validateCredits } from '../../../services/reactFlowService';
import { mockupApi } from '../../../services/mockupApi';
import type { Resolution } from '../../../types';
import { createOutputNodeWithSkeleton, validateBase64Image, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode } from '../utils/nodeGenerationUtils';
import { uploadImageToR2Auto } from '../utils/r2UploadUtils';

interface UseTextureNodeHandlersParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  reactFlowInstance: ReactFlowInstance | null;
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  refreshSubscriptionStatus: () => Promise<void>;
  canvasId?: string;
}

export const useTextureNodeHandlers = ({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  updateNodeData,
  updateNodeLoadingState,
  reactFlowInstance,
  addToHistory,
  refreshSubscriptionStatus,
  canvasId,
}: UseTextureNodeHandlersParams) => {
  const handleTextureNodeDataUpdate = useCallback((nodeId: string, newData: Partial<TextureNodeData>) => {
    updateNodeData<TextureNodeData>(nodeId, newData, 'texture');
  }, [updateNodeData]);

  const handleTextureGenerate = useCallback(async (nodeId: string, imageInput: string, presetId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'texture') {
      console.warn('handleTextureGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const textureData = node.data as TextureNodeData;
    const connectedImageFromData = textureData.connectedImage;
    const imageToUse = imageInput || connectedImageFromData || '';

    if (!imageToUse) {
      toast.error('Connect an image to generate texture');
      return;
    }

    const preset = getTexturePreset(presetId as any);
    if (!preset) {
      toast.error(`Texture preset ${presetId} not found`);
      return;
    }

    const model = preset.model || 'gemini-2.5-flash-image';
    const resolution: Resolution = model === 'gemini-3-pro-image-preview' ? '4K' : '1K';

    const hasCredits = await validateCredits(model, resolution);
    if (!hasCredits) return;

    updateNodeLoadingState<TextureNodeData>(nodeId, true, 'texture');

    let imageBase64: string;
    try {
      imageBase64 = await normalizeImageToBase64(imageToUse);
      if (!validateBase64Image(imageBase64)) {
        throw new Error('Invalid base64 format after conversion');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process image');
      updateNodeLoadingState<TextureNodeData>(nodeId, false, 'texture');
      return;
    }

    let newOutputNodeId: string | null = null;
    const skeletonNode = reactFlowInstance ? createOutputNodeWithSkeleton(node, nodeId, reactFlowInstance) : null;

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
      setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
    }

    try {
      const mimeType = detectMimeType(imageInput || connectedImageFromData || '');
      const baseImage: UploadedImage = {
        base64: imageBase64,
        mimeType,
      };

      const result = await mockupApi.generate({
        promptText: preset.prompt,
        baseImage: {
          base64: baseImage.base64,
          mimeType: baseImage.mimeType
        },
        model: model,
        resolution: resolution,
        aspectRatio: preset.aspectRatio,
        referenceImages: undefined,
        imagesCount: 1,
        feature: 'canvas'
      });

      updateNodeLoadingState<TextureNodeData>(nodeId, false, 'texture');

      if (newOutputNodeId) {
        updateOutputNodeWithResult(
          newOutputNodeId,
          result.imageBase64,
          () => addToHistory(nodesRef.current, edgesRef.current),
          setNodes
        );

        if (canvasId) {
          await uploadImageToR2Auto(result.imageBase64, newOutputNodeId, canvasId, setNodes, (imageUrl) => {
            updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl, setNodes);
          });
        }
      }

      try {
        await refreshSubscriptionStatus();
      } catch (statusError: any) {
        console.error('Failed to refresh subscription status:', statusError);
      }

      toast.success('Texture applied successfully!', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId, setNodes, setEdges);
      updateNodeLoadingState<TextureNodeData>(nodeId, false, 'texture');
      toast.error(error?.message || 'Failed to generate texture', { duration: 5000 });
    }
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId]);

  return {
    handleTextureGenerate,
    handleTextureNodeDataUpdate,
  };
};

