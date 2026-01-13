/**
 * useAmbienceNodeHandlers
 * 
 * Handlers para gerenciar operações de geração de ambiência
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, AmbienceNodeData } from '@/types/reactFlow';
import type { ReactFlowInstance } from '@/types/reactflow-instance';
import { getAmbiencePreset } from '@/services/ambiencePresetsService';
import { generateImageWithPreset } from '@/hooks/canvas/utils/presetGenerationUtils';
import { createNodeDataUpdateHandler } from '@/hooks/canvas/utils/nodeDataUpdateUtils';

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
  const handleAmbienceNodeDataUpdate = createNodeDataUpdateHandler<AmbienceNodeData>(updateNodeData, 'ambience');

  const handleAmbienceGenerate = useCallback(async (nodeId: string, imageInput: string, presetId: string) => {
    const preset = getAmbiencePreset(presetId as any);
    if (!preset) {
      toast.error(`Ambience preset ${presetId} not found`);
      return;
    }

    const node = nodesRef.current.find(n => n.id === nodeId);
    const ambienceData = node?.data as AmbienceNodeData;

    await generateImageWithPreset({
      nodeId,
      nodeType: 'ambience',
      imageInput,
      presetId,
      preset,
      connectedImageFromData: ambienceData?.connectedImage,
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
      errorMessage: 'Connect an image to generate ambience',
      successMessage: 'Ambience applied successfully!',
    });
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeData, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId]);

  return {
    handleAmbienceGenerate,
    handleAmbienceNodeDataUpdate,
  };
};
