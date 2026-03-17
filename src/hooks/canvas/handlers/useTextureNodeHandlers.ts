/**
 * useTextureNodeHandlers
 * 
 * Handlers para gerenciar operações de geração de texturas
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, TextureNodeData } from '@/types/reactFlow';
import type { ReactFlowInstance } from '@/types/reactflow-instance';
import { getTexturePreset } from '@/services/texturePresetsService';
import { generateImageWithPreset } from '@/hooks/canvas/utils/presetGenerationUtils';
import { createNodeDataUpdateHandler } from '@/hooks/canvas/utils/nodeDataUpdateUtils';
import { uploadImageToR2Auto } from '@/hooks/canvas/utils/r2UploadUtils';
import { getBrandContextForNode, buildEnhancement } from '@/hooks/canvas/useBrandContext';
import type { BrandGuideline } from '@/lib/figma-types';

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
  linkedGuideline?: BrandGuideline | null;
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
  linkedGuideline,
}: UseTextureNodeHandlersParams) => {
  const handleTextureNodeDataUpdate = createNodeDataUpdateHandler<TextureNodeData>(updateNodeData, 'texture');

  const handleTextureGenerate = useCallback(async (nodeId: string, imageInput: string, presetId: string) => {
    const preset = getTexturePreset(presetId as any);
    if (!preset) {
      toast.error(`Texture preset ${presetId} not found`);
      return;
    }

    const node = nodesRef.current.find(n => n.id === nodeId);
    const textureData = node?.data as TextureNodeData;

    const { tokens } = getBrandContextForNode(nodeId, nodesRef.current, edgesRef.current, linkedGuideline);
    const promptOverride = tokens ? buildEnhancement(preset.prompt, tokens) : undefined;

    await generateImageWithPreset({
      nodeId,
      nodeType: 'texture',
      imageInput,
      presetId,
      preset,
      connectedImageFromData: textureData?.connectedImage,
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
      errorMessage: 'Connect an image to generate texture',
      successMessage: 'Texture applied successfully!',
      promptOverride,
      onSuccess: async (nodeId: string, resultImageBase64: string) => {
        // Update source node with result so manually connected nodes work
        updateNodeData<TextureNodeData>(nodeId, {
          isLoading: false,
          resultImageBase64: resultImageBase64,
        } as any, 'texture');

        // Also upload to R2 for the TextureNode itself
        if (canvasId) {
          await uploadImageToR2Auto(resultImageBase64, nodeId, canvasId, setNodes, (imageUrl) => {
            updateNodeData<TextureNodeData>(nodeId, {
              resultImageUrl: imageUrl,
              resultImageBase64: undefined,
            } as any, 'texture');
          });
        }
      },
    });
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeData, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId, linkedGuideline]);

  return {
    handleTextureGenerate,
    handleTextureNodeDataUpdate,
  };
};
