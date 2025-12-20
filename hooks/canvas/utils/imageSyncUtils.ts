/**
 * imageSyncUtils
 * 
 * Utilitários compartilhados para sincronização de imagens com edges
 */

import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, ImageNodeData, OutputNodeData, EditNodeData } from '../../../types/reactFlow';
import { getImageUrl } from '../../../utils/imageUtils';

/**
 * Get image base64 from a source node (ImageNode or OutputNode)
 */
export const getImageBase64FromNode = (
  sourceNode: Node<FlowNodeData>
): string | undefined => {
  if (sourceNode.type === 'image') {
    const imageData = sourceNode.data as ImageNodeData;
    return imageData.mockup?.imageBase64;
  } else if (sourceNode.type === 'output') {
    const outputData = sourceNode.data as OutputNodeData;
    if (outputData.resultImageBase64) {
      // Extract base64 from data URL if needed
      return outputData.resultImageBase64.startsWith('data:')
        ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
        : outputData.resultImageBase64;
    }
  }
  return undefined;
};

/**
 * Get image URL from a source node (ImageNode or OutputNode)
 */
export const getImageUrlFromNode = (
  sourceNode: Node<FlowNodeData>
): string | undefined => {
  if (sourceNode.type === 'image') {
    const imageData = sourceNode.data as ImageNodeData;
    return getImageUrl(imageData.mockup);
  } else if (sourceNode.type === 'output') {
    const outputData = sourceNode.data as OutputNodeData;
    if (outputData.resultImageUrl) {
      return outputData.resultImageUrl;
    } else if (outputData.resultImageBase64) {
      const base64 = outputData.resultImageBase64.startsWith('data:')
        ? outputData.resultImageBase64
        : `data:image/png;base64,${outputData.resultImageBase64}`;
      return base64;
    }
  }
  return undefined;
};

/**
 * Sync EditNode with connected image
 */
export const syncEditNodeImage = (
  node: Node<FlowNodeData>,
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Partial<EditNodeData> | null => {
  if (node.type !== 'edit') return null;

  const editData = node.data as EditNodeData;
  const connectedEdge = edges.find(e => e.target === node.id);
  const sourceNode = connectedEdge ? nodes.find(n => n.id === connectedEdge.source) : null;
  const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'output';
  
  if (hasConnectedImage && connectedEdge && sourceNode) {
    const imageBase64 = getImageBase64FromNode(sourceNode);
    
    if (imageBase64 && (!editData.uploadedImage || editData.uploadedImage.base64 !== imageBase64)) {
      return {
        uploadedImage: {
          base64: imageBase64,
          mimeType: 'image/png',
        },
      };
    }
  }
  
  return null;
};










