/**
 * useUpscaleBicubicNodeHandlers
 * 
 * Handlers para aplicar upscale bicúbico usando shader GLSL
 */

import { useCallback } from 'react';
import type { UpscaleBicubicNodeData, FlowNodeData } from '../../../types/reactFlow';
import type { Node } from '@xyflow/react';
import { processImageOrVideoWithShader } from '../utils/shaderProcessingUtils';
import { createNodeDataUpdateHandler } from '../utils/nodeDataUpdateUtils';

interface UseUpscaleBicubicNodeHandlersParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  canvasId?: string;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
}

// Dev logging helper
const logUpscale = (message: string, data?: any) => {
  console.log(`[UpscaleBicubic] ${message}`, data ?? '');
};

export const useUpscaleBicubicNodeHandlers = ({
  nodesRef,
  updateNodeData,
  updateNodeLoadingState,
  canvasId,
  setNodes,
}: UseUpscaleBicubicNodeHandlersParams) => {
  const handleUpscaleBicubicApply = useCallback(async (nodeId: string, imageInput: string) => {
    logUpscale('Starting upscale process', { nodeId, inputLength: imageInput?.length ?? 0 });
    
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'upscaleBicubic') {
      console.warn('handleUpscaleBicubicApply: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const upscaleData = node.data as UpscaleBicubicNodeData;
    const connectedImageFromData = upscaleData.connectedImage;
    const inputToUse = imageInput || connectedImageFromData || '';

    // Calculate input size for logging
    const inputBase64 = inputToUse.includes(',') ? inputToUse.split(',')[1] : inputToUse;
    const inputSizeBytes = (inputBase64.length * 3) / 4;
    const inputSizeMB = (inputSizeBytes / 1024 / 1024).toFixed(2);
    
    logUpscale('Input image info', {
      inputSizeMB: `${inputSizeMB}MB`,
      isDataUrl: inputToUse.startsWith('data:'),
      isUrl: inputToUse.startsWith('http'),
    });

    // Get scale factor and sharpening with defaults
    const scaleFactor = upscaleData.scaleFactor ?? 2.0;
    const sharpening = upscaleData.sharpening ?? 0.3;
    
    logUpscale('Shader settings', { scaleFactor, sharpening });
    
    // Get shader settings for upscale with sharpening
    const settings = {
      shaderType: 'upscale' as const,
      scaleFactor,
      upscaleSharpening: sharpening,
    };

    await processImageOrVideoWithShader<UpscaleBicubicNodeData>({
      nodeId,
      nodeType: 'upscaleBicubic',
      imageInput: inputToUse,
      connectedImageFromData,
      settings,
      nodesRef,
      updateNodeData,
      updateNodeLoadingState,
      canvasId,
      setNodes,
      errorMessage: 'Connect an image or video to upscale',
      videoSuccessMessage: 'Video upscaled successfully!',
      isUpscale: true, // Upscale: no debounce, skip compression
      onImageResult: (resultBase64) => {
        // Log output size after processing
        const outputSizeBytes = (resultBase64.length * 3) / 4;
        const outputSizeMB = (outputSizeBytes / 1024 / 1024).toFixed(2);
        logUpscale('Upscale complete', {
          outputSizeMB: `${outputSizeMB}MB`,
          sizeIncrease: `${((outputSizeBytes / inputSizeBytes) * 100).toFixed(0)}%`,
        });
      },
    });
  }, [nodesRef, updateNodeLoadingState, updateNodeData, canvasId, setNodes]);

  const handleUpscaleBicubicNodeDataUpdate = createNodeDataUpdateHandler<UpscaleBicubicNodeData>(updateNodeData, 'upscaleBicubic');

  return {
    handleUpscaleBicubicApply,
    handleUpscaleBicubicNodeDataUpdate,
  };
};
