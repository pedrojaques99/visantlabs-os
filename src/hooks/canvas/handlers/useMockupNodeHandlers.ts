import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, MockupNodeData, OutputNodeData } from '@/types/reactFlow';
import type { GeminiModel, SeedreamModel, Resolution, AspectRatio, UploadedImage } from '@/types/types';
import type { BrandGuideline } from '@/lib/figma-types';
import { validateCredits, normalizeImageToBase64, detectMimeType } from '@/services/reactFlowService';
import { mockupApi } from '@/services/mockupApi';
import { getPresetAsync, loadReferenceImage } from '@/services/mockupPresetsService';
import { getImageUrl } from '@/utils/imageUtils';
import { validateBase64Image, normalizeImagesToUploadedImages } from '../utils/nodeGenerationUtils';
import { getBrandContextForNode, buildEnhancement } from '../useBrandContext';
import { DEFAULT_MODEL, DEFAULT_ASPECT_RATIO } from '@/constants/geminiModels';
import { resolveGenerationContext } from '@/utils/canvas/generationContext';
import { toast } from 'sonner';

interface UseMockupNodeHandlersParams {
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

export const useMockupNodeHandlers = ({
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
}: UseMockupNodeHandlersParams) => {

  const handleMockupNodeDataUpdate = useCallback((nodeId: string, newData: Partial<MockupNodeData>) => {
    updateNodeData<MockupNodeData>(nodeId, newData, 'mockup');
  }, [updateNodeData]);

  const handleMockupGenerate = useCallback(async (
    nodeId: string,
    imageInput: string,
    presetId: string,
    selectedColors?: string[],
    withHuman?: boolean,
    customPrompt?: string,
    modelOverride?: GeminiModel | SeedreamModel,
    resolutionOverride?: Resolution,
    aspectRatioOverride?: AspectRatio
  ) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'mockup') {
      console.warn('handleMockupGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const mockupData = node.data as MockupNodeData;
    const connectedImageFromData = mockupData.connectedImage;
    const imageToUse = imageInput || connectedImageFromData || '';

    console.log('[handleMockupGenerate] Received request:', {
      nodeId, presetId,
      imageInputType: imageInput?.startsWith('http') ? 'URL' : imageInput?.startsWith('data:') ? 'dataURL' : imageInput ? 'base64' : 'none',
      connectedImageFromDataType: connectedImageFromData?.startsWith('http') ? 'URL' : connectedImageFromData?.startsWith('data:') ? 'dataURL' : connectedImageFromData ? 'base64' : 'none',
      usingImageInput: !!imageInput,
      usingConnectedImageFromData: !imageInput && !!connectedImageFromData,
      colorsCount: selectedColors?.length || 0,
      withHuman,
      hasCustomPrompt: !!customPrompt,
    });

    if (!imageToUse) {
      toast.error('Connect an image to generate mockup');
      return;
    }

    const userMockups = (mockupData as any).userMockups as any[] | undefined;
    const customMockup = userMockups?.find((m: any) => m._id === presetId);

    let preset: any;
    let isCustomMockup = false;

    if (customMockup) {
      isCustomMockup = true;
      preset = {
        id: customMockup._id,
        name: customMockup.prompt?.substring(0, 30) || 'Custom Mockup',
        prompt: customMockup.prompt || '',
        referenceImageUrl: getImageUrl(customMockup) || undefined,
        aspectRatio: customMockup.aspectRatio || DEFAULT_ASPECT_RATIO,
        model: DEFAULT_MODEL,
      };
      console.log('[handleMockupGenerate] Using custom mockup:', {
        mockupId: customMockup._id,
        prompt: customMockup.prompt?.substring(0, 50),
        hasReferenceImage: !!preset.referenceImageUrl,
      });
    } else {
      preset = await getPresetAsync(presetId as any);
      if (!preset) {
        console.error(`[handleMockupGenerate] Preset not found: ${presetId}`);
        toast.error(`Preset ${presetId} not found`);
        return;
      }
      console.log(`[handleMockupGenerate] Loaded preset:`, {
        id: preset.id, name: preset.name,
        hasReferenceImageUrl: !!(preset.referenceImageUrl && preset.referenceImageUrl.trim() !== ''),
        referenceImageUrl: preset.referenceImageUrl?.substring(0, 80) || 'none',
      });
    }

    const model = modelOverride || (mockupData as any).model || preset.model || DEFAULT_MODEL;
    const { provider, resolution: resolvedResolution, aspectRatio: resolvedAspectRatio } = resolveGenerationContext(model, {
      resolution: resolutionOverride,
      aspectRatio: aspectRatioOverride || preset.aspectRatio,
    });
    // resolution is always defined for both Seedream and advanced Gemini; cast is safe
    const resolution = (resolvedResolution || '1K') as Resolution;
    const aspectRatio = resolvedAspectRatio || preset.aspectRatio || DEFAULT_ASPECT_RATIO;

    const hasCredits = await validateCredits(model, resolution, provider);
    if (!hasCredits) return;

    setNodes((nds: Node<FlowNodeData>[]) =>
      nds.map((n: Node<FlowNodeData>) =>
        n.id === nodeId
          ? { ...n, data: { ...(n.data as MockupNodeData), isLoading: true } as MockupNodeData } as Node<FlowNodeData>
          : n
      )
    );

    const connectedLogo = mockupData.connectedLogo;
    const connectedIdentity = mockupData.connectedIdentity;

    let logoBase64: string | null = null;
    let baseImage: UploadedImage | undefined;

    if (connectedLogo) {
      try {
        console.log('[handleMockupGenerate] Normalizing Logo (baseImage) to base64...');
        logoBase64 = await normalizeImageToBase64(connectedLogo);

        if (!validateBase64Image(logoBase64)) {
          throw new Error('Invalid logo base64 format after conversion');
        }

        const logoMimeType = detectMimeType(connectedLogo);
        baseImage = { base64: logoBase64, mimeType: logoMimeType };
        console.log('[handleMockupGenerate] Logo set as baseImage (primary focus)');
      } catch (error: any) {
        console.error('Error converting logo to base64:', error);
        toast.error('Failed to process logo image. Using fallback.');
      }
    }

    if (!baseImage && imageToUse) {
      try {
        console.log('[handleMockupGenerate] Using imageInput as baseImage (fallback)...');
        const fallbackBase64 = await normalizeImageToBase64(imageToUse);

        if (!validateBase64Image(fallbackBase64)) {
          throw new Error('Invalid base64 format after conversion');
        }

        const fallbackMimeType = detectMimeType(imageInput);
        baseImage = { base64: fallbackBase64, mimeType: fallbackMimeType };
      } catch (error: any) {
        console.error('Error converting fallback image to base64:', error);
        toast.error(error?.message || 'Failed to process image. Please check if the image is accessible.');
        updateNodeLoadingState<MockupNodeData>(nodeId, false, 'mockup');
        return;
      }
    }

    if (!baseImage) {
      toast.error('Connect a logo or image to generate mockup');
      updateNodeLoadingState<MockupNodeData>(nodeId, false, 'mockup');
      return;
    }

    let referenceImages: UploadedImage[] | undefined;

    if (connectedIdentity) {
      try {
        console.log('[handleMockupGenerate] Normalizing Identity (referenceImage) to base64...');
        const identityBase64 = await normalizeImageToBase64(connectedIdentity);

        if (validateBase64Image(identityBase64)) {
          const identityMimeType = detectMimeType(connectedIdentity);
          referenceImages = [{ base64: identityBase64, mimeType: identityMimeType }];
          console.log('[handleMockupGenerate] Identity set as referenceImage (context/colors/vibe)');
        }
      } catch (error: any) {
        console.warn('Failed to process identity as reference image, continuing without it:', error);
      }
    }

    if (preset.referenceImageUrl && preset.referenceImageUrl.trim() !== '') {
      let presetReferenceImage: UploadedImage | null = null;

      if (isCustomMockup && customMockup) {
        try {
          const mockupImageUrl = getImageUrl(customMockup);
          if (mockupImageUrl) {
            const mockupImageBase64 = await normalizeImageToBase64(mockupImageUrl);
            if (validateBase64Image(mockupImageBase64)) {
              const mockupMimeType = detectMimeType(mockupImageUrl);
              presetReferenceImage = { base64: mockupImageBase64, mimeType: mockupMimeType };
            }
          }
        } catch (error: any) {
          console.warn('Failed to load custom mockup reference image:', error);
        }
      } else {
        presetReferenceImage = await loadReferenceImage(preset);
      }

      if (presetReferenceImage) {
        if (!referenceImages) referenceImages = [];
        referenceImages.push(presetReferenceImage);
      }
    }

    let enhancedPrompt: string;
    if (customPrompt && customPrompt.trim()) {
      enhancedPrompt = customPrompt.trim();
    } else {
      enhancedPrompt = preset.prompt;
    }

    const { source: brandSource, tokens: mockupBrandTokens } = getBrandContextForNode(nodeId, nodesRef.current, edgesRef.current, linkedGuideline);
    // 'edge' = BrandNode connected via React Flow (image-analysis data, no DB id) → enhance client-side
    // 'guideline' = header-linked BrandGuideline (has DB id) → let server inject via brandGuidelineId
    if (brandSource === 'edge' && mockupBrandTokens) {
      enhancedPrompt = buildEnhancement(enhancedPrompt, mockupBrandTokens);
    }

    if (withHuman && !enhancedPrompt.toLowerCase().includes('human') && !enhancedPrompt.toLowerCase().includes('person')) {
      const humanAction = Math.random() < 0.5 ? 'looking at' : 'interacting with';
      enhancedPrompt += ` The scene should include a human person naturally ${humanAction} the mockup product. Ensure the moment feels contextual for the product type.`;
    }

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeleton(node, nodeId);

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
      setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
    }

    try {
      if (!validateBase64Image(baseImage.base64)) {
        throw new Error('Base image data is empty after processing');
      }

      const isBaseImageLogo = !!mockupData.connectedLogo;
      const hasIdentityAsReference = !!mockupData.connectedIdentity && !!referenceImages && referenceImages.length > 0;

      console.log('[handleMockupGenerate] Calling generateMockup with hierarchy:', {
        prompt: enhancedPrompt.substring(0, 100) + (enhancedPrompt.length > 100 ? '...' : ''),
        hasBaseImage: !!baseImage, baseImageIsLogo: isBaseImageLogo,
        baseImageMimeType: baseImage?.mimeType,
        referenceImagesCount: referenceImages?.length || 0,
        hasIdentityAsReference, model, resolution, aspectRatio,
      });

      const result = await mockupApi.generate({
        promptText: enhancedPrompt,
        baseImage: baseImage ? { base64: baseImage.base64, mimeType: baseImage.mimeType } : undefined,
        model, resolution, aspectRatio,
        referenceImages: referenceImages?.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
        imagesCount: 1,
        feature: 'canvas',
        provider,
        brandGuidelineId: brandSource === 'guideline' ? linkedGuideline?.id : undefined,
      });

      const resultImage = result.imageUrl || result.imageBase64 || '';

      console.log('[handleMockupGenerate] Mockup generated successfully, updating OutputNode', {
        hasImageUrl: !!result.imageUrl, hasImageBase64: !!result.imageBase64,
        resultImageLength: resultImage.length,
      });

      updateNodeData<MockupNodeData>(nodeId, {
        isLoading: false,
        resultImageUrl: result.imageUrl,
        resultImageBase64: result.imageUrl ? undefined : result.imageBase64,
      } as any, 'mockup');

      updateNodeLoadingState<MockupNodeData>(nodeId, false, 'mockup');

      if (newOutputNodeId) {
        updateOutputNodeWithResult(
          newOutputNodeId,
          resultImage,
          () => addToHistory(nodesRef.current, edgesRef.current)
        );

        if (!result.imageUrl && result.imageBase64) {
          await uploadImageToR2Auto(result.imageBase64, newOutputNodeId, (imageUrl) => {
            updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl);
          });
        }
      }

      try {
        await refreshSubscriptionStatus();
      } catch (statusError: any) {
        console.error('Failed to refresh subscription status:', statusError);
      }

      toast.success('Mockup generated successfully!', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId);
      updateNodeLoadingState<MockupNodeData>(nodeId, false, 'mockup');
      toast.error(error?.message || 'Failed to generate mockup', { duration: 5000 });
    }
  }, [nodesRef, edgesRef, updateNodeData, updateNodeLoadingState, setNodes, setEdges, addToHistory, uploadImageToR2Auto, createOutputNodeWithSkeleton, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus, linkedGuideline]);

  return {
    handleMockupNodeDataUpdate,
    handleMockupGenerate,
  };
};
