import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, EditNodeData, UpscaleNodeData, ImageNodeData } from '@/types/reactFlow';
import type { GeminiModel, Resolution } from '@/types/types';
import type { Mockup } from '@/services/mockupApi';
import { editImage, upscaleImage, validateCredits } from '@/services/reactFlowService';
import { collectVariables, applyVariables } from '@/utils/canvas/resolveVariables';
import { getImageFromNode } from '@/utils/canvas/canvasNodeUtils';
import { canvasApi } from '@/services/canvasApi';
import { aiApi } from '@/services/aiApi';
import { authService } from '@/services/authService';
import { GEMINI_MODELS, DEFAULT_MODEL, DEFAULT_ASPECT_RATIO } from '@/constants/geminiModels';
import { resolveProvider } from '@/utils/canvas/generationContext';
import { toast } from 'sonner';

interface UseEditNodeHandlersParams {
  nodesRef: MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef: MutableRefObject<Edge[]>;
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void;
  updateNodeLoadingState: <T extends FlowNodeData>(nodeId: string, isLoading: boolean, nodeType?: string) => void;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  canvasId?: string;
  createOutputNodeWithSkeleton: (sourceNode: Node<FlowNodeData>, sourceNodeId: string) => { node: Node<FlowNodeData>; edge: Edge; nodeId: string } | null;
  updateOutputNodeWithResult: (nodeId: string, result: string, addToHistoryCallback: () => void) => void;
  updateOutputNodeWithR2Url: (nodeId: string, imageUrl: string) => void;
  uploadImageToR2Auto: (base64Image: string, nodeId: string, updateNodeCallback?: (imageUrl: string) => void) => Promise<string | null>;
  cleanupFailedNode: (nodeId: string | null) => void;
  refreshSubscriptionStatus: () => Promise<void>;
}

export const useEditNodeHandlers = ({
  nodesRef,
  edgesRef,
  updateNodeData,
  updateNodeLoadingState,
  setNodes,
  setEdges,
  addToHistory,
  canvasId,
  createOutputNodeWithSkeleton,
  updateOutputNodeWithResult,
  updateOutputNodeWithR2Url,
  uploadImageToR2Auto,
  cleanupFailedNode,
  refreshSubscriptionStatus,
}: UseEditNodeHandlersParams) => {

  const handleEditNodeDataUpdate = useCallback((nodeId: string, newData: Partial<EditNodeData>) => {
    updateNodeData<EditNodeData>(nodeId, newData, 'edit');
  }, [updateNodeData]);

  const handleUpscaleNodeDataUpdate = useCallback((nodeId: string, newData: Partial<UpscaleNodeData>) => {
    updateNodeData<UpscaleNodeData>(nodeId, newData, 'upscale');
  }, [updateNodeData]);

  const handleEditApply = useCallback(async (nodeId: string, imageBase64: string, config: EditNodeData) => {
    console.log('handleEditApply called', { nodeId, imageBase64: imageBase64 ? 'provided' : 'empty', hasConfig: !!config });

    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'edit') {
      console.warn('handleEditApply: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const connectedEdge = edgesRef.current.find(e => e.target === nodeId);
    if (!connectedEdge) {
      console.warn('handleEditApply: No connected edge found', { nodeId, edgesCount: edgesRef.current.length });
      toast.error('Connect an image to edit');
      return;
    }

    const inputImage = getImageFromNode(connectedEdge.source, nodesRef.current);
    if (!inputImage) {
      console.warn('handleEditApply: No input image found', { sourceNodeId: connectedEdge.source });
      toast.error('No image connected');
      return;
    }

    console.log('handleEditApply: Proceeding with edit', { nodeId, inputImageSize: inputImage.length });

    const model = config.model || DEFAULT_MODEL;
    const resolution = config.resolution;
    const hasCredits = await validateCredits(model, resolution, resolveProvider(model));
    if (!hasCredits) return;

    updateNodeData<EditNodeData>(nodeId, { ...config, isLoading: true }, 'edit');

    const rawPrompt = config.promptPreview || config.additionalPrompt || 'Apply the requested changes to this image while maintaining its overall composition and quality.';
    const vars = collectVariables(nodeId, nodesRef.current, edgesRef.current);
    const editPrompt = applyVariables(rawPrompt, vars);

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeleton(node, nodeId);

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
      setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
    }

    try {
      const result = await editImage(inputImage, editPrompt, model, resolution);

      updateNodeData<EditNodeData>(nodeId, { ...config, isLoading: false }, 'edit');

      if (newOutputNodeId) {
        updateOutputNodeWithResult(
          newOutputNodeId,
          result,
          () => addToHistory(nodesRef.current, edgesRef.current)
        );

        await uploadImageToR2Auto(result, newOutputNodeId, (imageUrl) => {
          updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl);
        });
      }

      await refreshSubscriptionStatus();
      toast.success('Image edited successfully! New node created.', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId);
      updateNodeData<EditNodeData>(nodeId, { ...config, isLoading: false }, 'edit');
      toast.error(error?.message || 'Failed to edit image', { duration: 5000 });
    }
  }, [nodesRef, edgesRef, updateNodeData, setNodes, setEdges, addToHistory, uploadImageToR2Auto, createOutputNodeWithSkeleton, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus]);

  const handleUpscale = useCallback(async (nodeId: string, imageBase64: string, resolution: Resolution) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'upscale') {
      console.warn('handleUpscale: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const upscaleData = node.data as UpscaleNodeData;
    const connectedImage = (upscaleData as any).connectedImage as string | undefined;

    console.log('[handleUpscale] Received request:', {
      nodeId,
      resolution,
      hasConnectedImageInData: !!connectedImage,
      imageType: connectedImage?.startsWith('http') ? 'URL' : connectedImage?.startsWith('data:') ? 'dataURL' : connectedImage ? 'base64' : 'none',
    });

    let inputImage: string | null = null;

    if (connectedImage) {
      inputImage = connectedImage;
      console.log('[handleUpscale] Using connectedImage from nodeData');
    } else {
      const connectedEdge = edgesRef.current.find(e => e.target === nodeId);
      if (connectedEdge) {
        inputImage = getImageFromNode(connectedEdge.source, nodesRef.current);
        console.log('[handleUpscale] Using image from edge connection');
      }
    }

    if (!inputImage) {
      toast.error('Connect an image to upscale');
      return;
    }

    const model: GeminiModel = resolution === '4K' ? GEMINI_MODELS.PRO : GEMINI_MODELS.NB2;
    const hasCredits = await validateCredits(model, resolution, 'gemini');
    if (!hasCredits) return;

    updateNodeLoadingState<UpscaleNodeData>(nodeId, true, 'upscale');

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeleton(node, nodeId);

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
      setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
    }

    console.log('[handleUpscale] Calling upscaleImage with:', {
      inputImageType: inputImage?.startsWith('http') ? 'URL' : inputImage?.startsWith('data:') ? 'dataURL' : 'base64',
      inputImageLength: inputImage?.length || 0,
      resolution,
      model,
    });

    try {
      const result = await upscaleImage(inputImage, resolution, model);

      console.log('[handleUpscale] Upscale successful, updating OutputNode');

      updateNodeData<UpscaleNodeData>(nodeId, {
        isLoading: false,
        resultImageBase64: result,
      }, 'upscale');

      uploadImageToR2Auto(result, nodeId, (imageUrl) => {
        updateNodeData<UpscaleNodeData>(nodeId, {
          resultImageUrl: imageUrl,
          resultImageBase64: undefined,
        }, 'upscale');
      });

      if (newOutputNodeId) {
        updateOutputNodeWithResult(
          newOutputNodeId,
          result,
          () => addToHistory(nodesRef.current, edgesRef.current)
        );

        await uploadImageToR2Auto(result, newOutputNodeId, (imageUrl) => {
          updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl);
        });
      }

      await refreshSubscriptionStatus();
      toast.success(`Image upscaled to ${resolution}!`, { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId);
      updateNodeLoadingState<UpscaleNodeData>(nodeId, false, 'upscale');
      toast.error(error?.message || 'Failed to upscale image', { duration: 5000 });
    }
  }, [nodesRef, edgesRef, updateNodeData, updateNodeLoadingState, setNodes, setEdges, addToHistory, uploadImageToR2Auto, createOutputNodeWithSkeleton, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus]);

  const handleUploadImage = useCallback(async (nodeId: string, imageBase64: string) => {
    setNodes((nds: Node<FlowNodeData>[]) => {
      return nds.map((n: Node<FlowNodeData>) => {
        if (n.id === nodeId && n.type === 'image') {
          const data = n.data as ImageNodeData;
          const updatedMockup: Mockup = {
            ...data.mockup,
            imageBase64,
            prompt: 'Uploaded image',
          };
          return {
            ...n,
            data: {
              ...data,
              mockup: updatedMockup,
            } as ImageNodeData,
          } as Node<FlowNodeData>;
        }
        return n;
      });
    });

    if (canvasId) {
      try {
        const imageUrl = await canvasApi.uploadImageToR2(imageBase64, canvasId, nodeId, { skipCompression: true });
        setNodes((nds: Node<FlowNodeData>[]) => {
          return nds.map((n: Node<FlowNodeData>) => {
            if (n.id === nodeId && n.type === 'image') {
              const data = n.data as ImageNodeData;
              const updatedMockup: Mockup = {
                ...data.mockup,
                imageUrl,
                imageBase64: undefined,
                prompt: 'Uploaded image',
              };
              return {
                ...n,
                data: {
                  ...data,
                  mockup: updatedMockup,
                } as ImageNodeData,
              } as Node<FlowNodeData>;
            }
            return n;
          });
        });
      } catch (error: any) {
        console.warn('Failed to upload image to R2 (keeping base64):', error);
      }
    }

    toast.success('Image uploaded!', { id: `upload-image-${nodeId}`, duration: 2000 });
  }, [setNodes, canvasId]);

  const handleEditNodeGenerateSmartPrompt = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'edit') return;

    const editData = node.data as EditNodeData;
    if (!editData.designType || (editData.designType !== 'blank' && !editData.uploadedImage) || !editData.tags || editData.tags.length === 0) {
      toast.error('Please complete all steps before generating prompt', { duration: 3000 });
      return;
    }

    try {
      const smartPromptResult = await aiApi.generateSmartPrompt({
        baseImage: editData.uploadedImage || null,
        designType: editData.designType,
        brandingTags: editData.brandingTags || [],
        categoryTags: editData.tags || [],
        locationTags: editData.locationTags || [],
        angleTags: editData.angleTags || [],
        lightingTags: editData.lightingTags || [],
        effectTags: editData.effectTags || [],
        selectedColors: editData.selectedColors || [],
        aspectRatio: editData.aspectRatio || DEFAULT_ASPECT_RATIO,
        generateText: editData.generateText || false,
        withHuman: editData.withHuman || false,
        enhanceTexture: (editData as any).enhanceTexture === true,
        removeText: (editData as any).removeText || false,
        negativePrompt: editData.negativePrompt || '',
        additionalPrompt: editData.additionalPrompt || '',
        instructions: (editData as any).instructions || '',
      });

      const smartPrompt = typeof smartPromptResult === 'string'
        ? smartPromptResult
        : smartPromptResult.prompt;

      try {
        const inputTokens = typeof smartPromptResult === 'object' ? (smartPromptResult.inputTokens ?? 0) : 0;
        const outputTokens = typeof smartPromptResult === 'object' ? (smartPromptResult.outputTokens ?? 0) : 0;

        const token = authService.getToken();
        await fetch('/api/mockups/track-prompt-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ inputTokens, outputTokens, feature: 'canvas' }),
        });
      } catch (trackError) {
        console.error('Failed to track prompt generation:', trackError);
      }

      handleEditNodeDataUpdate(nodeId, {
        promptPreview: smartPrompt,
        isSmartPromptActive: true,
        isPromptManuallyEdited: false,
        isPromptReady: true,
      });

      toast.success('Prompt generated successfully!', { duration: 3000 });
    } catch (error: any) {
      console.error('Error generating smart prompt:', error);
      toast.error('Failed to generate prompt. Please try again.', { duration: 5000 });
    }
  }, [nodesRef, handleEditNodeDataUpdate]);

  const handleEditNodeSuggestPrompts = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'edit') return;

    const editData = node.data as EditNodeData;
    if (!editData.promptPreview || !editData.promptPreview.trim()) {
      toast.error('Please enter a prompt first', { duration: 3000 });
      return;
    }

    try {
      const suggestions = await aiApi.suggestPromptVariations(editData.promptPreview);
      handleEditNodeDataUpdate(nodeId, {
        promptSuggestions: suggestions,
        isSuggestingPrompts: false,
      });
    } catch (error: any) {
      console.error('Error suggesting prompts:', error);
      toast.error('Failed to generate suggestions. Please try again.', { duration: 5000 });
      handleEditNodeDataUpdate(nodeId, { isSuggestingPrompts: false });
    }
  }, [nodesRef, handleEditNodeDataUpdate]);

  return {
    handleEditApply,
    handleUpscale,
    handleUploadImage,
    handleEditNodeDataUpdate,
    handleUpscaleNodeDataUpdate,
    handleEditNodeGenerateSmartPrompt,
    handleEditNodeSuggestPrompts,
  };
};
