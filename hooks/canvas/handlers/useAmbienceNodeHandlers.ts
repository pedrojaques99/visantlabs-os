/**
 * useAmbienceNodeHandlers
 * 
 * Handlers para gerenciar operações de geração de ambiência
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, AmbienceNodeData } from '../../../types/reactFlow';
import type { UploadedImage } from '../../../types';
import type { ReactFlowInstance } from '../../../types/reactflow-instance';
import { getAmbiencePreset } from '../../../services/ambiencePresetsService';
import { normalizeImageToBase64, detectMimeType, validateCredits } from '../../../services/reactFlowService';
import { mockupApi } from '../../../services/mockupApi';
import { subscriptionService } from '../../../services/subscriptionService';
import type { Resolution } from '../../../types';
import { createOutputNodeWithSkeleton, validateBase64Image, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode } from '../utils/nodeGenerationUtils';
import { uploadImageToR2Auto } from '../utils/r2UploadUtils';

interface UseAmbienceNodeHandlersParams {
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

export const useAmbienceNodeHandlers = ({
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
}: UseAmbienceNodeHandlersParams) => {
  const handleAmbienceNodeDataUpdate = useCallback((nodeId: string, newData: Partial<AmbienceNodeData>) => {
    updateNodeData<AmbienceNodeData>(nodeId, newData, 'ambience');
  }, [updateNodeData]);

  const handleAmbienceGenerate = useCallback(async (nodeId: string, imageInput: string, presetId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'ambience') {
      console.warn('handleAmbienceGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const ambienceData = node.data as AmbienceNodeData;
    const connectedImageFromData = ambienceData.connectedImage;
    const imageToUse = imageInput || connectedImageFromData || '';

    if (!imageToUse) {
      toast.error('Connect an image to generate ambience');
      return;
    }

    const preset = getAmbiencePreset(presetId as any);
    if (!preset) {
      toast.error(`Ambience preset ${presetId} not found`);
      return;
    }

    const model = preset.model || 'gemini-2.5-flash-image';
    const resolution: Resolution = model === 'gemini-3-pro-image-preview' ? '4K' : '1K';

    const hasCredits = await validateCredits(model, resolution);
    if (!hasCredits) return;

    updateNodeLoadingState<AmbienceNodeData>(nodeId, true, 'ambience');

    let imageBase64: string;
    try {
      imageBase64 = await normalizeImageToBase64(imageToUse);
      if (!validateBase64Image(imageBase64)) {
        throw new Error('Invalid base64 format after conversion');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process image');
      updateNodeLoadingState<AmbienceNodeData>(nodeId, false, 'ambience');
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

      const prompt = preset.prompt;

      const result = await mockupApi.generate({
        promptText: prompt,
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

      updateNodeLoadingState<AmbienceNodeData>(nodeId, false, 'ambience');

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

      // Credits were already deducted by mockupApi.generate before generation
      // Update subscription status to reflect new credits
      try {
        await refreshSubscriptionStatus();
      } catch (statusError: any) {
        console.error('Failed to refresh subscription status:', statusError);
        // Non-critical - credits were already deducted, just status refresh failed
      }

      toast.success('Ambience applied successfully!', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId, setNodes, setEdges);
      updateNodeLoadingState<AmbienceNodeData>(nodeId, false, 'ambience');
      toast.error(error?.message || 'Failed to generate ambience', { duration: 5000 });
    }
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId]);

  return {
    handleAmbienceGenerate,
    handleAmbienceNodeDataUpdate,
  };
};

