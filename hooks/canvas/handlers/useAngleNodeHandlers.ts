/**
 * useAngleNodeHandlers
 * 
 * Handlers para gerenciar operações de geração de ângulos de imagem
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, AngleNodeData, OutputNodeData } from '../../../types/reactFlow';
import type { UploadedImage } from '../../../types';
import type { ReactFlowInstance } from '../../../types/reactflow-instance';
import { getAnglePreset } from '../../../services/anglePresetsService';
import { normalizeImageToBase64, detectMimeType, validateCredits } from '../../../services/reactFlowService';
import { mockupApi } from '../../../services/mockupApi';
import type { Resolution } from '../../../types';
import { createOutputNodeWithSkeleton, validateBase64Image, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode } from '../utils/nodeGenerationUtils';
import { uploadImageToR2Auto } from '../utils/r2UploadUtils';

interface UseAngleNodeHandlersParams {
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

export const useAngleNodeHandlers = ({
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
}: UseAngleNodeHandlersParams) => {
  const handleAngleNodeDataUpdate = useCallback((nodeId: string, newData: Partial<AngleNodeData>) => {
    updateNodeData<AngleNodeData>(nodeId, newData, 'angle');
  }, [updateNodeData]);

  const handleAngleGenerate = useCallback(async (nodeId: string, imageInput: string, angleId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'angle') {
      console.warn('handleAngleGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const angleData = node.data as AngleNodeData;
    const connectedImageFromData = angleData.connectedImage;
    const imageToUse = imageInput || connectedImageFromData || '';

    if (!imageToUse) {
      toast.error('Connect an image to generate angle');
      return;
    }

    const angle = getAnglePreset(angleId as any);
    if (!angle) {
      toast.error(`Angle ${angleId} not found`);
      return;
    }

    const model = angle.model || 'gemini-2.5-flash-image';
    const resolution: Resolution = model === 'gemini-3-pro-image-preview' ? '4K' : '1K';

    const hasCredits = await validateCredits(model, resolution);
    if (!hasCredits) return;

    updateNodeLoadingState<AngleNodeData>(nodeId, true, 'angle');

    let imageBase64: string;
    try {
      imageBase64 = await normalizeImageToBase64(imageToUse);
      if (!validateBase64Image(imageBase64)) {
        throw new Error('Invalid base64 format after conversion');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process image. Please check if the image is accessible.');
      updateNodeLoadingState<AngleNodeData>(nodeId, false, 'angle');
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
      if (!validateBase64Image(imageBase64)) {
        throw new Error('Image data is empty after processing');
      }

      const mimeType = detectMimeType(imageInput || connectedImageFromData || '');
      const baseImage: UploadedImage = {
        base64: imageBase64,
        mimeType,
      };

      const result = await mockupApi.generate({
        promptText: angle.prompt,
        baseImage: {
          base64: baseImage.base64,
          mimeType: baseImage.mimeType
        },
        model: model,
        resolution: resolution,
        aspectRatio: angle.aspectRatio,
        referenceImages: undefined,
        imagesCount: 1,
        feature: 'canvas'
      });

      updateNodeLoadingState<AngleNodeData>(nodeId, false, 'angle');

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

      toast.success('Image angle generated successfully!', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId, setNodes, setEdges);
      updateNodeLoadingState<AngleNodeData>(nodeId, false, 'angle');
      toast.error(error?.message || 'Failed to generate angle', { duration: 5000 });
    }
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId]);

  return {
    handleAngleGenerate,
    handleAngleNodeDataUpdate,
  };
};

