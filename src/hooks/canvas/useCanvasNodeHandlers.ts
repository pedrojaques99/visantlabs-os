// ========== IMPORTS - React ==========
import { useCallback, useRef, useEffect } from 'react';

// ========== IMPORTS - Tipos ReactFlow ==========
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, ImageNodeData, MergeNodeData, EditNodeData, UpscaleNodeData, MockupNodeData, PromptNodeData, OutputNodeData, BrandNodeData, AngleNodeData, LogoNodeData, PDFNodeData, StrategyNodeData, BrandCoreData, VideoNodeData, VideoInputNodeData, TextureNodeData, AmbienceNodeData, LuminanceNodeData, ShaderNodeData, ColorExtractorNodeData, TextNodeData, ChatNodeData, GenerateVideoParams, NodeBuilderData, CustomNodeData, VariablesNodeData, DataNodeData, BatchRunnerNodeData } from '@/types/reactFlow';
import { useBatchRunnerHandlers } from './handlers/useBatchRunnerHandlers';
import type { CustomNodeDefinition, MultiOutputConfig } from '@/types/customNode';
import { DEFAULT_MODEL } from '@/constants/geminiModels';
import { nodeBuilderApi } from '@/services/nodeBuilderApi';
import { executeCustomNode } from '@/utils/canvas/executeCustomNode';
import { resolveProvider } from '@/utils/canvas/generationContext';
import type { ReactFlowInstance } from '@/types/reactflow-instance';

// ========== IMPORTS - Tipos Customizados ==========
import type { UploadedImage, GeminiModel, SeedreamModel, Resolution, BrandingData, AspectRatio } from '@/types/types';
import type { Mockup } from '@/services/mockupApi';

// ========== IMPORTS - Serviços ==========
import { detectMimeType } from '@/services/reactFlowService';
import { subscriptionService } from '@/services/subscriptionService';
import { generateMergePrompt } from '@/services/geminiService';
import { mockupApi } from '@/services/mockupApi';
import { videoApi } from '@/services/videoApi';
import { extractBrandIdentity } from '@/services/brandIdentityService';
import { isLocalDevelopment } from '@/utils/env';
import { canvasApi } from '@/services/canvasApi';
import { videoToBase64 } from '@/utils/fileUtils';
import { extractColors } from '@/utils/colorExtraction';

// ========== IMPORTS - Utils ==========
import { generateNodeId, getConnectedImages, cleanEdgeHandles } from '@/utils/canvas/canvasNodeUtils';
import { getImageUrl } from '@/utils/imageUtils';

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
import { useBrandCoreNodeHandlers } from './handlers/useBrandCoreNodeHandlers';
import { useVideoNodeHandlers } from './handlers/useVideoNodeHandlers';
import { useEditNodeHandlers } from './handlers/useEditNodeHandlers';
import { useMockupNodeHandlers } from './handlers/useMockupNodeHandlers';
import { usePromptNodeHandlers } from './handlers/usePromptNodeHandlers';
import { useCanvasNodeSync } from './useCanvasNodeSync';
import {
  createOutputNodeWithSkeleton as createOutputNodeWithSkeletonUtil,
  updateOutputNodeWithResult as updateOutputNodeWithResultUtil,
  updateOutputNodeWithR2Url as updateOutputNodeWithR2UrlUtil,
  cleanupFailedNode as cleanupFailedNodeUtil,
  normalizeImagesToUploadedImages,
} from './utils/nodeGenerationUtils';
import { uploadImageToR2Auto as uploadImageToR2AutoUtil } from './utils/r2UploadUtils';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';

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
  saveImmediately?: () => Promise<void>,
  handleSavePrompt?: (prompt: string) => void
) => {
  // ========== CONFIGURAÇÃO INICIAL - Refs e Estado ==========

  // Brand context from canvas header (linked guideline)
  const { linkedGuideline } = useCanvasHeader();

  // Create handlersRef early to avoid circular dependency
  const handlersRef = useRef<any>({});

  // Separate refs for handlers used in node creation to avoid circular dependency
  const handleUploadImageRef = useRef<((nodeId: string, imageBase64: string) => Promise<void>) | null>(null);

  /** Nodes currently being uploaded via explicit user action (file select, paste, etc.).
   * useImmediateR2Upload skips these to avoid duplicate uploads. */
  const userUploadInProgressRef = useRef<Set<string>>(new Set());

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
          const updatedData = {
            ...(n.data as T),
            ...newData,
          } as T;

          // For strategy nodes, ensure strategyData is properly merged if it's an object
          if (n.type === 'strategy' && newData.strategyData && typeof newData.strategyData === 'object') {
            const currentStrategyData = (n.data as any).strategyData;
            if (currentStrategyData && typeof currentStrategyData === 'object') {
              // Merge strategyData objects instead of replacing
              updatedData.strategyData = {
                ...currentStrategyData,
                ...newData.strategyData,
              } as any;
            }
          }

          if (isLocalDevelopment() && n.type === 'strategy' && newData.strategyData) {
            console.log(`[updateNodeData] Updating strategy node`, {
              nodeId,
              strategyDataKeys: Object.keys(newData.strategyData as any),
              strategyDataCount: Object.keys(newData.strategyData as any).length,
              updatedStrategyDataKeys: updatedData.strategyData ? Object.keys(updatedData.strategyData as any) : [],
              updatedStrategyDataCount: updatedData.strategyData ? Object.keys(updatedData.strategyData as any).length : 0
            });
          }

          return {
            ...n,
            data: updatedData,
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


  // ========== EDIT / UPSCALE / UPLOAD NODE HANDLERS ==========
  const {
    handleEditApply,
    handleUpscale,
    handleUploadImage,
    handleEditNodeDataUpdate,
    handleUpscaleNodeDataUpdate,
    handleEditNodeGenerateSmartPrompt,
    handleEditNodeSuggestPrompts,
  } = useEditNodeHandlers({
    nodesRef,
    edgesRef,
    updateNodeData,
    updateNodeLoadingState,
    setNodes,
    setEdges,
    addToHistory,
    canvasId,
    createOutputNodeWithSkeleton: createOutputNodeWithSkeletonForGenerated,
    updateOutputNodeWithResult,
    updateOutputNodeWithR2Url,
    uploadImageToR2Auto,
    cleanupFailedNode,
    refreshSubscriptionStatus,
  });

  // ========== MOCKUP NODE HANDLERS ==========
  const {
    handleMockupNodeDataUpdate,
    handleMockupGenerate,
  } = useMockupNodeHandlers({
    nodesRef,
    edgesRef,
    updateNodeData,
    updateNodeLoadingState,
    setNodes,
    setEdges,
    addToHistory,
    createOutputNodeWithSkeleton: createOutputNodeWithSkeletonForGenerated,
    updateOutputNodeWithResult,
    updateOutputNodeWithR2Url,
    uploadImageToR2Auto,
    cleanupFailedNode,
    refreshSubscriptionStatus,
    linkedGuideline,
  });

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
    linkedGuideline,
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
    linkedGuideline,
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
    linkedGuideline,
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
    linkedGuideline,
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
  const {
    handleVideoNodeDataUpdate,
    handleVideoInputNodeDataUpdate,
    handleVideoInputNodeUpload,
    handleVideoNodeGenerate,
  } = useVideoNodeHandlers({
    nodesRef,
    edgesRef,
    updateNodeData,
    updateNodeLoadingState,
    setNodes,
    setEdges,
    addToHistory,
    canvasId,
    createOutputNodeWithSkeleton: createOutputNodeWithSkeletonForGenerated,
    cleanupFailedNode,
  });


  // ========== PROMPT NODE HANDLERS ==========
  const {
    handlePromptNodeDataUpdate,
    handleTextNodeDataUpdate,
    handlePromptSuggestPrompts,
    handlePromptGenerate,
  } = usePromptNodeHandlers({
    nodesRef,
    edgesRef,
    updateNodeData,
    updateNodeLoadingState,
    setNodes,
    setEdges,
    addToHistory,
    createOutputNodeWithSkeleton: createOutputNodeWithSkeletonForGenerated,
    updateOutputNodeWithResult,
    updateOutputNodeWithR2Url,
    uploadImageToR2Auto,
    cleanupFailedNode,
    refreshSubscriptionStatus,
    linkedGuideline,
  });

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

  const handleColorExtractorExtract = useCallback(async (nodeId: string, imageBase64: string, shouldRandomize: boolean = false) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'colorExtractor') {
      console.warn('handleColorExtractorExtract: Node not found or wrong type', { nodeId, foundNode: !!node });
      return;
    }

    updateNodeData<ColorExtractorNodeData>(nodeId, { isExtracting: true }, 'colorExtractor');

    try {
      const result = await extractColors(imageBase64, 'image/png', 10, shouldRandomize);

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

  const handleColorExtractorRegenerateOne = useCallback(async (nodeId: string, imageBase64: string, index: number) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'colorExtractor') return;

    const currentColors = (node.data as ColorExtractorNodeData).extractedColors || [];

    // Optimistic UI update could be done here if needed, but we'll wait for result
    // We don't want to set full 'isExtracting' because that might lock the whole node UI, 
    // but we can if we want to show global loading. For "subtle", maybe just let it pop in?
    // Let's not set global isExtracting to avoid flashing the big button loader.

    try {
      // We request MORE colors (e.g. 30) with randomization to find a good candidate
      const result = await extractColors(imageBase64, 'image/png', 30, true);

      // Filter out colors that are already in the CURRENT palette (excluding the one we are replacing)
      const otherColors = currentColors.filter((_, i) => i !== index);

      // Find the first extracted color that is NOT in otherColors AND is effectively different from the current one
      // We check for exact string match first.
      const newColor = result.colors.find(c => !otherColors.includes(c) && c !== currentColors[index]);

      if (newColor) {
        const newColors = [...currentColors];
        newColors[index] = newColor;

        updateNodeData<ColorExtractorNodeData>(nodeId, {
          extractedColors: newColors
        }, 'colorExtractor');

        if (saveImmediately) {
          setTimeout(() => saveImmediately(), 100);
        }
      } else {
        console.warn('No new distinct color found for single regeneration');
        toast('No new distinct color found', { duration: 2000 });
      }

    } catch (error) {
      console.error('Error regenerating single color:', error);
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
      userUploadInProgressRef,
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
      handleSavePrompt,
      // node builder handlers populated in the second useEffect below
    };
    handleUploadImageRef.current = handleUploadImage;
  }, [
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
    handleUpscaleBicubicNodeDataUpdate,
    handleSavePrompt,
  ]);

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
  const {
    handleBrandCoreAnalyze,
    handleBrandCoreCancelAnalyze,
    handleBrandCoreGenerateVisualPrompts,
    handleBrandCoreGenerateStrategicPrompts,
    handleBrandCoreDataUpdate,
    handleBrandCoreUploadPdfToR2,
  } = useBrandCoreNodeHandlers({
    nodesRef,
    updateNodeData,
    canvasId,
    saveImmediately,
  });


  // ========== BATCH RUNNER HANDLERS ==========
  const {
    handleBatchRun,
    handleBatchCancel,
    handleBatchReset,
    handleBatchNodeDataUpdate,
  } = useBatchRunnerHandlers({ nodesRef, edgesRef, updateNodeData });

  // ========== DATA NODE HANDLER ==========
  const handleDataNodeDataUpdate = useCallback(
    (nodeId: string, newData: Partial<DataNodeData>) => {
      updateNodeData<DataNodeData>(nodeId, newData, 'data');
    },
    [updateNodeData]
  );

  // ========== VARIABLES NODE HANDLER ==========
  const handleVariablesNodeDataUpdate = useCallback(
    (nodeId: string, newData: Partial<VariablesNodeData>) => {
      updateNodeData<VariablesNodeData>(nodeId, newData, 'variables');
    },
    [updateNodeData]
  );

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
      handleSavePrompt,
      handleVariablesNodeDataUpdate,
      handleDataNodeDataUpdate,
      handleBatchRun,
      handleBatchCancel,
      handleBatchReset,
      handleBatchNodeDataUpdate,
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
    handleSavePrompt,
    handleVariablesNodeDataUpdate,
    handleDataNodeDataUpdate,
    handleBatchRun,
    handleBatchCancel,
    handleBatchReset,
    handleBatchNodeDataUpdate,
  ]);

  // ========== NODE BUILDER + CUSTOM NODE HANDLERS ==========

  const handleNodeBuilderSendMessage = useCallback(async (nodeId: string, message: string) => {
    const node = reactFlowInstance?.getNode(nodeId);
    if (!node) return;

    const current = node.data as NodeBuilderData;
    const history = current.messages ?? [];
    const newHistory = [...history, { role: 'user' as const, content: message }];

    updateNodeData(nodeId, { messages: newHistory, isLoading: true });

    try {
      const response = await nodeBuilderApi.generate(newHistory);

      if (response.type === 'question') {
        updateNodeData(nodeId, {
          messages: [...newHistory, { role: 'assistant' as const, content: response.text }],
          isLoading: false,
        });
      } else {
        updateNodeData(nodeId, {
          messages: [...newHistory, {
            role: 'assistant' as const,
            content: `Ready! I've designed **${response.definition.name}**. Review and click "Create".`,
          }],
          isLoading: false,
          pendingDefinition: response.definition,
        });
      }
    } catch {
      updateNodeData(nodeId, {
        messages: [...newHistory, { role: 'assistant' as const, content: 'Something went wrong. Please try again.' }],
        isLoading: false,
      });
    }
  }, [reactFlowInstance, updateNodeData]);

  const handleNodeBuilderSpawn = useCallback((builderNodeId: string, definition: CustomNodeDefinition) => {
    const builder = reactFlowInstance?.getNode(builderNodeId);
    if (!builder) return;

    const id = `custom-${Date.now()}`;
    const cfg = definition.behaviorConfig;

    setNodes((nds: any[]) => [...nds, {
      id,
      type: 'custom',
      position: { x: builder.position.x + 500, y: builder.position.y },
      data: {
        definition,
        prompts: cfg.renderCategory === 'multi-output' ? (cfg as MultiOutputConfig).prompts : undefined,
      } as CustomNodeData,
    }]);

    setEdges(eds => [...eds, {
      id: `${builderNodeId}->${id}`,
      source: builderNodeId,
      target: id,
    }]);

    updateNodeData(builderNodeId, { pendingDefinition: undefined });
  }, [reactFlowInstance, setNodes, setEdges, updateNodeData]);

  const handleNodeBuilderUpdateData = useCallback((nodeId: string, newData: Partial<NodeBuilderData>) => {
    updateNodeData<NodeBuilderData>(nodeId, newData, 'nodeBuilder');
  }, [updateNodeData]);

  /**
   * Generates a single image and spawns an output node near the custom node.
   * Used by executeCustomNode so it doesn't need a PromptNode in the graph.
   */
  const handleCustomGenerate = useCallback(async (
    sourceNodeId: string,
    prompt: string,
    images?: string[],
    model?: GeminiModel | SeedreamModel,
    outputIndex = 0
  ) => {
    const sourceNode = reactFlowInstance?.getNode(sourceNodeId);
    if (!sourceNode) return;

    const newOutputNodeId = generateNodeId('output');

    setNodes((nds: any[]) => [...nds, {
      id: newOutputNodeId,
      type: 'output',
      position: {
        x: sourceNode.position.x + 360 + outputIndex * 240,
        y: sourceNode.position.y + outputIndex * 20,
      },
      data: {
        type: 'output',
        isLoading: true,
        sourceNodeId,
      } as OutputNodeData,
    }]);

    setEdges((eds: any[]) => [...eds, {
      id: `${sourceNodeId}->${newOutputNodeId}`,
      source: sourceNodeId,
      target: newOutputNodeId,
    }]);

    try {
      const selectedModel = model || DEFAULT_MODEL;

      let baseImage: { base64: string; mimeType: string } | undefined;
      if (images?.[0]) {
        const normalized = await normalizeImagesToUploadedImages([images[0]]);
        if (normalized[0]) {
          baseImage = { base64: normalized[0].base64, mimeType: normalized[0].mimeType };
        }
      }

      const result = await mockupApi.generate({
        promptText: prompt,
        baseImage,
        model: selectedModel,
        imagesCount: 1,
        feature: 'canvas',
        provider: resolveProvider(selectedModel),
      });

      updateNodeData(newOutputNodeId, {
        isLoading: false,
        resultImageUrl: result.imageUrl,
        resultImageBase64: result.imageUrl ? undefined : result.imageBase64,
      } as any);

      if (result.imageBase64) {
        uploadImageToR2Auto(result.imageBase64, newOutputNodeId, (imageUrl) => {
          updateNodeData(newOutputNodeId, { resultImageUrl: imageUrl } as any);
        });
      }
    } catch (err) {
      setNodes((nds: any[]) => nds.filter(n => n.id !== newOutputNodeId));
      setEdges((eds: any[]) => eds.filter(e => e.target !== newOutputNodeId && e.source !== newOutputNodeId));
      throw err;
    }
  }, [reactFlowInstance, setNodes, setEdges, updateNodeData, uploadImageToR2Auto]);

  const handleCustomNodeExecute = useCallback(async (nodeId: string) => {
    const node = reactFlowInstance?.getNode(nodeId);
    if (!node) return;

    const { definition, prompts, connectedImages, shaderDescription } = node.data as CustomNodeData;
    const logEntries: string[] = [];

    updateNodeData(nodeId, { isLoading: true, executionLog: [] });

    try {
      await executeCustomNode(
        nodeId,
        definition,
        { prompts, connectedImages, shaderDescription },
        {
          generateImage: (prompt, images, model, outputIndex) =>
            handleCustomGenerate(nodeId, prompt, images, model, outputIndex),
          handleUpscale: handlersRef.current?.handleUpscale,
          getNode: (id: string) => reactFlowInstance?.getNode(id),
          setNodes,
          setEdges,
        },
        (msg: string) => {
          logEntries.push(msg);
          updateNodeData(nodeId, { executionLog: [...logEntries] });
        }
      );
    } catch (err) {
      console.error('[handleCustomNodeExecute]', err);
      toast.error('Node execution failed');
    } finally {
      updateNodeData(nodeId, { isLoading: false });
    }
  }, [reactFlowInstance, setNodes, setEdges, updateNodeData, handlersRef, handleCustomGenerate]);

  // ========== USEEFFECT - Node Builder handlers in handlersRef ==========
  useEffect(() => {
    handlersRef.current = {
      ...handlersRef.current,
      handleNodeBuilderSendMessage,
      handleNodeBuilderSpawn,
      handleNodeBuilderUpdateData,
      handleCustomNodeExecute,
      handleCustomGenerate,
    };
  }, [handleNodeBuilderSendMessage, handleNodeBuilderSpawn, handleNodeBuilderUpdateData, handleCustomNodeExecute, handleCustomGenerate]);

  // ========== RETORNO DO HOOK ==========
  // Retorna todos os handlers e refs necessários para uso nos componentes

  return {
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
    handleColorExtractorRegenerateOne,
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
    handleSavePrompt,
    handleNodeBuilderSendMessage,
    handleNodeBuilderSpawn,
    handleNodeBuilderUpdateData,
    handleCustomNodeExecute,
    handleVariablesNodeDataUpdate,
    handleDataNodeDataUpdate,
    handleBatchRun,
    handleBatchCancel,
    handleBatchReset,
    handleBatchNodeDataUpdate,
    handlersRef,
    nodesRef,
    updateNodeData,
  };
};
