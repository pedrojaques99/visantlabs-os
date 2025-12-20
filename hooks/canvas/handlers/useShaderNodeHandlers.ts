/**
 * useShaderNodeHandlers
 * 
 * Handlers para aplicar efeitos de shader GLSL em imagens
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ShaderNodeData, FlowNodeData } from '../../../types/reactFlow';
import type { Node } from '@xyflow/react';
import { uploadImageToR2Auto, uploadImageToR2Debounced } from '../utils/r2UploadUtils';
import { canvasApi } from '../../../services/canvasApi';
import { applyShaderEffect, applyShaderEffectToVideo } from '../../../utils/shaders/shaderRenderer';

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

    if (!inputToUse) {
      toast.error('Connect an image or video to apply shader');
      return;
    }

    updateNodeLoadingState<ShaderNodeData>(nodeId, true, 'shader');

    try {
      // Check if input is a video
      const isVideo = inputToUse.startsWith('data:video/') || 
                     /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(inputToUse) ||
                     inputToUse.includes('video');

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

      if (isVideo) {
        // Apply shader effect to video (processes frame by frame)
        toast.info('Processing video frames...', { duration: 2000 });
        const resultVideoBase64 = await applyShaderEffectToVideo(inputToUse, settings, 30, 10);
        
        // Extract base64 from data URL if needed
        const videoBase64Only = resultVideoBase64.startsWith('data:')
          ? resultVideoBase64.split(',')[1] || resultVideoBase64
          : resultVideoBase64;

        // Update node with result (but keep isLoading true until video is ready)
        updateNodeData<ShaderNodeData>(nodeId, {
          resultVideoBase64: videoBase64Only,
          resultImageBase64: undefined, // Clear image result
          resultImageUrl: undefined,
        }, 'shader');

        // Wait a bit to ensure video data is available before hiding loading state
        // Use requestAnimationFrame to wait for next render cycle
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Now set isLoading to false after video data is set
            updateNodeLoadingState<ShaderNodeData>(nodeId, false, 'shader');
          });
        });

        // Upload to R2 in background
        if (canvasId) {
          try {
            const videoUrl = await canvasApi.uploadVideoToR2(resultVideoBase64, canvasId, nodeId);
            updateNodeData<ShaderNodeData>(nodeId, {
              resultVideoUrl: videoUrl,
            }, 'shader');
          } catch (uploadError: any) {
            console.warn('Failed to upload video to R2:', uploadError);
            // Keep base64 as fallback
          }
        }

        // Video processing takes longer, so show success notification
        toast.success('Shader effect applied to video successfully!', { duration: 2000 });
      } else {
        // Apply shader effect (maintains 1:1 quality - original dimensions)
        const resultBase64 = await applyShaderEffect(inputToUse, undefined, undefined, settings);
        
        // Extract base64 from data URL if needed
        const base64Only = resultBase64.startsWith('data:')
          ? resultBase64.split(',')[1] || resultBase64
          : resultBase64;

        // Update node with result IMMEDIATELY - show base64 right away
        // This ensures the image appears instantly without waiting for R2 upload
        updateNodeData<ShaderNodeData>(nodeId, {
          resultImageBase64: base64Only,
          resultVideoBase64: undefined, // Clear video result
          resultVideoUrl: undefined,
        }, 'shader');

        // Set loading to false IMMEDIATELY so the image displays right away
        // No need to wait for render cycles - React will update when data changes
        updateNodeLoadingState<ShaderNodeData>(nodeId, false, 'shader');

        // Upload to R2 in background (completely optional, non-blocking)
        // This happens asynchronously and doesn't affect the display of base64
        // Only upload if canvasId is available (user is authenticated and has a project)
        if (canvasId) {
          // Use debounce to avoid blocking during rapid slider changes
          uploadImageToR2Debounced(
            base64Only,
            nodeId,
            canvasId,
            setNodes,
            (imageUrl) => {
              // Update with R2 URL when upload completes (base64 remains as fallback)
              updateNodeData<ShaderNodeData>(nodeId, {
                resultImageUrl: imageUrl,
                // Keep resultImageBase64 - don't remove it, it's needed for immediate display
              }, 'shader');
            },
            4000 // 4 second debounce - upload after user stops editing
          );
        }
        // If no canvasId (not authenticated or no project), just keep base64
        // The image will display from base64 immediately

        // Don't show success notification for images - user can see the result visually
        // Only show notifications for errors or long-running operations (like video)
      }
    } catch (error: any) {
      console.error('Error applying shader:', error);
      updateNodeLoadingState<ShaderNodeData>(nodeId, false, 'shader');
      toast.error(error?.message || 'Failed to apply shader effect', { duration: 5000 });
    }
  }, [nodesRef, updateNodeLoadingState, updateNodeData, canvasId, setNodes]);

  const handleShaderNodeDataUpdate = useCallback((nodeId: string, newData: Partial<ShaderNodeData>) => {
    updateNodeData<ShaderNodeData>(nodeId, newData, 'shader');
  }, [updateNodeData]);

  return {
    handleShaderApply,
    handleShaderNodeDataUpdate,
  };
};

