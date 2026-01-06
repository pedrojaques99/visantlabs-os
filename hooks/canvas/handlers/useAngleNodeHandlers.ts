/**
 * useAngleNodeHandlers
 * 
 * Handlers para gerenciar operações de geração de ângulos de imagem
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, AngleNodeData } from '../../../types/reactFlow';
import type { ReactFlowInstance } from '../../../types/reactflow-instance';
import { getAnglePreset } from '../../../services/anglePresetsService';
import { generateImageWithPreset } from '../utils/presetGenerationUtils';
import { createNodeDataUpdateHandler } from '../utils/nodeDataUpdateUtils';

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
  const handleAngleNodeDataUpdate = createNodeDataUpdateHandler<AngleNodeData>(updateNodeData, 'angle');

  const handleAngleGenerate = useCallback(async (nodeId: string, imageInput: string, angleId: string) => {
    const angle = getAnglePreset(angleId as any);
    if (!angle) {
      toast.error(`Angle ${angleId} not found`);
      return;
    }

    const node = nodesRef.current.find(n => n.id === nodeId);
    const angleData = node?.data as AngleNodeData;

    await generateImageWithPreset({
      nodeId,
      nodeType: 'angle',
      imageInput,
      presetId: angleId,
      preset: angle,
      connectedImageFromData: angleData?.connectedImage,
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
      errorMessage: 'Connect an image to generate angle',
      successMessage: 'Image angle generated successfully!',
    });
  }, [nodesRef, edgesRef, setNodes, setEdges, updateNodeData, updateNodeLoadingState, reactFlowInstance, addToHistory, refreshSubscriptionStatus, canvasId]);

  return {
    handleAngleGenerate,
    handleAngleNodeDataUpdate,
  };
};

