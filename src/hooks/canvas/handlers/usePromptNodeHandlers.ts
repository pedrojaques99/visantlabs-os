import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, PromptNodeData, TextNodeData } from '@/types/reactFlow';
import type { GeminiModel, Resolution, UploadedImage } from '@/types/types';
import type { BrandGuideline } from '@/lib/figma-types';
import { validateCredits } from '@/services/reactFlowService';
import { mockupApi } from '@/services/mockupApi';
import { aiApi } from '@/services/aiApi';
import { normalizeImagesToUploadedImages } from '../utils/nodeGenerationUtils';
import { getBrandContextForNode, buildEnhancement } from '../useBrandContext';
import {
  DEFAULT_MODEL,
  DEFAULT_ASPECT_RATIO,
  isAdvancedModel,
  getMaxHandles,
  getMaxRefImages,
  getDefaultResolution,
  getModelConfig,
} from '@/constants/geminiModels';
import { toast } from 'sonner';

interface UsePromptNodeHandlersParams {
  nodesRef: MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef: MutableRefObject<Edge[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  createOutputNodeWithSkeleton: (sourceNode: Node<FlowNodeData>, sourceNodeId: string) => { node: Node<FlowNodeData>; edge: Edge; nodeId: string } | null;
  updateOutputNodeWithResult: (nodeId: string, result: string, addToHistoryCallback: () => void) => void;
  updateOutputNodeWithR2Url: (nodeId: string, imageUrl: string) => void;
  uploadImageToR2Auto: (base64Image: string, nodeId: string, updateNodeCallback?: (imageUrl: string) => void) => Promise<string | null>;
  cleanupFailedNode: (nodeId: string | null) => void;
  refreshSubscriptionStatus: () => Promise<void>;
  linkedGuideline: BrandGuideline | null | undefined;
}

export const usePromptNodeHandlers = ({
  nodesRef,
  edgesRef,
  updateNodeData,
  updateNodeLoadingState,
  setNodes,
  setEdges,
  addToHistory,
  createOutputNodeWithSkeleton,
  updateOutputNodeWithResult,
  updateOutputNodeWithR2Url,
  uploadImageToR2Auto,
  cleanupFailedNode,
  refreshSubscriptionStatus,
  linkedGuideline,
}: UsePromptNodeHandlersParams) => {

  const handlePromptNodeDataUpdate = useCallback((nodeId: string, newData: Partial<PromptNodeData>) => {
    updateNodeData<PromptNodeData>(nodeId, newData, 'prompt');
  }, [updateNodeData]);

  const handleTextNodeDataUpdate = useCallback((nodeId: string, newData: Partial<TextNodeData>) => {
    updateNodeData<TextNodeData>(nodeId, newData, 'text');
  }, [updateNodeData]);

  const handlePromptSuggestPrompts = useCallback(async (nodeId: string, prompt: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'prompt') return;

    if (!prompt.trim()) {
      toast.error('Please enter a prompt first', { duration: 3000 });
      return;
    }

    updateNodeData<PromptNodeData>(nodeId, { isSuggestingPrompts: true, promptSuggestions: [] }, 'prompt');

    try {
      const suggestions = await aiApi.suggestPromptVariations(prompt);
      updateNodeData<PromptNodeData>(nodeId, {
        promptSuggestions: suggestions,
        isSuggestingPrompts: false,
      }, 'prompt');
    } catch (err: any) {
      console.error('Error suggesting prompts:', err);
      toast.error(err?.message || 'Failed to generate prompt suggestions', { duration: 5000 });
      updateNodeData<PromptNodeData>(nodeId, { isSuggestingPrompts: false }, 'prompt');
    }
  }, [nodesRef, updateNodeData]);

  const handlePromptGenerate = useCallback(async (
    nodeId: string,
    prompt: string,
    connectedImages?: string[],
    model?: GeminiModel
  ) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'prompt') {
      console.warn('handlePromptGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const promptData = node.data as PromptNodeData;
    const selectedModel: GeminiModel = model || promptData.model || DEFAULT_MODEL;
    const isAdvanced = isAdvancedModel(selectedModel);
    const resolution: Resolution | undefined = isAdvanced ? (promptData.resolution || (getDefaultResolution(selectedModel) || '1K')) : undefined;
    const aspectRatio = isAdvanced ? (promptData.aspectRatio || DEFAULT_ASPECT_RATIO) : undefined;

    const hasCredits = await validateCredits(selectedModel, resolution);
    if (!hasCredits) return;

    updateNodeData<PromptNodeData>(nodeId, {
      resultImageUrl: undefined,
      resultImageBase64: undefined,
    }, 'prompt');

    updateNodeLoadingState<PromptNodeData>(nodeId, true, 'prompt');

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeleton(node, nodeId);

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      console.log('[handlePromptGenerate] Creating OutputNode:', newOutputNodeId);
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
      setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
    } else {
      console.warn('[handlePromptGenerate] Failed to create OutputNode skeleton - reactFlowInstance may not be available');
    }

    try {
      let baseImage: UploadedImage | undefined;
      let referenceImages: UploadedImage[] | undefined;

      console.log('[handlePromptGenerate] Received connected images:', {
        nodeId,
        connectedImagesCount: connectedImages?.length || 0,
        connectedImages: connectedImages?.map((img, idx) => ({
          index: idx,
          type: img?.startsWith('http') ? 'URL' : img?.startsWith('data:') ? 'dataURL' : 'base64',
          length: img?.length || 0,
        })),
        model: selectedModel,
      });

      if (connectedImages && connectedImages.length > 0) {
        console.log('[handlePromptGenerate] Normalizing images to UploadedImage format...');
        const uploadedImages = await normalizeImagesToUploadedImages(connectedImages);

        const maxImages = getMaxHandles(selectedModel);

        if (uploadedImages.length > maxImages) {
          updateNodeLoadingState<PromptNodeData>(nodeId, false, 'prompt');
          toast.error(
            `Maximum ${maxImages} images allowed for ${isAdvanced ? getModelConfig(selectedModel).label : 'HD'} model. You have ${uploadedImages.length} images connected.`,
            { duration: 5000 }
          );
          return;
        }

        console.log('[handlePromptGenerate] Normalized images:', {
          count: uploadedImages.length,
          maxAllowed: maxImages,
          images: uploadedImages.map((img, idx) => ({
            index: idx,
            hasBase64: !!img.base64,
            base64Length: img.base64?.length || 0,
            mimeType: img.mimeType,
          })),
        });

        if (uploadedImages.length > 0) {
          baseImage = uploadedImages[0];

          if (uploadedImages.length > 1) {
            const maxReferenceImages = getMaxRefImages(selectedModel);
            referenceImages = uploadedImages.slice(1, 1 + maxReferenceImages);
          }

          const currentPromptData = nodesRef.current.find(n => n.id === nodeId)?.data as PromptNodeData;
          const isLogoFirst = currentPromptData?.connectedLogo && connectedImages?.[0] === currentPromptData.connectedLogo;
          const isIdentitySecond = currentPromptData?.connectedIdentity && connectedImages?.[1] === currentPromptData.connectedIdentity;

          console.log('[handlePromptGenerate] Processing images with hierarchy:', {
            model: selectedModel,
            hasBaseImage: !!baseImage,
            baseImageIsLogo: isLogoFirst,
            referenceImagesCount: referenceImages?.length || 0,
            firstReferenceIsIdentity: isIdentitySecond,
            totalImages: 1 + (referenceImages?.length || 0),
          });
        }
      } else {
        console.log('[handlePromptGenerate] No connected images provided - generating from prompt only');
      }

      const { source, tokens } = getBrandContextForNode(
        nodeId,
        nodesRef.current,
        edgesRef.current,
        linkedGuideline
      );

      let enhancedPrompt = tokens ? buildEnhancement(prompt, tokens) : prompt;

      const currentPromptData = nodesRef.current.find(n => n.id === nodeId)?.data as PromptNodeData;
      const pdfPageReference = currentPromptData?.pdfPageReference;
      if (pdfPageReference && pdfPageReference.trim()) {
        enhancedPrompt += `\n\nRefer to "${pdfPageReference.trim()}" from the brand identity guide PDF.`;
      }

      console.log('[handlePromptGenerate] Brand context:', { source, hasEnhancement: enhancedPrompt !== prompt });

      console.log('[handlePromptGenerate] Calling generateMockup with:', {
        prompt: enhancedPrompt.substring(0, 100) + (enhancedPrompt.length > 100 ? '...' : ''),
        hasBaseImage: !!baseImage,
        baseImageMimeType: baseImage?.mimeType,
        referenceImagesCount: referenceImages?.length || 0,
        model: selectedModel,
        resolution,
        aspectRatio,
        brandContextSource: source,
      });

      const result = await mockupApi.generate({
        promptText: enhancedPrompt,
        baseImage: baseImage ? { base64: baseImage.base64, mimeType: baseImage.mimeType } : undefined,
        model: selectedModel,
        resolution,
        aspectRatio,
        referenceImages: referenceImages?.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
        imagesCount: 1,
        feature: 'canvas',
        seed: currentPromptData?.seedLocked ? currentPromptData?.seed : undefined,
      });

      const resultImage = result.imageUrl || result.imageBase64 || '';

      updateNodeData<PromptNodeData>(nodeId, {
        isLoading: false,
        resultImageUrl: result.imageUrl,
        resultImageBase64: result.imageUrl ? undefined : result.imageBase64,
        seed: result.seed,
      } as any, 'prompt');

      updateNodeLoadingState<PromptNodeData>(nodeId, false, 'prompt');

      if (newOutputNodeId) {
        updateOutputNodeWithResult(
          newOutputNodeId,
          resultImage,
          () => addToHistory(nodesRef.current, edgesRef.current)
        );

        await uploadImageToR2Auto(result.imageBase64, newOutputNodeId, (imageUrl) => {
          updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl);
        });
      } else {
        console.warn('handlePromptGenerate: OutputNode was not created, skeletonNode was null');
      }

      try {
        await refreshSubscriptionStatus();
      } catch (statusError: any) {
        console.error('Failed to refresh subscription status:', statusError);
      }

      toast.success('Image generated successfully!', { duration: 3000 });
    } catch (error: any) {
      console.error('[handlePromptGenerate] ❌ Error generating image', {
        nodeId,
        error: error?.message,
        status: error?.status,
        errorData: error?.errorData,
        requiresSubscription: error?.requiresSubscription,
        stack: error?.stack,
      });

      cleanupFailedNode(newOutputNodeId);
      updateNodeLoadingState<PromptNodeData>(nodeId, false, 'prompt');

      if (error?.errorData?.isModelQuestion) {
        const modelMessage = error.errorData.message || 'The AI needs more information to generate the image.';
        toast(modelMessage, {
          duration: 8000,
          icon: '💬',
          style: {
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          },
        });
        return;
      }

      const errorMessage = error?.errorData?.message || error?.errorData?.error || error?.message || 'Failed to generate image';
      toast.error(errorMessage, { duration: 5000 });
    }
  }, [nodesRef, edgesRef, updateNodeData, updateNodeLoadingState, setNodes, setEdges, addToHistory, uploadImageToR2Auto, createOutputNodeWithSkeleton, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus, linkedGuideline]);

  return {
    handlePromptNodeDataUpdate,
    handleTextNodeDataUpdate,
    handlePromptSuggestPrompts,
    handlePromptGenerate,
  };
};
