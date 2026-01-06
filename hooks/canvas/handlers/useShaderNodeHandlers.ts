/**
 * useShaderNodeHandlers
 * 
 * Handlers para aplicar efeitos de shader GLSL em imagens
 */

import { useCallback } from 'react';
import type { ShaderNodeData, FlowNodeData } from '../../../types/reactFlow';
import type { Node } from '@xyflow/react';
import { processImageOrVideoWithShader, isVideoInput } from '../utils/shaderProcessingUtils';
import { createNodeDataUpdateHandler } from '../utils/nodeDataUpdateUtils';

interface UseShaderNodeHandlersParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  canvasId?: string;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
}

export const useShaderNodeHandlers = ({
  nodesRef,
  updateNodeData,
  updateNodeLoadingState,
  canvasId,
  setNodes,
}: UseShaderNodeHandlersParams) => {
  const handleShaderApply = useCallback(async (nodeId: string, imageInput: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'shader') {
      console.warn('handleShaderApply: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const shaderData = node.data as ShaderNodeData;
    const connectedImageFromData = shaderData.connectedImage;
    const inputToUse = imageInput || connectedImageFromData || '';

    // Get shader type with default
    const shaderType = shaderData.shaderType ?? 'halftone';
    const halftoneVariant = shaderData.halftoneVariant ?? 'ellipse';
    
    // Get shader settings from node data
    const settings = {
      shaderType,
      halftoneVariant: shaderType === 'halftone' ? halftoneVariant : undefined,
      borderSize: 0, // Always 0, no borders
      // Halftone shader settings
      dotSize: shaderData.dotSize ?? 5.0,
      angle: shaderData.angle ?? 0.0,
      contrast: shaderData.contrast ?? 1.0,
      spacing: shaderData.spacing ?? 2.0,
      halftoneThreshold: shaderData.halftoneThreshold ?? 1.0,
      halftoneInvert: shaderData.halftoneInvert ?? 0.0,
      // VHS shader settings
      tapeWaveIntensity: shaderData.tapeWaveIntensity ?? 1.0,
      tapeCreaseIntensity: shaderData.tapeCreaseIntensity ?? 1.0,
      switchingNoiseIntensity: shaderData.switchingNoiseIntensity ?? 1.0,
      bloomIntensity: shaderData.bloomIntensity ?? 1.0,
      acBeatIntensity: shaderData.acBeatIntensity ?? 1.0,
      // Matrix Dither shader settings
      matrixSize: shaderData.matrixSize ?? 4.0,
      bias: shaderData.bias ?? 0.0,
      // Dither shader settings
      ditherSize: shaderData.ditherSize ?? 4.0,
      ditherContrast: shaderData.ditherContrast ?? 1.5,
      ditherOffset: shaderData.offset ?? 0.0,
      ditherBitDepth: shaderData.bitDepth ?? 4.0,
      ditherPalette: shaderData.palette ?? 0.0,
      // ASCII shader settings
      asciiCharSize: shaderData.asciiCharSize ?? 8.0,
      asciiContrast: shaderData.asciiContrast ?? 1.0,
      asciiBrightness: shaderData.asciiBrightness ?? 0.0,
      asciiCharSet: shaderData.asciiCharSet ?? 3.0,
      asciiColored: shaderData.asciiColored ?? 0.0,
      asciiInvert: shaderData.asciiInvert ?? 0.0,
      // Duotone shader settings
      duotoneShadowColor: shaderData.duotoneShadowColor ?? [0.1, 0.0, 0.2] as [number, number, number],
      duotoneHighlightColor: shaderData.duotoneHighlightColor ?? [0.3, 0.9, 0.9] as [number, number, number],
      duotoneIntensity: shaderData.duotoneIntensity ?? 1.0,
      duotoneContrast: shaderData.duotoneContrast ?? 1.0,
      duotoneBrightness: shaderData.duotoneBrightness ?? 0.0,
    };

    await processImageOrVideoWithShader<ShaderNodeData>({
      nodeId,
      nodeType: 'shader',
      imageInput: inputToUse,
      connectedImageFromData,
      settings,
      nodesRef,
      updateNodeData,
      updateNodeLoadingState,
      canvasId,
      setNodes,
      errorMessage: 'Connect an image or video to apply shader',
      videoSuccessMessage: 'Shader effect applied to video successfully!',
      isUpscale: false, // Shader uses debounce and compression
    });
  }, [nodesRef, updateNodeLoadingState, updateNodeData, canvasId, setNodes]);

  const handleShaderNodeDataUpdate = createNodeDataUpdateHandler<ShaderNodeData>(updateNodeData, 'shader');

  return {
    handleShaderApply,
    handleShaderNodeDataUpdate,
  };
};
