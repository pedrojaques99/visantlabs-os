/**
 * shaderProcessingUtils
 * 
 * Utilitários compartilhados para processamento de vídeo/imagem com shader
 * (shader e upscaleBicubic têm lógica similar)
 */

import { toast } from 'sonner';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import type { ReactFlowInstance } from '@/types/reactflow-instance';
import { canvasApi } from '@/services/canvasApi';
import { applyShaderEffect, applyShaderEffectToVideo } from '@/utils/shaders/shaderRenderer';
import type { ShaderSettings as ShaderRendererSettings } from '@/utils/shaders/shaderRenderer';
import { uploadImageToR2Auto, uploadImageToR2Debounced } from './r2UploadUtils';

interface ShaderProcessingParams<T extends FlowNodeData> {
  nodeId: string;
  nodeType: string;
  imageInput: string;
  connectedImageFromData?: string;
  settings: ShaderRendererSettings;
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <U extends FlowNodeData>(nodeId: string, newData: Partial<U>, nodeType?: string) => void;
  updateNodeLoadingState: <U extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  canvasId?: string;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  errorMessage?: string;
  videoSuccessMessage?: string;
  isUpscale?: boolean; // true for upscale (no debounce, skip compression), false for shader (debounce, compression)
  onImageResult?: (resultBase64: string) => void;
  onVideoResult?: (resultVideoBase64: string) => void;
}

/**
 * Detect if input is a video
 */
export const isVideoInput = (input: string): boolean => {
  return input.startsWith('data:video/') ||
    /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(input) ||
    input.includes('video');
};

/**
 * Extract base64 from data URL
 */
export const extractBase64 = (dataUrl: string): string => {
  return dataUrl.startsWith('data:')
    ? dataUrl.split(',')[1] || dataUrl
    : dataUrl;
};

/**
 * Process image or video with shader effect
 */
export const processImageOrVideoWithShader = async <T extends FlowNodeData>({
  nodeId,
  nodeType,
  imageInput,
  connectedImageFromData,
  settings,
  nodesRef,
  updateNodeData,
  updateNodeLoadingState,
  canvasId,
  setNodes,
  errorMessage = 'Connect an image or video to apply effect',
  videoSuccessMessage = 'Effect applied to video successfully!',
  isUpscale = false,
  onImageResult,
  onVideoResult,
}: ShaderProcessingParams<T>): Promise<void> => {
  const node = nodesRef.current.find(n => n.id === nodeId);
  if (!node || node.type !== nodeType) {
    console.warn(`processImageOrVideoWithShader: Node not found or wrong type`, { nodeId, nodeType, foundNode: !!node });
    return;
  }

  const inputToUse = imageInput || connectedImageFromData || '';

  if (!inputToUse) {
    toast.error(errorMessage);
    return;
  }

  updateNodeLoadingState<T>(nodeId, true, nodeType);

  try {
    const isVideo = isVideoInput(inputToUse);

    if (isVideo) {
      // Process video
      toast.info('Processing video frames...', { duration: 2000 });
      const resultVideoBase64 = await applyShaderEffectToVideo(inputToUse, settings, 30, 10);
      const videoBase64Only = extractBase64(resultVideoBase64);

      // Update node with video result
      updateNodeData<T>(nodeId, {
        resultVideoBase64: videoBase64Only,
        resultImageBase64: undefined,
        resultImageUrl: undefined,
      } as Partial<T>, nodeType);

      // Wait for render cycle before hiding loading
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateNodeLoadingState<T>(nodeId, false, nodeType);
        });
      });

      // Upload video to R2
      if (canvasId) {
        try {
          const videoUrl = await canvasApi.uploadVideoToR2(resultVideoBase64, canvasId, nodeId);
          updateNodeData<T>(nodeId, {
            resultVideoUrl: videoUrl,
          } as Partial<T>, nodeType);
        } catch (uploadError: any) {
          console.warn('Failed to upload video to R2:', uploadError);
        }
      }

      if (onVideoResult) {
        onVideoResult(videoBase64Only);
      }

      toast.success(videoSuccessMessage, { duration: 2000 });
    } else {
      // Process image
      const resultBase64 = await applyShaderEffect(inputToUse, undefined, undefined, settings);
      const base64Only = extractBase64(resultBase64);

      // Update node immediately with base64
      updateNodeData<T>(nodeId, {
        resultImageBase64: base64Only,
        resultVideoBase64: undefined,
        resultVideoUrl: undefined,
      } as Partial<T>, nodeType);

      updateNodeLoadingState<T>(nodeId, false, nodeType);

      // Upload to R2 (with debounce for shader, direct for upscale)
      if (canvasId) {
        if (isUpscale) {
          // Direct upload for upscale (no compression)
          uploadImageToR2Auto(
            base64Only,
            nodeId,
            canvasId,
            setNodes,
            (imageUrl) => {
              updateNodeData<T>(nodeId, {
                resultImageUrl: imageUrl,
              } as Partial<T>, nodeType);
            },
            { skipCompression: true }
          ).catch((uploadError: any) => {
            console.warn('Failed to upload image to R2:', uploadError);
          });
        } else {
          // Debounced upload for shader
          uploadImageToR2Debounced(
            base64Only,
            nodeId,
            canvasId,
            setNodes,
            (imageUrl) => {
              updateNodeData<T>(nodeId, {
                resultImageUrl: imageUrl,
              } as Partial<T>, nodeType);
            },
            4000
          );
        }
      }

      if (onImageResult) {
        onImageResult(base64Only);
      }

      // Don't show success notification for images (user can see result visually)
    }
  } catch (error: any) {
    console.error(`Error processing ${nodeType}:`, error);
    updateNodeLoadingState<T>(nodeId, false, nodeType);
    toast.error(error?.message || `Failed to process ${nodeType}`, { duration: 5000 });
  }
};

