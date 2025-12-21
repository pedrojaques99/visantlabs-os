/**
 * useCanvasNodeHandlers
 * 
 * Hook principal que gerencia todos os handlers de interação com os node do canvas.
 * Responsável por processar ações de geração, edição, merge, upscale, mockup, prompt,
 * brand identity e outros tipos de node. Coordena a comunicação entre os node, valida
 * créditos, gerencia uploads para R2 e atualiza o estado do canvas.
 */

// ========== IMPORTS - React ==========
import { useCallback, useRef, useEffect } from 'react';

// ========== IMPORTS - Tipos ReactFlow ==========
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, ImageNodeData, MergeNodeData, EditNodeData, UpscaleNodeData, MockupNodeData, PromptNodeData, OutputNodeData, BrandNodeData, AngleNodeData, LogoNodeData, PDFNodeData, StrategyNodeData, BrandCoreData, VideoNodeData, VideoInputNodeData, TextureNodeData, AmbienceNodeData, LuminanceNodeData, ShaderNodeData, ColorExtractorNodeData, TextNodeData, ChatNodeData } from '../../types/reactFlow';
import type { ReactFlowInstance } from '../../types/reactflow-instance';

// ========== IMPORTS - Tipos Customizados ==========
import type { UploadedImage, GeminiModel, Resolution, BrandingData } from '../../types';
import type { Mockup } from '../../services/mockupApi';

// ========== IMPORTS - Serviços ==========
import { combineImages, editImage, upscaleImage, validateCredits, validateVideoCredits, normalizeImageToBase64, detectMimeType } from '../../services/reactFlowService';
import { subscriptionService } from '../../services/subscriptionService';
import { aiApi } from '../../services/aiApi';
import { generateMergePrompt } from '../../services/geminiService';
import { mockupApi } from '../../services/mockupApi';
import { videoApi } from '../../services/videoApi';
import { extractBrandIdentity } from '../../services/brandIdentityService';
import { getPreset, getPresetAsync, loadReferenceImage } from '../../services/mockupPresetsService';
import { canvasApi } from '../../services/canvasApi';
import { videoToBase64 } from '../../utils/fileUtils';
import { extractColors } from '../../utils/colorExtraction';
import { authService } from '../../services/authService';

// ========== IMPORTS - Utils ==========
import { generateNodeId, getImageFromNode, getConnectedImages, cleanEdgeHandles, getConnectedBrandIdentity } from '../../utils/canvas/canvasNodeUtils';
import { getImageUrl } from '../../utils/imageUtils';

// ========== IMPORTS - UI/UX ==========
import { toast } from 'sonner';

// ========== IMPORTS - Hooks ==========
import { useShaderNodeHandlers } from './handlers/useShaderNodeHandlers';
import { useUpscaleBicubicNodeHandlers } from './handlers/useUpscaleBicubicNodeHandlers';
import { useLogoNodeHandlers } from './handlers/useLogoNodeHandlers';
import { usePDFNodeHandlers } from './handlers/usePDFNodeHandlers';
import { useAngleNodeHandlers } from './handlers/useAngleNodeHandlers';
import { useTextureNodeHandlers } from './handlers/useTextureNodeHandlers';
import { useAmbienceNodeHandlers } from './handlers/useAmbienceNodeHandlers';
import { useLuminanceNodeHandlers } from './handlers/useLuminanceNodeHandlers';
import { useMergeNodeHandlers } from './handlers/useMergeNodeHandlers';
import { useCanvasNodeSync } from './useCanvasNodeSync';
import {
  createOutputNodeWithSkeleton as createOutputNodeWithSkeletonUtil,
  normalizeImagesToUploadedImages,
  validateBase64Image,
  updateOutputNodeWithResult as updateOutputNodeWithResultUtil,
  updateOutputNodeWithR2Url as updateOutputNodeWithR2UrlUtil,
  cleanupFailedNode as cleanupFailedNodeUtil
} from './utils/nodeGenerationUtils';
import { uploadImageToR2Auto as uploadImageToR2AutoUtil } from './utils/r2UploadUtils';

export const useCanvasNodeHandlers = (
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  reactFlowInstance: ReactFlowInstance | null,
  subscriptionStatus: any,
  setSubscriptionStatus: (status: any) => void,
  handleView: (mockup: Mockup) => void,
  handleEdit: (mockup: Mockup) => void,
  handleDelete: (id: string) => Promise<void>,
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void,
  canvasId?: string,
  saveImmediately?: () => Promise<void>
) => {
  // ========== CONFIGURAÇÃO INICIAL - Refs e Estado ==========

  // Create handlersRef early to avoid circular dependency
  const handlersRef = useRef<any>({});

  // Separate refs for handlers used in node creation to avoid circular dependency
  const handleUploadImageRef = useRef<((nodeId: string, imageBase64: string) => Promise<void>) | null>(null);

  // Ref to prevent infinite loops in useEffect
  const isUpdatingNodesRef = useRef(false);

  // Refs to store current nodes and edges to avoid stale closure issues
  const nodesRef = useRef<Node<FlowNodeData>[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  // Update refs whenever nodes or edges change
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // ========== HELPER FUNCTIONS ==========

  // Wrapper for uploadImageToR2Auto to match old signature (used by handlers not yet refactored)
  const uploadImageToR2Auto = useCallback(async (
    base64Image: string,
    nodeId: string,
    updateNodeCallback?: (imageUrl: string) => void
  ) => {
    if (!canvasId) return null;
    return await uploadImageToR2AutoUtil(base64Image, nodeId, canvasId, setNodes, updateNodeCallback);
  }, [canvasId, setNodes]);

  // Wrapper for createOutputNodeWithSkeleton to match old signature
  const createOutputNodeWithSkeletonForGenerated = useCallback((
    sourceNode: Node<FlowNodeData>,
    sourceNodeId: string
  ): { node: Node<FlowNodeData>; edge: Edge; nodeId: string } | null => {
    return createOutputNodeWithSkeletonUtil(sourceNode, sourceNodeId, reactFlowInstance);
  }, [reactFlowInstance]);

  // Wrapper for updateOutputNodeWithResult to match old signature (used by handlers not yet refactored)
  const updateOutputNodeWithResult = useCallback((
    nodeId: string,
    result: string,
    addToHistoryCallback: () => void
  ) => {
    updateOutputNodeWithResultUtil(nodeId, result, addToHistoryCallback, setNodes);
  }, [setNodes]);

  // Wrapper for updateOutputNodeWithR2Url to match old signature (used by handlers not yet refactored)
  const updateOutputNodeWithR2Url = useCallback((nodeId: string, imageUrl: string) => {
    updateOutputNodeWithR2UrlUtil(nodeId, imageUrl, setNodes);
  }, [setNodes]);

  // Wrapper for cleanupFailedNode to match old signature (used by handlers not yet refactored)
  const cleanupFailedNode = useCallback((nodeId: string | null) => {
    cleanupFailedNodeUtil(nodeId, setNodes, setEdges);
  }, [setNodes, setEdges]);

  // Update node loading state
  const updateNodeLoadingState = useCallback(<T extends FlowNodeData>(
    nodeId: string,
    isLoading: boolean,
    nodeType?: string
  ) => {
    setNodes((nds: Node<FlowNodeData>[]) =>
      nds.map((n: Node<FlowNodeData>) => {
        if (n.id === nodeId && (!nodeType || n.type === nodeType)) {
          return {
            ...n,
            data: {
              ...n.data,
              isLoading,
            } as T,
          } as Node<FlowNodeData>;
        }
        return n;
      })
    );
  }, [setNodes]);

  // Update node data generically
  const updateNodeData = useCallback(<T extends FlowNodeData>(
    nodeId: string,
    newData: Partial<T>,
    nodeType?: string
  ) => {
    setNodes((nds: Node<FlowNodeData>[]) =>
      nds.map((n: Node<FlowNodeData>) => {
        if (n.id === nodeId && (!nodeType || n.type === nodeType)) {
          return {
            ...n,
            data: {
              ...(n.data as T),
              ...newData,
            } as T,
          } as Node<FlowNodeData>;
        }
        return n;
      })
    );
  }, [setNodes]);


  // Refresh subscription status
  const refreshSubscriptionStatus = useCallback(async () => {
    if (subscriptionStatus) {
      const updated = await subscriptionService.getSubscriptionStatus();
      setSubscriptionStatus(updated);
    }
  }, [subscriptionStatus, setSubscriptionStatus]);



  // ========== END HELPER FUNCTIONS ==========

  // ========== MERGE NODE HANDLERS ==========
  // Handlers para gerenciar operações de merge de imagens
  const {
    handleMergeGenerate,
    handleMergeGeneratePrompt,
  } = useMergeNodeHandlers({
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
  });

  // ========== EDIT NODE HANDLERS ==========
  // Handlers para gerenciar operações de edição de imagens

  // Handle edit node apply
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

    const model = config.model || 'gemini-2.5-flash-image';
    const resolution = config.resolution;
    const hasCredits = await validateCredits(model, resolution);
    if (!hasCredits) return;

    updateNodeData<EditNodeData>(nodeId, { ...config, isLoading: true }, 'edit');

    const editPrompt = config.promptPreview || config.additionalPrompt || 'Apply the requested changes to this image while maintaining its overall composition and quality.';

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeletonForGenerated(node, nodeId);

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
  }, [setNodes, setEdges, addToHistory, uploadImageToR2Auto, updateNodeData, createOutputNodeWithSkeletonForGenerated, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus]);

  // ========== UPSCALE NODE HANDLERS ==========
  // Handlers para gerenciar operações de upscale de imagens

  // Handle upscale node
  const handleUpscale = useCallback(async (nodeId: string, imageBase64: string, resolution: Resolution) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'upscale') {
      console.warn('handleUpscale: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const upscaleData = node.data as UpscaleNodeData;

    // Read connected image directly from nodeData to ensure we have the latest value
    // This prevents synchronization issues
    const connectedImage = (upscaleData as any).connectedImage as string | undefined;

    console.log('[handleUpscale] Received request:', {
      nodeId,
      resolution,
      hasConnectedImageInData: !!connectedImage,
      imageType: connectedImage?.startsWith('http') ? 'URL' : connectedImage?.startsWith('data:') ? 'dataURL' : connectedImage ? 'base64' : 'none',
    });

    // Try to get image from nodeData first, then fallback to edge connection
    let inputImage: string | null = null;

    if (connectedImage) {
      inputImage = connectedImage;
      console.log('[handleUpscale] Using connectedImage from nodeData');
    } else {
      // Fallback: try to get from edge connection
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

    const model: GeminiModel = resolution === '4K' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    const hasCredits = await validateCredits(model, resolution);
    if (!hasCredits) return;

    updateNodeLoadingState<UpscaleNodeData>(nodeId, true, 'upscale');

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeletonForGenerated(node, nodeId);

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
          resultImageBase64: undefined, // Remove base64 after R2 upload to save memory
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
  }, [setNodes, setEdges, addToHistory, uploadImageToR2Auto, updateNodeLoadingState, updateNodeData, createOutputNodeWithSkeletonForGenerated, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus]);

  // ========== UPLOAD IMAGE HANDLER ==========
  // Handler para upload de imagens para node existentes

  // Handle upload image to existing node
  const handleUploadImage = useCallback(async (nodeId: string, imageBase64: string) => {
    // Update node immediately with base64
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

    // Try to upload to R2 in the background (non-blocking)
    if (canvasId) {
      try {
        const imageUrl = await canvasApi.uploadImageToR2(imageBase64, canvasId, nodeId);
        // Update node with R2 URL and remove base64 to reduce payload size
        setNodes((nds: Node<FlowNodeData>[]) => {
          return nds.map((n: Node<FlowNodeData>) => {
            if (n.id === nodeId && n.type === 'image') {
              const data = n.data as ImageNodeData;
              const updatedMockup: Mockup = {
                ...data.mockup,
                imageUrl,
                imageBase64: undefined, // Remove base64 after successful upload to reduce payload
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
        // If R2 upload fails, keep base64 - don't show error to user
        console.warn('Failed to upload image to R2 (keeping base64):', error);
      }
    }

    toast.success('Image uploaded!', {
      id: `upload-image-${nodeId}`,
      duration: 2000
    });
  }, [setNodes, canvasId]);

  // ========== EDIT NODE DATA UPDATE HANDLERS ==========
  // Handlers para atualização de dados dos node de edição

  // Handle EditNode data update
  const handleEditNodeDataUpdate = useCallback((nodeId: string, newData: Partial<EditNodeData>) => {
    updateNodeData<EditNodeData>(nodeId, newData, 'edit');
  }, [updateNodeData]);

  // ========== UPSCALE NODE DATA UPDATE HANDLERS ==========
  // Handlers para atualização de dados dos node de upscale

  // Handle UpscaleNode data update
  const handleUpscaleNodeDataUpdate = useCallback((nodeId: string, newData: Partial<UpscaleNodeData>) => {
    updateNodeData<UpscaleNodeData>(nodeId, newData, 'upscale');
  }, [updateNodeData]);

  // Handle EditNode generate smart prompt
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
        baseImage: editData.uploadedImage || undefined,
        designType: editData.designType,
        brandingTags: editData.brandingTags || [],
        categoryTags: editData.tags || [],
        locationTags: editData.locationTags || [],
        angleTags: editData.angleTags || [],
        lightingTags: editData.lightingTags || [],
        effectTags: editData.effectTags || [],
        selectedColors: editData.selectedColors || [],
        aspectRatio: editData.aspectRatio || '16:9',
        generateText: editData.generateText || false,
        withHuman: editData.withHuman || false,
        negativePrompt: editData.negativePrompt || '',
        additionalPrompt: editData.additionalPrompt || '',
      });

      // Handle both old string format and new object format
      const smartPrompt = typeof smartPromptResult === 'string'
        ? smartPromptResult
        : smartPromptResult.prompt;

      // Always track prompt generation usage (even if tokens are not available, use 0)
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
          body: JSON.stringify({
            inputTokens,
            outputTokens,
            feature: 'canvas',
          }),
        });
      } catch (trackError) {
        console.error('Failed to track prompt generation:', trackError);
        // Don't fail the prompt generation if tracking fails
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
  }, [handleEditNodeDataUpdate]);

  // Handle EditNode suggest prompts
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
      handleEditNodeDataUpdate(nodeId, {
        isSuggestingPrompts: false,
      });
    }
  }, [handleEditNodeDataUpdate]);

  // ========== MOCKUP NODE HANDLERS ==========
  // Handlers para gerenciar operações de geração de mockups

  // Handle mockup node data update
  const handleMockupNodeDataUpdate = useCallback((nodeId: string, newData: Partial<MockupNodeData>) => {
    updateNodeData<MockupNodeData>(nodeId, newData, 'mockup');
  }, [updateNodeData]);

  // Handle mockup node generate
  const handleMockupGenerate = useCallback(async (nodeId: string, imageInput: string, presetId: string, selectedColors?: string[], withHuman?: boolean, customPrompt?: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'mockup') {
      console.warn('handleMockupGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const mockupData = node.data as MockupNodeData;

    // Read connected image directly from nodeData as fallback if imageInput is not provided
    // This ensures we always have the latest value from nodeData
    const connectedImageFromData = mockupData.connectedImage;
    const imageToUse = imageInput || connectedImageFromData || '';

    console.log('[handleMockupGenerate] Received request:', {
      nodeId,
      presetId,
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

    // Check if presetId is a custom mockup (blank mockup from database)
    const userMockups = (mockupData as any).userMockups as Mockup[] | undefined;
    const customMockup = userMockups?.find(m => m._id === presetId);

    let preset: any;
    let isCustomMockup = false;

    if (customMockup) {
      // This is a custom mockup, create a preset-like object from the mockup data
      isCustomMockup = true;
      preset = {
        id: customMockup._id,
        name: customMockup.prompt?.substring(0, 30) || 'Custom Mockup',
        prompt: customMockup.prompt || '',
        referenceImageUrl: getImageUrl(customMockup) || undefined,
        aspectRatio: customMockup.aspectRatio || '16:9',
        model: 'gemini-2.5-flash-image', // Default model for custom mockups
      };
      console.log('[handleMockupGenerate] Using custom mockup:', {
        mockupId: customMockup._id,
        prompt: customMockup.prompt?.substring(0, 50),
        hasReferenceImage: !!preset.referenceImageUrl,
      });
    } else {
      // Use async version to ensure MongoDB presets are loaded
      preset = await getPresetAsync(presetId as any);
      if (!preset) {
        console.error(`[handleMockupGenerate] Preset not found: ${presetId}`);
        toast.error(`Preset ${presetId} not found`);
        return;
      }
      console.log(`[handleMockupGenerate] Loaded preset:`, {
        id: preset.id,
        name: preset.name,
        hasReferenceImageUrl: !!(preset.referenceImageUrl && preset.referenceImageUrl.trim() !== ''),
        referenceImageUrl: preset.referenceImageUrl?.substring(0, 80) || 'none',
      });
    }

    const model = preset.model || 'gemini-2.5-flash-image';
    const resolution: Resolution = model === 'gemini-3-pro-image-preview' ? '4K' : '1K';

    const hasCredits = await validateCredits(model, resolution);
    if (!hasCredits) return;

    setNodes((nds: Node<FlowNodeData>[]) =>
      nds.map((n: Node<FlowNodeData>) =>
        n.id === nodeId
          ? {
            ...n,
            data: {
              ...(n.data as MockupNodeData),
              isLoading: true,
            } as MockupNodeData,
          } as Node<FlowNodeData>
          : n
      )
    );

    // HIERARCHY: Logo (priority 1) as baseImage, Identity (priority 2) as referenceImage for colors/vibe
    // Get Logo and Identity from BrandCore connection
    const connectedLogo = mockupData.connectedLogo;
    const connectedIdentity = mockupData.connectedIdentity;

    // Convert Logo (baseImage) to base64 if needed
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
        baseImage = {
          base64: logoBase64,
          mimeType: logoMimeType,
        };
        console.log('[handleMockupGenerate] Logo set as baseImage (primary focus)');
      } catch (error: any) {
        console.error('Error converting logo to base64:', error);
        toast.error('Failed to process logo image. Using fallback.');
      }
    }

    // If no logo, use imageInput as fallback (legacy or direct input)
    if (!baseImage && imageToUse) {
      try {
        console.log('[handleMockupGenerate] Using imageInput as baseImage (fallback)...');
        const fallbackBase64 = await normalizeImageToBase64(imageToUse);

        if (!validateBase64Image(fallbackBase64)) {
          throw new Error('Invalid base64 format after conversion');
        }

        const fallbackMimeType = detectMimeType(imageInput);
        baseImage = {
          base64: fallbackBase64,
          mimeType: fallbackMimeType,
        };
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

    // Convert Identity (referenceImage for colors/vibe context) to base64 if available
    let referenceImages: UploadedImage[] | undefined;

    if (connectedIdentity) {
      try {
        console.log('[handleMockupGenerate] Normalizing Identity (referenceImage) to base64...');
        const identityBase64 = await normalizeImageToBase64(connectedIdentity);

        if (validateBase64Image(identityBase64)) {
          const identityMimeType = detectMimeType(connectedIdentity);
          referenceImages = [{
            base64: identityBase64,
            mimeType: identityMimeType,
          }];
          console.log('[handleMockupGenerate] Identity set as referenceImage (context/colors/vibe)');
        }
      } catch (error: any) {
        console.warn('Failed to process identity as reference image, continuing without it:', error);
        // Continue without identity, it's not critical
      }
    }

    // Add preset/custom mockup reference image if available (after identity)
    if (preset.referenceImageUrl && preset.referenceImageUrl.trim() !== '') {
      let presetReferenceImage: UploadedImage | null = null;

      if (isCustomMockup && customMockup) {
        // For custom mockups, load the image directly from the mockup
        try {
          const mockupImageUrl = getImageUrl(customMockup);
          if (mockupImageUrl) {
            const mockupImageBase64 = await normalizeImageToBase64(mockupImageUrl);
            if (validateBase64Image(mockupImageBase64)) {
              const mockupMimeType = detectMimeType(mockupImageUrl);
              presetReferenceImage = {
                base64: mockupImageBase64,
                mimeType: mockupMimeType,
              };
            }
          }
        } catch (error: any) {
          console.warn('Failed to load custom mockup reference image:', error);
          // Continue without reference image, it's not critical
        }
      } else {
        // For regular presets, use the existing loadReferenceImage function
        presetReferenceImage = await loadReferenceImage(preset);
      }

      if (presetReferenceImage) {
        if (!referenceImages) {
          referenceImages = [];
        }
        referenceImages.push(presetReferenceImage);
      }
    }

    // Check for connected BrandNode and get brand identity
    const brandIdentity = getConnectedBrandIdentity(nodeId, nodesRef.current, edgesRef.current);

    // Merge brand colors with manually selected colors (brand colors take priority)
    let finalColors = [...(selectedColors || [])];
    if (brandIdentity) {
      const brandColors = [
        ...brandIdentity.colors.primary,
        ...brandIdentity.colors.secondary,
        ...brandIdentity.colors.accent,
      ];
      // Add brand colors that aren't already in selectedColors
      brandColors.forEach(color => {
        if (!finalColors.includes(color.toUpperCase())) {
          finalColors.push(color.toUpperCase());
        }
      });
      // Limit to 5 colors total
      finalColors = finalColors.slice(0, 5);
    }

    // Build enhanced prompt with colors, brand identity, and human interaction
    // If customPrompt is provided, use it directly; otherwise build from preset
    let enhancedPrompt: string;
    if (customPrompt && customPrompt.trim()) {
      // Use custom prompt as base, but still add colors/human/brand if not already included
      enhancedPrompt = customPrompt.trim();

      // Add brand identity information if available
      if (brandIdentity) {
        if (!enhancedPrompt.toLowerCase().includes('brand') && !enhancedPrompt.toLowerCase().includes('identity')) {
          const brandInfo: string[] = [];
          if (brandIdentity.personality?.tone) {
            brandInfo.push(`brand tone: ${brandIdentity.personality.tone}`);
          }
          if (brandIdentity.typography?.primary) {
            brandInfo.push(`typography: ${brandIdentity.typography.primary}`);
          }
          if (brandInfo.length > 0) {
            enhancedPrompt += ` Brand identity: ${brandInfo.join(', ')}.`;
          }
        }
      }

      if (finalColors.length > 0 && !enhancedPrompt.toLowerCase().includes('color')) {
        enhancedPrompt += ` The scene's color palette should be dominated by or feature accents of: ${finalColors.join(', ')}.`;
      }
      if (withHuman && !enhancedPrompt.toLowerCase().includes('human') && !enhancedPrompt.toLowerCase().includes('person')) {
        const humanAction = Math.random() < 0.5 ? 'looking at' : 'interacting with';
        enhancedPrompt += ` The scene should include a human person naturally ${humanAction} the mockup product. Ensure the moment feels contextual for the product type.`;
      }
    } else {
      // Build from preset prompt
      enhancedPrompt = preset.prompt;

      // Add brand identity information if available
      if (brandIdentity) {
        const brandInfo: string[] = [];
        if (brandIdentity.personality?.tone) {
          brandInfo.push(`brand tone: ${brandIdentity.personality.tone}`);
        }
        if (brandIdentity.typography?.primary) {
          brandInfo.push(`typography: ${brandIdentity.typography.primary}`);
        }
        if (brandIdentity.composition?.style) {
          brandInfo.push(`composition style: ${brandIdentity.composition.style}`);
        }
        if (brandInfo.length > 0) {
          enhancedPrompt += ` Brand identity: ${brandInfo.join(', ')}.`;
        }
      }

      if (finalColors.length > 0) {
        enhancedPrompt += ` The scene's color palette should be dominated by or feature accents of: ${finalColors.join(', ')}.`;
      }
      if (withHuman) {
        const humanAction = Math.random() < 0.5 ? 'looking at' : 'interacting with';
        enhancedPrompt += ` The scene should include a human person naturally ${humanAction} the mockup product. Ensure the moment feels contextual for the product type.`;
      }
    }

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeletonForGenerated(node, nodeId);

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
        hasBaseImage: !!baseImage,
        baseImageIsLogo: isBaseImageLogo,
        baseImageMimeType: baseImage?.mimeType,
        referenceImagesCount: referenceImages?.length || 0,
        hasIdentityAsReference,
        model,
        resolution,
        aspectRatio: preset.aspectRatio,
      });

      // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
      const result = await mockupApi.generate({
        promptText: enhancedPrompt,
        baseImage: baseImage ? {
          base64: baseImage.base64,
          mimeType: baseImage.mimeType
        } : undefined,
        model: model,
        resolution: resolution,
        aspectRatio: preset.aspectRatio,
        referenceImages: referenceImages?.map(img => ({
          base64: img.base64,
          mimeType: img.mimeType
        })),
        imagesCount: 1,
        feature: 'canvas'
      });

      const resultImage = result.imageUrl || result.imageBase64 || '';

      console.log('[handleMockupGenerate] Mockup generated successfully, updating OutputNode', {
        hasImageUrl: !!result.imageUrl,
        hasImageBase64: !!result.imageBase64,
        resultImageLength: resultImage.length
      });

      // Update source node with result so manually connected nodes work
      updateNodeData<MockupNodeData>(nodeId, {
        isLoading: false, // Ensure loading is false
        resultImageUrl: result.imageUrl,
        resultImageBase64: result.imageUrl ? undefined : result.imageBase64,
      } as any, 'mockup');

      // Also update loading state explicitly to be safe
      updateNodeLoadingState<MockupNodeData>(nodeId, false, 'mockup');

      if (newOutputNodeId) {
        updateOutputNodeWithResult(
          newOutputNodeId,
          resultImage,
          () => addToHistory(nodesRef.current, edgesRef.current)
        );

        // Only upload to R2 if we don't already have a URL
        if (!result.imageUrl && result.imageBase64) {
          await uploadImageToR2Auto(result.imageBase64, newOutputNodeId, (imageUrl) => {
            updateOutputNodeWithR2Url(newOutputNodeId!, imageUrl);
          });
        }
      }

      // Credits were already deducted by backend before generation
      // Update subscription status to reflect new credits
      try {
        await refreshSubscriptionStatus();
      } catch (statusError: any) {
        console.error('Failed to refresh subscription status:', statusError);
        // Non-critical - credits were already deducted, just status refresh failed
      }

      toast.success('Mockup generated successfully!', { duration: 3000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId);
      updateNodeLoadingState<MockupNodeData>(nodeId, false, 'mockup');
      toast.error(error?.message || 'Failed to generate mockup', { duration: 5000 });
    }
  }, [setNodes, setEdges, addToHistory, uploadImageToR2Auto, updateNodeLoadingState, validateBase64Image, createOutputNodeWithSkeletonForGenerated, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus, edgesRef]);

  // ========== ANGLE NODE HANDLERS ==========
  // Handlers para gerenciar operações de geração de ângulos de imagem
  const {
    handleAngleGenerate,
    handleAngleNodeDataUpdate,
  } = useAngleNodeHandlers({
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
  });

  // ========== TEXTURE NODE HANDLERS ==========
  const {
    handleTextureGenerate,
    handleTextureNodeDataUpdate,
  } = useTextureNodeHandlers({
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
  });


  // ========== AMBIENCE NODE HANDLERS ==========
  const {
    handleAmbienceGenerate,
    handleAmbienceNodeDataUpdate,
  } = useAmbienceNodeHandlers({
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
  });


  // ========== LUMINANCE NODE HANDLERS ==========
  const {
    handleLuminanceGenerate,
    handleLuminanceNodeDataUpdate,
  } = useLuminanceNodeHandlers({
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
  });

  // ========== SHADER NODE HANDLERS ==========
  // Handlers para aplicar efeitos de shader GLSL em imagens
  const shaderHandlers = useShaderNodeHandlers({
    nodesRef,
    updateNodeData,
    updateNodeLoadingState,
    canvasId,
    setNodes,
  });
  const handleShaderApply = shaderHandlers.handleShaderApply;
  const handleShaderNodeDataUpdate = shaderHandlers.handleShaderNodeDataUpdate;

  // ========== UPSCALE BICUBIC NODE HANDLERS ==========
  // Handlers para aplicar upscale bicúbico usando shader GLSL
  const upscaleBicubicHandlers = useUpscaleBicubicNodeHandlers({
    nodesRef,
    updateNodeData,
    updateNodeLoadingState,
    canvasId,
    setNodes,
  });
  const handleUpscaleBicubicApply = upscaleBicubicHandlers.handleUpscaleBicubicApply;
  const handleUpscaleBicubicNodeDataUpdate = upscaleBicubicHandlers.handleUpscaleBicubicNodeDataUpdate;

  // ========== VIDEO NODE HANDLERS ==========
  // Handlers para gerenciar operações de geração de vídeos usando Veo 3

  // Handle video node data update
  const handleVideoNodeDataUpdate = useCallback((nodeId: string, newData: Partial<VideoNodeData>) => {
    updateNodeData<VideoNodeData>(nodeId, newData, 'video');
  }, [updateNodeData]);

  const handleVideoInputNodeDataUpdate = useCallback((nodeId: string, newData: Partial<VideoInputNodeData>) => {
    updateNodeData<VideoInputNodeData>(nodeId, newData, 'videoInput');
  }, [updateNodeData]);

  // Handle video node upload - accepts both File (for direct upload) or base64 string
  const handleVideoInputNodeUpload = useCallback(async (nodeId: string, videoData: string | File) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'videoInput') {
      console.warn('handleVideoInputNodeUpload: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    // Determine if we have a File (preferred) or base64 string
    const isFile = videoData instanceof File;
    let videoBase64: string;
    let videoFile: File | undefined;

    if (isFile) {
      // We have the original file - prefer direct upload to R2
      videoFile = videoData;
      // Convert to base64 for immediate display
      const videoDataResult = await videoToBase64(videoFile);
      videoBase64 = `data:${videoDataResult.mimeType};base64,${videoDataResult.base64}`;
    } else {
      // Legacy: base64 string
      videoBase64 = videoData;
    }

    // Update node with uploaded video (base64 for immediate display)
    setNodes((nds: Node<FlowNodeData>[]) => {
      return nds.map((n: Node<FlowNodeData>) => {
        if (n.id === nodeId && n.type === 'videoInput') {
          const data = n.data as VideoInputNodeData;
          return {
            ...n,
            data: {
              ...data,
              uploadedVideo: videoBase64,
              uploadedVideoUrl: undefined, // Will be set after R2 upload
            } as VideoInputNodeData,
          } as Node<FlowNodeData>;
        }
        return n;
      });
    });

    // Try to upload to R2 in the background (non-blocking)
    if (canvasId) {
      try {
        let videoUrl: string;

        if (videoFile) {
          // Use direct upload (bypasses Vercel's 4.5MB limit, preserves quality)
          videoUrl = await canvasApi.uploadVideoToR2Direct(videoFile, canvasId, nodeId);
        } else {
          // Fallback to base64 upload (subject to 4.5MB limit)
          videoUrl = await canvasApi.uploadVideoToR2(videoBase64, canvasId, nodeId);
        }

        // Update node with R2 URL
        setNodes((nds: Node<FlowNodeData>[]) => {
          return nds.map((n: Node<FlowNodeData>) => {
            if (n.id === nodeId && n.type === 'videoInput') {
              const data = n.data as VideoInputNodeData;
              return {
                ...n,
                data: {
                  ...data,
                  uploadedVideoUrl: videoUrl,
                  // Keep base64 as fallback
                  uploadedVideo: videoBase64,
                } as VideoInputNodeData,
              } as Node<FlowNodeData>;
            }
            return n;
          });
        });
      } catch (error: any) {
        // If R2 upload fails, keep base64 - don't show error to user
        console.warn('Failed to upload video to R2 (keeping base64):', error);
      }
    }

    toast.success('Video uploaded!', {
      id: `upload-video-${nodeId}`,
      duration: 2000
    });
  }, [setNodes, canvasId]);

  // Handle video node generate
  const handleVideoNodeGenerate = useCallback(async (nodeId: string, prompt: string, imageBase64?: string, model?: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'video') {
      console.warn('handleVideoNodeGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const videoData = node.data as VideoNodeData;
    // Normalize model name - map old 'veo-3' to new 'veo-3.1-generate-preview'
    let selectedModel = model || videoData.model || 'veo-3.1-generate-preview';
    if (selectedModel === 'veo-3') {
      selectedModel = 'veo-3.1-generate-preview';
      console.warn('Model "veo-3" is deprecated, using "veo-3.1-generate-preview" instead');
    }

    // Validate credits before generation (15 credits per video)
    const hasCredits = await validateVideoCredits();
    if (!hasCredits) {
      return;
    }

    updateNodeLoadingState<VideoNodeData>(nodeId, true, 'video');

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeletonForGenerated(node, nodeId);

    if (skeletonNode) {
      newOutputNodeId = skeletonNode.nodeId;
      console.log('[handleVideoNodeGenerate] Creating OutputNode:', newOutputNodeId);
      addToHistory(nodesRef.current, edgesRef.current);
      setNodes((nds: Node<FlowNodeData>[]) => [...nds, skeletonNode.node]);
      setEdges((eds: Edge[]) => [...eds, skeletonNode.edge]);
    }

    try {
      let imageMimeType: string | undefined;
      let processedImageBase64: string | undefined;

      // Process image if provided
      if (imageBase64) {
        try {
          processedImageBase64 = await normalizeImageToBase64(imageBase64);
          imageMimeType = detectMimeType(imageBase64) || 'image/png';
        } catch (error: any) {
          console.warn('Failed to process image for video generation:', error);
          // Continue without image if processing fails
        }
      }

      console.log('[handleVideoNodeGenerate] Calling videoApi.generate with:', {
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        hasImage: !!processedImageBase64,
        model: selectedModel,
        canvasId: canvasId || 'not provided',
        nodeId,
      });

      // Use backend endpoint which validates and deducts credits BEFORE generation
      // Backend will upload video directly to R2 if canvasId is provided
      const result = await videoApi.generate({
        prompt,
        imageBase64: processedImageBase64,
        imageMimeType,
        model: selectedModel,
        canvasId: canvasId,
        nodeId: nodeId,
      });

      updateNodeLoadingState<VideoNodeData>(nodeId, false, 'video');

      // Extract R2 URL or base64 fallback from response
      const videoUrl = result.videoUrl;
      const videoBase64 = result.videoBase64;

      console.log('[handleVideoNodeGenerate] Video generation response received:', {
        hasVideoUrl: !!videoUrl,
        hasVideoBase64: !!videoBase64,
        videoUrl: videoUrl ? videoUrl.substring(0, 100) + '...' : 'none',
      });

      if (newOutputNodeId) {
        // Update OutputNode with video result (prefer R2 URL)
        setNodes((nds: Node<FlowNodeData>[]) => {
          const updatedNodes = nds.map((n: Node<FlowNodeData>) => {
            if (n.id === newOutputNodeId && n.type === 'output') {
              const outputData = n.data as OutputNodeData;
              return {
                ...n,
                data: {
                  ...outputData,
                  resultVideoUrl: videoUrl || undefined, // R2 URL (preferred)
                  resultVideoBase64: videoUrl ? undefined : videoBase64, // Base64 fallback (only if no R2 URL)
                  isLoading: false,
                } as OutputNodeData,
              } as Node<FlowNodeData>;
            }
            return n;
          });
          setTimeout(() => {
            addToHistory(updatedNodes, edgesRef.current);
          }, 0);
          return updatedNodes;
        });
      }

      toast.success(`Video generated successfully! (${result.creditsDeducted} credit${result.creditsDeducted > 1 ? 's' : ''} used, ${result.creditsRemaining} remaining)`, { duration: 4000 });
    } catch (error: any) {
      cleanupFailedNode(newOutputNodeId);
      updateNodeLoadingState<VideoNodeData>(nodeId, false, 'video');
      toast.error(error?.message || 'Failed to generate video', { duration: 5000 });
    }
  }, [setNodes, setEdges, addToHistory, updateNodeLoadingState, createOutputNodeWithSkeletonForGenerated, cleanupFailedNode, canvasId]);

  // ========== PROMPT NODE HANDLERS ==========
  // Handlers para gerenciar operações de geração de imagens a partir de prompts

  // Handle prompt node data update
  const handlePromptNodeDataUpdate = useCallback((nodeId: string, newData: Partial<PromptNodeData>) => {
    updateNodeData<PromptNodeData>(nodeId, newData, 'prompt');
  }, [updateNodeData]);

  // Handle prompt node suggest prompts
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
        isSuggestingPrompts: false
      }, 'prompt');
    } catch (err: any) {
      console.error('Error suggesting prompts:', err);
      toast.error(err?.message || 'Failed to generate prompt suggestions', { duration: 5000 });
      updateNodeData<PromptNodeData>(nodeId, { isSuggestingPrompts: false }, 'prompt');
    }
  }, [updateNodeData]);

  // Handle text node data update
  const handleTextNodeDataUpdate = useCallback((nodeId: string, newData: Partial<TextNodeData>) => {
    updateNodeData<TextNodeData>(nodeId, newData, 'text');
  }, [updateNodeData]);

  // Handle prompt node generate
  const handlePromptGenerate = useCallback(async (nodeId: string, prompt: string, connectedImages?: string[], model?: GeminiModel) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'prompt') {
      console.warn('handlePromptGenerate: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    const promptData = node.data as PromptNodeData;
    const selectedModel: GeminiModel = model || promptData.model || 'gemini-2.5-flash-image';
    const isProModel = selectedModel === 'gemini-3-pro-image-preview';
    // Use resolution and aspectRatio from nodeData if available, otherwise use defaults
    const resolution: Resolution | undefined = isProModel ? (promptData.resolution || '4K') : undefined;
    const aspectRatio = isProModel ? (promptData.aspectRatio || '16:9') : undefined;

    const hasCredits = await validateCredits(selectedModel, resolution);
    if (!hasCredits) return;

    updateNodeLoadingState<PromptNodeData>(nodeId, true, 'prompt');

    let newOutputNodeId: string | null = null;
    const skeletonNode = createOutputNodeWithSkeletonForGenerated(node, nodeId);

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

        // Define limits based on model
        const maxImages = selectedModel === 'gemini-3-pro-image-preview' ? 4 : 2;

        // Validate image count
        if (uploadedImages.length > maxImages) {
          updateNodeLoadingState<PromptNodeData>(nodeId, false, 'prompt');
          toast.error(
            `Maximum ${maxImages} images allowed for ${selectedModel === 'gemini-3-pro-image-preview' ? '4K' : 'HD'} model. You have ${uploadedImages.length} images connected.`,
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
          // HIERARCHY: Logo (priority 1) as baseImage, Identity (priority 2) as first referenceImage
          baseImage = uploadedImages[0];

          // Process reference images based on model
          if (uploadedImages.length > 1) {
            const maxReferenceImages = selectedModel === 'gemini-3-pro-image-preview' ? 3 : 1;
            referenceImages = uploadedImages.slice(1, 1 + maxReferenceImages);
          }

          const promptData = nodesRef.current.find(n => n.id === nodeId)?.data as PromptNodeData;
          const isLogoFirst = promptData?.connectedLogo && connectedImages?.[0] === promptData.connectedLogo;
          const isIdentitySecond = promptData?.connectedIdentity && connectedImages?.[1] === promptData.connectedIdentity;

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

      // Check for connected BrandNode and enhance prompt with brand identity
      const brandIdentity = getConnectedBrandIdentity(nodeId, nodesRef.current, edgesRef.current);
      const promptData = nodesRef.current.find(n => n.id === nodeId)?.data as PromptNodeData;
      const pdfPageReference = promptData?.pdfPageReference;

      let enhancedPrompt = prompt;
      const promptLower = prompt.toLowerCase();

      if (brandIdentity) {
        const brandInfo: string[] = [];
        const brandContext: string[] = [];

        // Intelligent analysis: check if user mentions specific elements
        const mentionsColor = promptLower.includes('color') || promptLower.includes('cor') ||
          promptLower.includes('palette') || promptLower.includes('paleta');
        const mentionsTypography = promptLower.includes('font') || promptLower.includes('fonte') ||
          promptLower.includes('typography') || promptLower.includes('tipografia') ||
          promptLower.includes('text') || promptLower.includes('texto');
        const mentionsStyle = promptLower.includes('style') || promptLower.includes('estilo') ||
          promptLower.includes('composition') || promptLower.includes('composição');
        const mentionsPersonality = promptLower.includes('tone') || promptLower.includes('tom') ||
          promptLower.includes('feeling') || promptLower.includes('sentimento') ||
          promptLower.includes('mood') || promptLower.includes('humor');

        // Add colors (always include, but emphasize if mentioned)
        const allBrandColors = [
          ...brandIdentity.colors.primary,
          ...brandIdentity.colors.secondary,
          ...brandIdentity.colors.accent,
        ];
        if (allBrandColors.length > 0) {
          if (mentionsColor) {
            brandInfo.push(`Use brand colors: ${allBrandColors.join(', ')}`);
          } else {
            brandInfo.push(`Color palette: ${allBrandColors.join(', ')}`);
          }
        }

        // Add typography (include if mentioned or if not explicitly excluded)
        if (brandIdentity.typography?.primary) {
          if (mentionsTypography) {
            brandInfo.push(`Use brand typography: ${brandIdentity.typography.primary}`);
          } else {
            brandInfo.push(`Typography: ${brandIdentity.typography.primary}`);
          }
        }

        // Add personality (include if mentioned)
        if (mentionsPersonality) {
          if (brandIdentity.personality?.tone) {
            brandContext.push(`brand tone: ${brandIdentity.personality.tone}`);
          }
          if (brandIdentity.personality?.feeling) {
            brandContext.push(`brand feeling: ${brandIdentity.personality.feeling}`);
          }
        } else {
          if (brandIdentity.personality?.tone) {
            brandInfo.push(`Brand tone: ${brandIdentity.personality.tone}`);
          }
          if (brandIdentity.personality?.feeling) {
            brandInfo.push(`Brand feeling: ${brandIdentity.personality.feeling}`);
          }
        }

        // Add composition style (include if mentioned)
        if (brandIdentity.composition?.style) {
          if (mentionsStyle) {
            brandInfo.push(`Apply brand composition style: ${brandIdentity.composition.style}`);
          } else {
            brandInfo.push(`Composition style: ${brandIdentity.composition.style}`);
          }
        }

        // Add visual elements if mentioned
        if (promptLower.includes('element') || promptLower.includes('elemento') ||
          promptLower.includes('pattern') || promptLower.includes('padrão')) {
          if (brandIdentity.visualElements.length > 0) {
            brandInfo.push(`Visual elements: ${brandIdentity.visualElements.slice(0, 5).join(', ')}`);
          }
        }

        // Build enhanced prompt
        if (brandInfo.length > 0 || brandContext.length > 0) {
          let brandSection = '';
          if (brandInfo.length > 0) {
            brandSection = `Brand identity requirements: ${brandInfo.join('; ')}.`;
          }
          if (brandContext.length > 0) {
            brandSection += (brandSection ? ' ' : '') + `Brand context: ${brandContext.join(', ')}.`;
          }
          enhancedPrompt = `${prompt}\n\n${brandSection}`;
        }

        // Add PDF page reference if specified
        if (pdfPageReference && pdfPageReference.trim()) {
          enhancedPrompt += `\n\nRefer to "${pdfPageReference.trim()}" from the brand identity guide PDF for additional guidelines and specifications.`;
        }
      } else if (pdfPageReference && pdfPageReference.trim()) {
        // If no brand identity but PDF reference exists, still add it
        enhancedPrompt += `\n\nRefer to "${pdfPageReference.trim()}" from the brand identity guide PDF.`;
      }

      const onRetryProgress = (attempt: number, maxRetries: number, delay: number) => {
        const delaySeconds = Math.round(delay / 1000);
        console.log(`Retrying generation... (Attempt ${attempt}/${maxRetries}, waiting ${delaySeconds}s)`);
      };

      console.log('[handlePromptGenerate] Calling generateMockup with:', {
        prompt: enhancedPrompt.substring(0, 100) + (enhancedPrompt.length > 100 ? '...' : ''),
        hasBaseImage: !!baseImage,
        baseImageMimeType: baseImage?.mimeType,
        referenceImagesCount: referenceImages?.length || 0,
        model: selectedModel,
        resolution,
        aspectRatio,
        hasBrandIdentity: !!brandIdentity,
      });

      // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
      // Note: onRetryProgress callback is not supported in backend endpoint, retries are handled automatically
      const result = await mockupApi.generate({
        promptText: enhancedPrompt,
        baseImage: baseImage ? {
          base64: baseImage.base64,
          mimeType: baseImage.mimeType
        } : undefined,
        model: selectedModel,
        resolution: resolution,
        aspectRatio: aspectRatio,
        referenceImages: referenceImages?.map(img => ({
          base64: img.base64,
          mimeType: img.mimeType
        })),
        imagesCount: 1,
        feature: 'canvas'
      });

      const resultImage = result.imageUrl || result.imageBase64 || '';

      // Update source node with result so manually connected nodes work
      updateNodeData<PromptNodeData>(nodeId, {
        isLoading: false, // Ensure loading is false
        resultImageUrl: result.imageUrl,
        resultImageBase64: result.imageUrl ? undefined : result.imageBase64,
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

      // Credits were already deducted by backend before generation
      try {
        await refreshSubscriptionStatus();
      } catch (statusError: any) {
        console.error('Failed to refresh subscription status:', statusError);
        // Non-critical - credits were already deducted, just status refresh failed
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

      // Show more detailed error message if available
      const errorMessage = error?.errorData?.message || error?.errorData?.error || error?.message || 'Failed to generate image';
      toast.error(errorMessage, { duration: 5000 });
    }
  }, [setNodes, setEdges, addToHistory, uploadImageToR2Auto, updateNodeLoadingState, normalizeImagesToUploadedImages, createOutputNodeWithSkeletonForGenerated, updateOutputNodeWithResult, updateOutputNodeWithR2Url, cleanupFailedNode, refreshSubscriptionStatus, edgesRef]);

  // ========== BRAND NODE HANDLERS ==========
  // Handlers para gerenciar operações de análise e extração de identidade de marca

  // Handle BrandNode data update
  const handleBrandNodeDataUpdate = useCallback((nodeId: string, newData: Partial<BrandNodeData>) => {
    updateNodeData<BrandNodeData>(nodeId, newData, 'brand');
  }, [updateNodeData]);

  // Handle BrandNode logo upload
  const handleBrandLogoUpload = useCallback((nodeId: string, imageBase64: string) => {
    updateNodeData<BrandNodeData>(nodeId, { logoBase64: imageBase64 }, 'brand');
  }, [updateNodeData]);

  // Handle BrandNode PDF upload
  const handleBrandPdfUpload = useCallback((nodeId: string, pdfBase64: string) => {
    updateNodeData<BrandNodeData>(nodeId, { identityPdfBase64: pdfBase64 }, 'brand');
  }, [updateNodeData]);

  // Handle BrandNode analyze
  // ========== COLOR EXTRACTOR NODE HANDLERS ==========
  // Handlers para gerenciar operações do Color Extractor Node

  const handleColorExtractorUpload = useCallback((nodeId: string, imageBase64: string) => {
    updateNodeData<ColorExtractorNodeData>(nodeId, { imageBase64 }, 'colorExtractor');
  }, [updateNodeData]);

  const handleColorExtractorExtract = useCallback(async (nodeId: string, imageBase64: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'colorExtractor') {
      console.warn('handleColorExtractorExtract: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    updateNodeData<ColorExtractorNodeData>(nodeId, { isExtracting: true }, 'colorExtractor');

    try {
      const result = await extractColors(imageBase64);

      updateNodeData<ColorExtractorNodeData>(nodeId, {
        extractedColors: result.colors,
        isExtracting: false,
      }, 'colorExtractor');

      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }

      toast.success(`Extracted ${result.colors.length} colors successfully`, { duration: 2000 });
    } catch (error: any) {
      console.error('Error extracting colors:', error);
      toast.error(error?.message || 'Failed to extract colors', { duration: 5000 });
      updateNodeData<ColorExtractorNodeData>(nodeId, { isExtracting: false }, 'colorExtractor');
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleColorExtractorNodeDataUpdate = useCallback((nodeId: string, newData: Partial<ColorExtractorNodeData>) => {
    updateNodeData<ColorExtractorNodeData>(nodeId, newData, 'colorExtractor');
  }, [updateNodeData]);

  const handleBrandAnalyze = useCallback(async (nodeId: string, logoBase64: string, identityBase64: string, identityType: 'pdf' | 'png' = 'pdf') => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'brand') {
      console.warn('handleBrandAnalyze: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    // Set analyzing state
    updateNodeData<BrandNodeData>(nodeId, { isAnalyzing: true }, 'brand');

    try {
      // Normalize logo to UploadedImage format
      const logoImage: UploadedImage = {
        base64: logoBase64,
        mimeType: detectMimeType(logoBase64) || 'image/png',
      };

      // Extract brand identity (supports PDF or PNG)
      const brandIdentity = await extractBrandIdentity(logoImage, identityBase64, identityType);

      // Update node with extracted identity
      updateNodeData<BrandNodeData>(
        nodeId,
        {
          brandIdentity,
          isAnalyzing: false,
        },
        'brand'
      );

      // Save immediately to persist the analysis to database
      // Wait for React state to update before saving
      if (saveImmediately) {
        // Use setTimeout to wait for React to flush the state update
        setTimeout(async () => {
          try {
            await saveImmediately();
            toast.success('Brand identity extracted and saved successfully!', { duration: 3000 });
          } catch (saveError) {
            // If save fails, still show success for analysis but warn about save
            console.error('Failed to save brand identity analysis:', saveError);
            toast.warning('Analysis saved locally but failed to save to database. Changes may be lost on reload.', { duration: 5000 });
          }
        }, 100); // Small delay to ensure state is updated
      } else {
        toast.success('Brand identity extracted successfully!', { duration: 3000 });
      }
    } catch (error: any) {
      console.error('Error extracting brand identity:', error);
      toast.error(error?.message || 'Failed to extract brand identity. Please try again.', { duration: 5000 });

      // Clear analyzing state on error
      updateNodeData<BrandNodeData>(nodeId, { isAnalyzing: false }, 'brand');
    }
  }, [updateNodeData, saveImmediately]);

  // ========== USEEFFECT - Atualização de Handlers Ref ==========
  // Mantém handlersRef atualizado com todas as funções de handler para evitar dependências circulares

  // Update handlersRef and separate refs when handlers change
  useEffect(() => {
    handlersRef.current = {
      handleMergeGenerate,
      handleMergeGeneratePrompt,
      handleEditApply,
      handleUpscale,
      handleMockupGenerate,
      handleMockupNodeDataUpdate,
      handlePromptGenerate,
      handlePromptSuggestPrompts,
      handlePromptNodeDataUpdate,
      handleVideoNodeGenerate,
      handleVideoNodeDataUpdate,
      handleVideoInputNodeUpload,
      handleUploadImage,
      handleEditNodeDataUpdate,
      handleEditNodeGenerateSmartPrompt,
      handleEditNodeSuggestPrompts,
      handleUpscaleNodeDataUpdate,
      handleBrandNodeDataUpdate,
      handleBrandLogoUpload,
      handleBrandPdfUpload,
      handleBrandAnalyze,
      handleColorExtractorExtract,
      handleColorExtractorUpload,
      handleColorExtractorNodeDataUpdate,
      handleAngleGenerate,
      handleAngleNodeDataUpdate,
      handleTextureGenerate,
      handleTextureNodeDataUpdate,
      handleAmbienceGenerate,
      handleAmbienceNodeDataUpdate,
      handleLuminanceGenerate,
      handleLuminanceNodeDataUpdate,
      handleShaderApply,
      handleShaderNodeDataUpdate,
      handleUpscaleBicubicApply,
      handleUpscaleBicubicNodeDataUpdate,
    };
    handleUploadImageRef.current = handleUploadImage;
  }, [handleMergeGenerate,
    handleMergeGeneratePrompt,
    handleEditApply,
    handleUpscale,
    handleMockupGenerate,
    handleMockupNodeDataUpdate,
    handlePromptGenerate,
    handlePromptSuggestPrompts,
    handlePromptNodeDataUpdate,
    handleVideoNodeGenerate,
    handleVideoNodeDataUpdate,
    handleUploadImage,
    handleEditNodeDataUpdate,
    handleEditNodeGenerateSmartPrompt,
    handleEditNodeSuggestPrompts,
    handleUpscaleNodeDataUpdate,
    handleBrandNodeDataUpdate,
    handleBrandLogoUpload,
    handleBrandPdfUpload,
    handleBrandAnalyze,
    handleColorExtractorExtract,
    handleColorExtractorUpload,
    handleColorExtractorNodeDataUpdate,
    handleAngleGenerate,
    handleAngleNodeDataUpdate,
    handleTextureGenerate,
    handleTextureNodeDataUpdate,
    handleAmbienceGenerate,
    handleAmbienceNodeDataUpdate,
    handleLuminanceGenerate,
    handleLuminanceNodeDataUpdate,
    handleShaderApply,
    handleShaderNodeDataUpdate,
    handleUpscaleBicubicApply,
    handleUpscaleBicubicNodeDataUpdate]);

  // ========== USEEFFECT - Sincronização de Imagens com Edges ==========
  // Sincroniza automaticamente imagens conectadas quando edges mudam
  // Atualiza EditNode, MockupNode, AngleNode e BrandCore com imagens dos node conectados

  // ========== USEEFFECT - Sincronização de Imagens com Edges ==========
  // Sincroniza automaticamente imagens conectadas quando edges mudam
  // Usa hook dedicado useCanvasNodeSync
  useCanvasNodeSync({
    nodes,
    edges,
    setNodes,
  });

  // ========== IMAGE NODE HANDLERS ==========
  // Handlers para gerenciar operações de node de imagem

  // Handle image node resize
  const handleImageNodeResize = useCallback((nodeId: string, width: number, height: number) => {
    setNodes((nds: Node<FlowNodeData>[]) => {
      return nds.map((n: Node<FlowNodeData>) => {
        if (n.id === nodeId && n.type === 'image') {
          return {
            ...n,
            style: {
              ...n.style,
              width,
              height,
            },
          } as Node<FlowNodeData>;
        }
        return n;
      });
    });
  }, [setNodes]);

  // ========== LOGO NODE HANDLERS ==========
  // Handlers para gerenciar operações de node de logo

  // ========== LOGO NODE HANDLERS ==========
  // Handlers para gerenciar operações de node de logo
  const {
    handleLogoNodeUpload,
    handleLogoNodeDataUpdate,
  } = useLogoNodeHandlers({
    updateNodeData,
    canvasId,
  });

  // ========== PDF NODE HANDLERS ==========
  // Handlers para gerenciar operações de node de PDF
  const {
    handlePDFNodeUpload,
    handlePDFNodeDataUpdate,
  } = usePDFNodeHandlers({
    updateNodeData,
  });


  // ========== BRANDCORE NODE HANDLERS ==========
  // Handlers para gerenciar operações do Node BrandCore (núcleo de identidade de marca)

  // BrandCore handlers
  const handleBrandCoreAnalyze = useCallback(async (nodeId: string, logoBase64: string, identityBase64: string, identityType: 'pdf' | 'png' = 'pdf') => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'brandCore') return;

    const brandCoreData = node.data as BrandCoreData;
    updateNodeData<BrandCoreData>(nodeId, { isAnalyzing: true }, 'brandCore');

    try {
      const logoImage: UploadedImage = {
        base64: logoBase64,
        mimeType: detectMimeType(logoBase64) || 'image/png',
      };

      // Consolidate and include strategy data if available
      let strategyText: string | undefined;
      if (brandCoreData.connectedStrategies && brandCoreData.connectedStrategies.length > 0) {
        const { consolidateStrategies, consolidateStrategiesToText } = await import('../../services/brandPromptService');
        const consolidated = consolidateStrategies(brandCoreData.connectedStrategies);
        strategyText = consolidateStrategiesToText(consolidated);
      }

      const brandIdentity = await extractBrandIdentity(logoImage, identityBase64, identityType, strategyText);

      updateNodeData<BrandCoreData>(nodeId, {
        brandIdentity,
        isAnalyzing: false,
      }, 'brandCore');

      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }

      toast.success('Brand identity analyzed successfully', { duration: 2000 });
    } catch (error: any) {
      console.error('Error analyzing brand identity:', error);
      toast.error(error?.message || 'Failed to analyze brand identity', { duration: 5000 });
      updateNodeData<BrandCoreData>(nodeId, { isAnalyzing: false }, 'brandCore');
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleBrandCoreCancelAnalyze = useCallback((nodeId: string) => {
    updateNodeData<BrandCoreData>(nodeId, { isAnalyzing: false }, 'brandCore');
    toast.info('Analysis cancelled', { duration: 2000 });
  }, [updateNodeData]);

  const handleBrandCoreGenerateVisualPrompts = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'brandCore') return;

    const brandCoreData = node.data as any;
    if (!brandCoreData.brandIdentity) {
      toast.error('Brand identity required. Connect logo and identity first.', { duration: 3000 });
      return;
    }

    updateNodeData<BrandCoreData>(nodeId, { isGeneratingPrompts: true }, 'brandCore');

    try {
      const { generateVisualPrompt, consolidateStrategies, extractVisualStrategyText } = await import('../../services/brandPromptService');

      // Extrair apenas dados visuais das estratégias (sem filosofia/conceitos)
      let visualStrategyText: string | undefined;
      if (brandCoreData.connectedStrategies && brandCoreData.connectedStrategies.length > 0) {
        const consolidated = consolidateStrategies(brandCoreData.connectedStrategies);
        visualStrategyText = extractVisualStrategyText(consolidated);
      }

      const visualPrompts = await generateVisualPrompt(brandCoreData.brandIdentity, {
        visualStrategyText,
      });

      updateNodeData<BrandCoreData>(nodeId, {
        visualPrompts,
        isGeneratingPrompts: false,
      }, 'brandCore');

      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }
    } catch (error: any) {
      console.error('Error generating visual prompts:', error);
      toast.error(error?.message || 'Failed to generate visual prompts', { duration: 5000 });
      updateNodeData<BrandCoreData>(nodeId, { isGeneratingPrompts: false }, 'brandCore');
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleBrandCoreGenerateStrategicPrompts = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'brandCore') return;

    const brandCoreData = node.data as any;
    if (!brandCoreData.connectedStrategies || brandCoreData.connectedStrategies.length === 0) {
      return; // No strategies to consolidate
    }

    try {
      const { consolidateStrategies } = await import('../../services/brandPromptService');
      const consolidated = consolidateStrategies(brandCoreData.connectedStrategies);

      updateNodeData<BrandCoreData>(nodeId, {
        strategicPrompts: { consolidated },
      }, 'brandCore');

      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }
    } catch (error: any) {
      console.error('Error consolidating strategies:', error);
      toast.error(error?.message || 'Failed to consolidate strategies', { duration: 5000 });
    }
  }, [saveImmediately]);

  const handleBrandCoreDataUpdate = useCallback((nodeId: string, newData: any) => {
    updateNodeData<BrandCoreData>(nodeId, newData, 'brandCore');
  }, [updateNodeData]);

  // Handler para upload de PDF direto para R2 (evita armazenar base64)
  const handleBrandCoreUploadPdfToR2 = useCallback(async (nodeId: string, pdfBase64: string): Promise<string> => {
    if (!canvasId) {
      throw new Error('Canvas ID is required to upload PDF to R2');
    }
    try {
      const pdfUrl = await canvasApi.uploadPdfToR2(pdfBase64, canvasId, nodeId);
      // Atualizar o Node com a URL do R2 (não armazenar base64)
      updateNodeData<BrandCoreData>(nodeId, {
        uploadedIdentityUrl: pdfUrl,
        uploadedIdentity: undefined, // Limpar base64
        uploadedIdentityType: 'pdf'
      }, 'brandCore');
      return pdfUrl;
    } catch (error: any) {
      console.error('Error uploading PDF to R2:', error);
      throw error;
    }
  }, [canvasId, updateNodeData]);

  // ========== USEEFFECT - Atualização Final de Handlers Ref ==========
  // Atualiza handlersRef com os handlers adicionais (Logo, PDF, BrandCore)

  // Update handlersRef with new handlers
  useEffect(() => {
    handlersRef.current = {
      ...handlersRef.current,
      handleLogoNodeUpload,
      handleLogoNodeDataUpdate,
      handlePDFNodeUpload,
      handlePDFNodeDataUpdate,
      handleVideoInputNodeUpload,
      handleVideoInputNodeDataUpdate,
      handleBrandCoreAnalyze,
      handleBrandCoreCancelAnalyze,
      handleBrandCoreGenerateVisualPrompts,
      handleBrandCoreGenerateStrategicPrompts,
      handleBrandCoreDataUpdate,
      handleBrandCoreUploadPdfToR2,
    };
  }, [
    handleLogoNodeUpload,
    handleLogoNodeDataUpdate,
    handlePDFNodeUpload,
    handlePDFNodeDataUpdate,
    handleBrandCoreAnalyze,
    handleBrandCoreCancelAnalyze,
    handleBrandCoreGenerateVisualPrompts,
    handleBrandCoreGenerateStrategicPrompts,
    handleBrandCoreDataUpdate,
    handleBrandCoreUploadPdfToR2,
  ]);

  // ========== RETORNO DO HOOK ==========
  // Retorna todos os handlers e refs necessários para uso nos componentes

  return {
    handleMergeGenerate,
    handleMergeGeneratePrompt,
    handleEditApply,
    handleUpscale,
    handleMockupGenerate,
    handleMockupNodeDataUpdate,
    handlePromptGenerate,
    handlePromptSuggestPrompts,
    handlePromptNodeDataUpdate,
    handleVideoNodeGenerate,
    handleVideoNodeDataUpdate,
    handleUploadImage,
    handleEditNodeDataUpdate,
    handleEditNodeGenerateSmartPrompt,
    handleEditNodeSuggestPrompts,
    handleUpscaleNodeDataUpdate,
    handleBrandNodeDataUpdate,
    handleBrandLogoUpload,
    handleBrandPdfUpload,
    handleBrandAnalyze,
    handleColorExtractorExtract,
    handleColorExtractorUpload,
    handleColorExtractorNodeDataUpdate,
    handleAngleGenerate,
    handleAngleNodeDataUpdate,
    handleShaderApply,
    handleShaderNodeDataUpdate,
    handleImageNodeResize,
    handleLogoNodeUpload,
    handleLogoNodeDataUpdate,
    handlePDFNodeUpload,
    handlePDFNodeDataUpdate,
    handleTextNodeDataUpdate,
    handleBrandCoreAnalyze,
    handleBrandCoreCancelAnalyze,
    handleBrandCoreGenerateVisualPrompts,
    handleBrandCoreGenerateStrategicPrompts,
    handleBrandCoreDataUpdate,
    handlersRef,
    nodesRef,
    updateNodeData,
  };
};
