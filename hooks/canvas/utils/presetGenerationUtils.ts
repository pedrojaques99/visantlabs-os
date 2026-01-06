/**
 * presetGenerationUtils
 * 
 * Utilitários compartilhados para geração de imagens com presets
 * (angle, texture, ambience, luminance seguem o mesmo padrão)
 */

import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../../../types/reactFlow';
import type { UploadedImage } from '../../../types';
import type { ReactFlowInstance } from '../../../types/reactflow-instance';
import { normalizeImageToBase64, detectMimeType, validateCredits } from '../../../services/reactFlowService';
import { mockupApi } from '../../../services/mockupApi';
import type { Resolution, GeminiModel } from '../../../types';
import { 
  createOutputNodeWithSkeleton, 
  validateBase64Image, 
  updateOutputNodeWithResult, 
  updateOutputNodeWithR2Url, 
  cleanupFailedNode 
} from './nodeGenerationUtils';
import { uploadImageToR2Auto } from './r2UploadUtils';

interface Preset {
  id: string;
  prompt: string;
  model?: string;
  aspectRatio?: string;
}

interface PresetGenerationParams {
  nodeId: string;
  nodeType: 'angle' | 'texture' | 'ambience' | 'luminance';
  imageInput: string;
  presetId: string;
  preset: Preset;
  connectedImageFromData?: string;
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
  errorMessage?: string;
  successMessage?: string;
  onSuccess?: (nodeId: string, resultImageBase64: string) => void;
}

export const generateImageWithPreset = async ({
  nodeId,
  nodeType,
  imageInput,
  presetId,
  preset,
  connectedImageFromData,
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
  errorMessage = `Connect an image to generate ${nodeType}`,
  successMessage = `${nodeType} applied successfully!`,
  onSuccess,
}: PresetGenerationParams): Promise<void> => {
  const node = nodesRef.current.find(n => n.id === nodeId);
  if (!node || node.type !== nodeType) {
    console.warn(`generateImageWithPreset: Node not found or wrong type`, { nodeId, nodeType, foundNode: !!node });
    return;
  }

  const imageToUse = imageInput || connectedImageFromData || '';

  if (!imageToUse) {
    toast.error(errorMessage);
    return;
  }

    const model: GeminiModel = (preset.model as GeminiModel) || 'gemini-2.5-flash-image';
    const resolution: Resolution = model === 'gemini-3-pro-image-preview' ? '4K' : '1K';

    const hasCredits = await validateCredits(model, resolution);
  if (!hasCredits) return;

  updateNodeLoadingState(nodeId, true, nodeType);

  let imageBase64: string;
  try {
    imageBase64 = await normalizeImageToBase64(imageToUse);
    if (!validateBase64Image(imageBase64)) {
      throw new Error('Invalid base64 format after conversion');
    }
  } catch (error: any) {
    toast.error(error?.message || 'Failed to process image');
    updateNodeLoadingState(nodeId, false, nodeType);
    return;
  }

  let newOutputNodeId: string | null = null;
  const skeletonNode = reactFlowInstance ? createOutputNodeWithSkeleton(node, nodeId, reactFlowInstance) : null;

  if (skeletonNode) {
    newOutputNodeId = skeletonNode.nodeId;
    addToHistory(nodesRef.current, edgesRef.current);
    setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
    setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
  }

  try {
    const mimeType = detectMimeType(imageInput || connectedImageFromData || '');
    const baseImage: UploadedImage = {
      base64: imageBase64,
      mimeType,
    };

    const result = await mockupApi.generate({
      promptText: preset.prompt,
      baseImage: {
        base64: baseImage.base64,
        mimeType: baseImage.mimeType
      },
      model: model,
      resolution: resolution,
      aspectRatio: preset.aspectRatio,
      referenceImages: undefined,
      imagesCount: 1,
      feature: 'canvas'
    });

    updateNodeLoadingState(nodeId, false, nodeType);

    // Custom success handler for texture node (updates source node too)
    if (onSuccess && result.imageBase64) {
      onSuccess(nodeId, result.imageBase64);
    }

    if (newOutputNodeId) {
      const resultImage = result.imageUrl || result.imageBase64 || '';
      updateOutputNodeWithResult(
        newOutputNodeId,
        resultImage,
        () => addToHistory(nodesRef.current, edgesRef.current),
        setNodes
      );

      if (canvasId && result.imageBase64) {
        await uploadImageToR2Auto(result.imageBase64, newOutputNodeId, canvasId, setNodes, (imageUrl) => {
          updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl, setNodes);
        });
      }
    }

    try {
      await refreshSubscriptionStatus();
    } catch (statusError: any) {
      console.error('Failed to refresh subscription status:', statusError);
    }

    toast.success(successMessage, { duration: 3000 });
  } catch (error: any) {
    cleanupFailedNode(newOutputNodeId, setNodes, setEdges);
    updateNodeLoadingState(nodeId, false, nodeType);
    toast.error(error?.message || `Failed to generate ${nodeType}`, { duration: 5000 });
  }
};

