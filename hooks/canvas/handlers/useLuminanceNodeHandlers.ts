/**
 * useLuminanceNodeHandlers
 * 
 * Handlers para gerenciar operações de geração de Iluminação
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, LuminanceNodeData } from '../../../types/reactFlow';
import type { ReactFlowInstance } from '../../../types/reactflow-instance';
import { getLuminancePreset } from '../../../services/luminancePresetsService';
import { generateImageWithPreset } from '../utils/presetGenerationUtils';
import { createNodeDataUpdateHandler } from '../utils/nodeDataUpdateUtils';

interface UseLuminanceNodeHandlersParams {
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

export const useLuminanceNodeHandlers = ({
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
}: UseLuminanceNodeHandlersParams) => {
  const handleLuminanceNodeDataUpdate = createNodeDataUpdateHandler<LuminanceNodeData>(updateNodeData, 'luminance');

  const handleLuminanceGenerate = useCallback(async (nodeId: string, imageInput: string, presetId: string) => {
    const preset = getLuminancePreset(presetId as any);
    if (!preset) {
      toast.error(`Luminance preset ${presetId} not found`);
      return;
    }

    const node = nodesRef.current.find(n => n.id === nodeId);
    const luminanceData = node?.data as LuminanceNodeData;

    await generateImageWithPreset({
      nodeId,
      nodeType: 'luminance',
      imageInput,
      presetId,
      preset,
      connectedImageFromData: luminanceData?.connectedImage,
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
      errorMessage: 'Connect an image to generate luminance',
      successMessage: 'Luminance applied successfully!',
    });
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeData, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId]);

  return {
    handleLuminanceGenerate,
    handleLuminanceNodeDataUpdate,
  };
};
