/**
 * useUpscaleBicubicNodeHandlers
 * 
 * Handlers para aplicar upscale bicúbico usando shader GLSL
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { UpscaleBicubicNodeData, FlowNodeData } from '../../../types/reactFlow';
import type { Node } from '@xyflow/react';
import { uploadImageToR2Auto } from '../utils/r2UploadUtils';
import { canvasApi } from '../../../services/canvasApi';
import { applyShaderEffect, applyShaderEffectToVideo } from '../../../utils/shaders/shaderRenderer';

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

    if (!inputToUse) {
      toast.error('Connect an image or video to upscale');
      return;
    }

    // Calculate input size
    const inputBase64 = inputToUse.includes(',') ? inputToUse.split(',')[1] : inputToUse;
    const inputSizeBytes = (inputBase64.length * 3) / 4;
    const inputSizeMB = (inputSizeBytes / 1024 / 1024).toFixed(2);
    
    logUpscale('Input image info', {
      inputSizeMB: `${inputSizeMB}MB`,
      isDataUrl: inputToUse.startsWith('data:'),
      isUrl: inputToUse.startsWith('http'),
    });

    updateNodeLoadingState<UpscaleBicubicNodeData>(nodeId, true, 'upscaleBicubic');

    try {
      // Check if input is a video
      const isVideo = inputToUse.startsWith('data:video/') || 
                     /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(inputToUse) ||
                     inputToUse.includes('video');

      // Get scale factor and sharpening with defaults
      const scaleFactor = upscaleData.scaleFactor ?? 2.0;
      const sharpening = upscaleData.sharpening ?? 0.3;
      
      logUpscale('Shader settings', { scaleFactor, sharpening, isVideo });
      
      // Get shader settings for upscale with sharpening
      const settings = {
        shaderType: 'upscale' as const,
        scaleFactor,
        upscaleSharpening: sharpening,
      };

      if (isVideo) {
        // Apply upscale shader effect to video (processes frame by frame)
        logUpscale('Processing video...');
        toast.info('Processing video frames...', { duration: 2000 });
        const resultVideoBase64 = await applyShaderEffectToVideo(inputToUse, settings, 30, 10);
        
        // Extract base64 from data URL if needed
        const videoBase64Only = resultVideoBase64.startsWith('data:')
          ? resultVideoBase64.split(',')[1] || resultVideoBase64
          : resultVideoBase64;

        logUpscale('Video processed', { resultLength: videoBase64Only.length });

        // Update node with result (but keep isLoading true until video is ready)
        updateNodeData<UpscaleBicubicNodeData>(nodeId, {
          resultVideoBase64: videoBase64Only,
          resultImageBase64: undefined, // Clear image result
          resultImageUrl: undefined,
        }, 'upscaleBicubic');

        // Wait a bit to ensure video data is available before hiding loading state
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            updateNodeLoadingState<UpscaleBicubicNodeData>(nodeId, false, 'upscaleBicubic');
          });
        });

        // Upload to R2 in background
        if (canvasId) {
          try {
            logUpscale('Uploading video to R2...');
            const videoUrl = await canvasApi.uploadVideoToR2(resultVideoBase64, canvasId, nodeId);
            logUpscale('Video uploaded to R2', { videoUrl });
            updateNodeData<UpscaleBicubicNodeData>(nodeId, {
              resultVideoUrl: videoUrl,
            }, 'upscaleBicubic');
          } catch (uploadError: any) {
            console.warn('Failed to upload video to R2:', uploadError);
            // Keep base64 as fallback
          }
        }

        toast.success('Video upscaled successfully!', { duration: 2000 });
      } else {
        // Apply upscale shader effect
        logUpscale('Applying shader effect...');
        const startTime = performance.now();
        const resultBase64 = await applyShaderEffect(inputToUse, undefined, undefined, settings);
        const shaderTime = performance.now() - startTime;
        
        // Extract base64 from data URL if needed
        const base64Only = resultBase64.startsWith('data:')
          ? resultBase64.split(',')[1] || resultBase64
          : resultBase64;

        // Calculate output size
        const outputSizeBytes = (base64Only.length * 3) / 4;
        const outputSizeMB = (outputSizeBytes / 1024 / 1024).toFixed(2);
        
        logUpscale('Shader effect applied', {
          shaderTimeMs: shaderTime.toFixed(0),
          outputSizeMB: `${outputSizeMB}MB`,
          sizeIncrease: `${((outputSizeBytes / inputSizeBytes) * 100).toFixed(0)}%`,
        });

        // Update node with result IMMEDIATELY - show base64 right away
        updateNodeData<UpscaleBicubicNodeData>(nodeId, {
          resultImageBase64: base64Only,
          resultVideoBase64: undefined, // Clear video result
          resultVideoUrl: undefined,
        }, 'upscaleBicubic');

        logUpscale('Node updated with base64 result');

        // Set loading to false IMMEDIATELY so the image displays right away
        updateNodeLoadingState<UpscaleBicubicNodeData>(nodeId, false, 'upscaleBicubic');

        // Upload to R2 immediately (direct upload, no debounce, NO COMPRESSION)
        // Upscale results should preserve maximum quality
        if (canvasId) {
          logUpscale('Starting R2 upload...', { 
            canvasId, 
            nodeId,
            skipCompression: true,
            imageSizeMB: outputSizeMB,
          });
          
          uploadImageToR2Auto(
            base64Only,
            nodeId,
            canvasId,
            setNodes,
            (imageUrl) => {
              logUpscale('R2 upload complete!', { imageUrl });
              updateNodeData<UpscaleBicubicNodeData>(nodeId, {
                resultImageUrl: imageUrl,
              }, 'upscaleBicubic');
            },
            { skipCompression: true } // Preserve upscale quality - no compression
          ).catch((uploadError: any) => {
            logUpscale('R2 upload failed', { error: uploadError.message });
            console.warn('Failed to upload image to R2:', uploadError);
            // Keep base64 as fallback
          });
        } else {
          logUpscale('Skipping R2 upload - no canvasId');
        }
      }
    } catch (error: any) {
      logUpscale('Error in upscale process', { error: error.message, stack: error.stack });
      console.error('Error applying upscale bicubic:', error);
      updateNodeLoadingState<UpscaleBicubicNodeData>(nodeId, false, 'upscaleBicubic');
      toast.error(error?.message || 'Failed to upscale image', { duration: 5000 });
    }
  }, [nodesRef, updateNodeLoadingState, updateNodeData, canvasId, setNodes]);

  const handleUpscaleBicubicNodeDataUpdate = useCallback((nodeId: string, newData: Partial<UpscaleBicubicNodeData>) => {
    updateNodeData<UpscaleBicubicNodeData>(nodeId, newData, 'upscaleBicubic');
  }, [updateNodeData]);

  return {
    handleUpscaleBicubicApply,
    handleUpscaleBicubicNodeDataUpdate,
  };
};

