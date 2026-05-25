/**
 * useStudio3DNodeHandlers
 *
 * Handles Studio3D node data updates. The actual rendering/snapshot happens
 * inside the node component's modal editor — this handler manages data sync.
 */

import { useCallback } from 'react';
import type { Studio3DNodeData, FlowNodeData } from '@/types/reactFlow';
import type { Node } from '@xyflow/react';
import { createNodeDataUpdateHandler } from '@/hooks/canvas/utils/nodeDataUpdateUtils';

interface UseStudio3DNodeHandlersParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  canvasId?: string;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
}

export const useStudio3DNodeHandlers = ({
  updateNodeData,
}: UseStudio3DNodeHandlersParams) => {
  const handleStudio3DApply = useCallback(async (_nodeId: string) => {
    // Rendering is handled by the node component's modal editor.
    // The snapshot is taken on modal close and saved via onUpdateData.
    // This handler exists for API consistency but is a no-op.
  }, []);

  const handleStudio3DNodeDataUpdate = createNodeDataUpdateHandler<Studio3DNodeData>(updateNodeData, 'studio3d');

  return { handleStudio3DApply, handleStudio3DNodeDataUpdate };
};
