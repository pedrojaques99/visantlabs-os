/**
 * nodeGenerationUtils
 * 
 * Utilitários compartilhados para criação de output nodes e validação de créditos
 */

import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, OutputNodeData } from '../../../types/reactFlow';
import type { ReactFlowInstance } from '../../../types/reactflow-instance';
import { generateNodeId } from '../../../utils/canvas/canvasNodeUtils';
import { cleanEdgeHandles } from '../../../utils/canvas/canvasNodeUtils';
import { validateCredits, normalizeImageToBase64, detectMimeType } from '../../../services/reactFlowService';
import type { GeminiModel, Resolution, UploadedImage } from '../../../types';

/**
 * Create OutputNode with skeleton loading for generated images
 */
export const createOutputNodeWithSkeleton = (
  sourceNode: Node<FlowNodeData>,
  sourceNodeId: string,
  reactFlowInstance: ReactFlowInstance | null
): { node: Node<FlowNodeData>; edge: Edge; nodeId: string } | null => {
  if (!reactFlowInstance) {
    console.warn('[createOutputNodeWithSkeleton] reactFlowInstance is not available');
    return null;
  }

  const offsetX = 350;
  const newPosition = {
    x: sourceNode.position.x + offsetX,
    y: sourceNode.position.y,
  };

  const newOutputNodeId = generateNodeId('output');
  const newOutputNode: Node<FlowNodeData> = {
    id: newOutputNodeId,
    type: 'output',
    position: newPosition,
    data: {
      type: 'output',
      isLoading: true,
      sourceNodeId,
      onView: (imageUrl: string) => {
        window.open(imageUrl, '_blank');
      },
    } as OutputNodeData,
  };

  const newEdge: Edge = cleanEdgeHandles({
    id: `edge-${sourceNode.id}-${newOutputNodeId}`,
    source: sourceNode.id,
    target: newOutputNodeId,
    type: 'default',
    sourceHandle: undefined,
    targetHandle: undefined,
  });

  return { node: newOutputNode, edge: newEdge, nodeId: newOutputNodeId };
};

/**
 * Validate credits before operation
 */
export const validateAndDeductCredits = async (
  model: GeminiModel,
  resolution?: Resolution
): Promise<boolean> => {
  return await validateCredits(model, resolution);
};

/**
 * Cleanup failed node and its edges
 */
export const cleanupFailedNode = (
  nodeId: string | null,
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
) => {
  if (!nodeId) return;
  setNodes((nds: Node<FlowNodeData>[]) => nds.filter(n => n.id !== nodeId));
  setEdges((eds: Edge[]) => eds.filter(e => e.target !== nodeId && e.source !== nodeId));
};

/**
 * Normalize images to UploadedImage array
 */
export const normalizeImagesToUploadedImages = async (images: string[]): Promise<UploadedImage[]> => {
  return Promise.all(
    images.map(async (image) => {
      const base64 = await normalizeImageToBase64(image);
      const mimeType = detectMimeType(image);
      return { base64, mimeType };
    })
  );
};

/**
 * Validate base64 image format
 */
export const validateBase64Image = (base64: string): boolean => {
  if (!base64 || base64.trim().length === 0) {
    return false;
  }
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  return base64Regex.test(base64);
};

/**
 * Update OutputNode with result
 */
export const updateOutputNodeWithResult = (
  nodeId: string,
  result: string,
  addToHistoryCallback: () => void,
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void
) => {
  setNodes((nds: Node<FlowNodeData>[]) => {
    const updatedNodes = nds.map((n: Node<FlowNodeData>) => {
      if (n.id === nodeId && n.type === 'output') {
        const outputData = n.data as OutputNodeData;
        const safeResult = typeof result === 'string' ? result : '';

        // Improved URL detection:
        // 1. Check for standard protocols (http/https)
        // 2. Check for relative paths (/)
        // 3. Check for specific R2/storage patterns if needed
        const isUrl = safeResult.startsWith('http://') ||
          safeResult.startsWith('https://') ||
          safeResult.startsWith('/') ||
          safeResult.startsWith('./');



        return {
          ...n,
          data: {
            ...outputData,
            resultImageUrl: isUrl ? safeResult : undefined,
            resultImageBase64: isUrl ? undefined : safeResult,
            isLoading: false,
          } as OutputNodeData,
        } as Node<FlowNodeData>;
      }
      return n;
    });
    setTimeout(() => {
      addToHistoryCallback();
    }, 0);
    return updatedNodes;
  });
};

/**
 * Update OutputNode with R2 URL and remove base64 to save memory
 */
export const updateOutputNodeWithR2Url = (
  nodeId: string,
  imageUrl: string,
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void
) => {
  setNodes((nds: Node<FlowNodeData>[]) => {
    return nds.map((n: Node<FlowNodeData>) => {
      if (n.id === nodeId && n.type === 'output') {
        const outputData = n.data as OutputNodeData;
        return {
          ...n,
          data: {
            ...outputData,
            resultImageUrl: imageUrl,
            resultImageBase64: undefined, // Remove base64 after R2 upload to save memory
          } as OutputNodeData,
        } as Node<FlowNodeData>;
      }
      return n;
    });
  });
};

