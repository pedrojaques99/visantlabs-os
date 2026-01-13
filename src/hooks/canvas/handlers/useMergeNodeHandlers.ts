/**
 * useMergeNodeHandlers
 * 
 * Handlers para gerenciar operações de merge de imagens
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, MergeNodeData } from '@/types/reactFlow';
import type { ReactFlowInstance } from '@/types/reactflow-instance';
import type { GeminiModel } from '@/types/types';
import { combineImages, validateCredits } from '@/services/reactFlowService';
import { generateMergePrompt } from '@/services/geminiService';
import { normalizeImagesToUploadedImages } from '@/hooks/canvas/utils/nodeGenerationUtils';
import { createOutputNodeWithSkeleton, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode } from '@/hooks/canvas/utils/nodeGenerationUtils';
import { uploadImageToR2Auto } from '@/hooks/canvas/utils/r2UploadUtils';
import { getConnectedImages } from '@/utils/canvas/canvasNodeUtils';

interface UseMergeNodeHandlersParams {
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

export const useMergeNodeHandlers = ({
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
}: UseMergeNodeHandlersParams) => {
  const handleMergeGeneratePrompt = useCallback(async (nodeId: string, images: string[]) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'merge') return;

    const data = node.data as MergeNodeData;

    if (images.length < 2) {
      toast.error('Connect at least 2 images to generate prompt');
      return;
    }

    updateNodeData<MergeNodeData>(nodeId, { isGeneratingPrompt: true }, 'merge');

    try {
      const uploadedImages = await normalizeImagesToUploadedImages(images);
      const generatedPrompt = await generateMergePrompt(uploadedImages);

      updateNodeData<MergeNodeData>(nodeId, {
        prompt: generatedPrompt,
        isGeneratingPrompt: false,
      }, 'merge');

      toast.success('Prompt generated successfully!', { duration: 3000 });
    } catch (error: any) {
      updateNodeData<MergeNodeData>(nodeId, { isGeneratingPrompt: false }, 'merge');
      toast.error(error?.message || 'Failed to generate prompt', { duration: 5000 });
    }
  }, [nodesRef, updateNodeData]);

  const handleMergeGenerate = useCallback(async (nodeId: string, connectedImages: string[], prompt: string, model?: GeminiModel) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'merge') {
      console.warn('handleMergeGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const data = node.data as MergeNodeData;
    const connectedImagesFromData = data.connectedImages || [];

    let images: string[] = [];
    if (connectedImagesFromData.length > 0) {
      images = connectedImagesFromData;
    } else if (connectedImages.length > 0) {
      images = connectedImages;
    } else {
      images = getConnectedImages(nodeId, nodesRef.current, edgesRef.current);
    }

    if (images.length < 2) {
      toast.error('Connect at least 2 images to merge');
      return;
    }

    const selectedModel: GeminiModel = model || data.model || 'gemini-2.5-flash-image';
    const hasCredits = await validateCredits(selectedModel);
    if (!hasCredits) return;

    updateNodeLoadingState<MergeNodeData>(nodeId, true, 'merge');

    let newOutputNodeId: string | null = null;
    const skeletonNode = reactFlowInstance ? createOutputNodeWithSkeleton(node, nodeId, reactFlowInstance) : null;

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
      setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
    }

    try {
      const result = await combineImages(images, prompt, selectedModel);

      updateNodeLoadingState<MergeNodeData>(nodeId, false, 'merge');

      if (newOutputNodeId) {
        updateOutputNodeWithResult(
          newOutputNodeId,
          result,
          () => addToHistory(nodesRef.current, edgesRef.current),
          setNodes
        );

        if (canvasId) {
          await uploadImageToR2Auto(result, newOutputNodeId, canvasId, setNodes, (imageUrl) => {
            updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl, setNodes);
          });
        }
      }

      await refreshSubscriptionStatus();
      toast.success('Images merged successfully!', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId, setNodes, setEdges);
      updateNodeLoadingState<MergeNodeData>(nodeId, false, 'merge');
      toast.error(error?.message || 'Failed to merge images', { duration: 5000 });
    }
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId]);

  return {
    handleMergeGenerate,
    handleMergeGeneratePrompt,
  };
};

