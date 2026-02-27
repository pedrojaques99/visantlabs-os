import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, DirectorNodeData, PromptNodeData } from '@/types/reactFlow';
import { toast } from 'sonner';
import { aiApi } from '@/services/aiApi';
import { generateNodeId } from '@/utils/canvas/canvasNodeUtils';
import { isLocalDevelopment } from '@/utils/env';
import { normalizeImageToBase64, detectMimeType } from '@/services/reactFlowService';

interface UseDirectorNodeHandlerParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  updateNodeData: <T extends FlowNodeData>(
    nodeId: string,
    newData: Partial<T>,
    nodeType?: string
  ) => void;
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  addToHistory?: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  handlersRef: React.MutableRefObject<any>;
}

export const useDirectorNodeHandler = ({
  nodesRef,
  edgesRef,
  updateNodeData,
  setNodes,
  setEdges,
  addToHistory,
  handlersRef,
}: UseDirectorNodeHandlerParams) => {

  /**
   * Analyze the connected image and suggest tags
   */
  const handleDirectorAnalyze = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'director') {
      toast.error('Director node not found');
      return;
    }

    const directorData = node.data as DirectorNodeData;
    const connectedImage = directorData.connectedImage;

    if (!connectedImage) {
      toast.error('No image connected to the Director node');
      return;
    }

    // Set analyzing state
    updateNodeData<DirectorNodeData>(nodeId, {
      isAnalyzing: true,
      hasAnalyzed: false,
    }, 'director');

    try {
      if (isLocalDevelopment()) {
        console.log('[DirectorNode] Starting analysis...', { 
          connectedImage: connectedImage?.substring(0, 100) 
        });
      }

      // Normalize image to base64 (handles both R2 URLs and base64)
      const mimeType = detectMimeType(connectedImage);
      const base64Data = await normalizeImageToBase64(connectedImage);

      if (isLocalDevelopment()) {
        console.log('[DirectorNode] Image normalized:', { 
          mimeType, 
          base64Length: base64Data?.length 
        });
      }

      // Prepare image for analysis
      const imageData = {
        base64: base64Data,
        mimeType: mimeType
      };

      // Call AI analysis
      const analysis = await aiApi.analyzeSetup(imageData);

      if (isLocalDevelopment()) {
        console.log('[DirectorNode] Analysis result:', analysis);
      }

      // Extract colors if image has base64
      let suggestedColors: string[] = [];
      try {
        const { extractColors } = await import('@/utils/colorExtraction');
        const colorResult = await extractColors(base64Data, mimeType, 8);
        suggestedColors = colorResult.colors || [];
      } catch (colorErr) {
        if (isLocalDevelopment()) {
          console.error('[DirectorNode] Error extracting colors:', colorErr);
        }
      }

      // Update node with analysis results
      updateNodeData<DirectorNodeData>(nodeId, {
        isAnalyzing: false,
        hasAnalyzed: true,
        suggestedBrandingTags: analysis.branding || [],
        suggestedCategoryTags: analysis.categories || [],
        suggestedLocationTags: analysis.locations || [],
        suggestedAngleTags: analysis.angles || [],
        suggestedLightingTags: analysis.lighting || [],
        suggestedEffectTags: analysis.effects || [],
        suggestedMaterialTags: analysis.materials || [],
        suggestedColors,
        suggestedDesignType: analysis.designType,
        // Pre-select suggested design type and tags
        selectedDesignType: analysis.designType,
        selectedBrandingTags: analysis.branding?.slice(0, 1) || [],
        selectedCategoryTags: analysis.categories?.slice(0, 1) || [],
      }, 'director');

      toast.success('Image analyzed! Select tags to generate your prompt.');
    } catch (error: any) {
      if (isLocalDevelopment()) {
        console.error('[DirectorNode] Analysis error:', error);
      }
      
      updateNodeData<DirectorNodeData>(nodeId, {
        isAnalyzing: false,
      }, 'director');

      const errorMessage = error?.message || 'Failed to analyze image';
      toast.error(errorMessage);
    }
  }, [nodesRef, updateNodeData]);

  /**
   * Generate a prompt based on selected tags and create a PromptNode
   */
  const handleDirectorGeneratePrompt = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'director') {
      toast.error('Director node not found');
      return;
    }

    const directorData = node.data as DirectorNodeData;

    // Validate we have selections (or pool has items in pool mode)
    let hasSelections = 
      (directorData.selectedBrandingTags?.length || 0) > 0 ||
      (directorData.selectedCategoryTags?.length || 0) > 0 ||
      (directorData.selectedLocationTags?.length || 0) > 0 ||
      (directorData.selectedAngleTags?.length || 0) > 0 ||
      (directorData.selectedLightingTags?.length || 0) > 0 ||
      (directorData.selectedEffectTags?.length || 0) > 0 ||
      (directorData.selectedMaterialTags?.length || 0) > 0 ||
      (directorData.selectedColors?.length || 0) > 0;

    // In pool mode, check if pool has at least one tag
    if (!hasSelections && directorData.isSurpriseMeMode && directorData.surpriseMePool) {
      const pool = directorData.surpriseMePool;
      hasSelections = 
        pool.selectedCategoryTags.length > 0 ||
        pool.selectedLocationTags.length > 0 ||
        pool.selectedAngleTags.length > 0 ||
        pool.selectedLightingTags.length > 0 ||
        pool.selectedEffectTags.length > 0 ||
        pool.selectedMaterialTags.length > 0;
    }

    if (!hasSelections) {
      toast.error('Please select at least one tag' + (directorData.isSurpriseMeMode ? ' or add tags to the pool' : ''));
      return;
    }

    // Set generating state
    updateNodeData<DirectorNodeData>(nodeId, {
      isGeneratingPrompt: true,
    }, 'director');

    try {
      if (isLocalDevelopment()) {
        console.log('[DirectorNode] Generating prompt with selections:', {
          branding: directorData.selectedBrandingTags,
          categories: directorData.selectedCategoryTags,
          locations: directorData.selectedLocationTags,
          angles: directorData.selectedAngleTags,
          lighting: directorData.selectedLightingTags,
          effects: directorData.selectedEffectTags,
          colors: directorData.selectedColors,
        });
      }

      // Prepare image for prompt generation (handle R2 URLs)
      const connectedImage = directorData.connectedImage;
      let imageData = null;
      if (connectedImage) {
        try {
          const mimeType = detectMimeType(connectedImage);
          const base64Data = await normalizeImageToBase64(connectedImage);
          imageData = {
            base64: base64Data,
            mimeType: mimeType
          };
        } catch (imgErr) {
          if (isLocalDevelopment()) {
            console.error('[DirectorNode] Error normalizing image for prompt generation:', imgErr);
          }
          // Continue without image if conversion fails
        }
      }

      // Helper function to randomly select from pool or use selected tags
      const getRandomFromPool = (pool: string[]): string[] => {
        if (pool.length === 0) return [];
        const randomIndex = Math.floor(Math.random() * pool.length);
        return [pool[randomIndex]];
      };

      // If pool mode is active, randomly select from pools
      let categoryTags = directorData.selectedCategoryTags || [];
      let locationTags = directorData.selectedLocationTags || [];
      let angleTags = directorData.selectedAngleTags || [];
      let lightingTags = directorData.selectedLightingTags || [];
      let effectTags = directorData.selectedEffectTags || [];
      let materialTags = directorData.selectedMaterialTags || [];

      if (directorData.isSurpriseMeMode && directorData.surpriseMePool) {
        const pool = directorData.surpriseMePool;
        
        // Randomly select from pools if they have items, otherwise use selected tags
        if (pool.selectedCategoryTags.length > 0) {
          categoryTags = getRandomFromPool(pool.selectedCategoryTags);
        }
        if (pool.selectedLocationTags.length > 0) {
          locationTags = getRandomFromPool(pool.selectedLocationTags);
        }
        if (pool.selectedAngleTags.length > 0) {
          angleTags = getRandomFromPool(pool.selectedAngleTags);
        }
        if (pool.selectedLightingTags.length > 0) {
          lightingTags = getRandomFromPool(pool.selectedLightingTags);
        }
        if (pool.selectedEffectTags.length > 0) {
          effectTags = getRandomFromPool(pool.selectedEffectTags);
        }
        if (pool.selectedMaterialTags.length > 0) {
          materialTags = getRandomFromPool(pool.selectedMaterialTags);
        }
      }

      // Generate smart prompt
      const result = await aiApi.generateSmartPrompt({
        baseImage: imageData,
        designType: directorData.selectedDesignType || directorData.suggestedDesignType || 'logo',
        brandingTags: directorData.selectedBrandingTags || [],
        categoryTags,
        locationTags,
        angleTags,
        lightingTags,
        effectTags,
        materialTags,
        selectedColors: directorData.selectedColors || [],
        aspectRatio: '16:9',
        generateText: false,
        withHuman: false,
        enhanceTexture: false,
        negativePrompt: '',
        additionalPrompt: '',
        instructions: '',
      });

      const generatedPrompt = result.prompt;

      if (isLocalDevelopment()) {
        console.log('[DirectorNode] Generated prompt:', generatedPrompt);
      }

      // Update node with generated prompt
      updateNodeData<DirectorNodeData>(nodeId, {
        isGeneratingPrompt: false,
        generatedPrompt,
      }, 'director');

      // Create PromptNode with the generated prompt
      const directorNode = nodesRef.current.find(n => n.id === nodeId);
      if (!directorNode) return;

      const promptNodeId = generateNodeId('prompt');
      const promptNodePosition = {
        x: directorNode.position.x + 400,
        y: directorNode.position.y,
      };

      // Add history before creating new node
      if (addToHistory) {
        addToHistory(nodesRef.current, edgesRef.current);
      }

      const newPromptNode: Node<FlowNodeData> = {
        id: promptNodeId,
        type: 'prompt',
        position: promptNodePosition,
        draggable: true,
        connectable: true,
        selectable: true,
        data: {
          type: 'prompt',
          prompt: generatedPrompt,
          model: 'gemini-2.5-flash-image',
          onGenerate: handlersRef.current?.handlePromptGenerate || (() => Promise.resolve()),
          onSuggestPrompts: handlersRef.current?.handlePromptSuggestPrompts || (() => Promise.resolve()),
          onSavePrompt: handlersRef.current?.handleSavePrompt || (() => {}),
          onUpdateData: handlersRef.current?.handlePromptNodeDataUpdate || (() => {}),
          onDelete: handlersRef.current?.handleDelete || (() => Promise.resolve()),
          onDuplicate: handlersRef.current?.handleDuplicate || (() => {}),
        } as PromptNodeData,
      };

      // Add the new PromptNode
      setNodes((nds) => [...nds, newPromptNode]);

      // Find the source ImageNode to connect to PromptNode
      const sourceImageNodeId = directorData.sourceImageNodeId;
      if (sourceImageNodeId) {
        // Create edge from source ImageNode to PromptNode
        const newEdge: Edge = {
          id: `edge-${sourceImageNodeId}-${promptNodeId}`,
          source: sourceImageNodeId,
          target: promptNodeId,
          targetHandle: 'input-1',
          type: 'default',
        };

        setEdges((eds) => [...eds, newEdge]);

        if (isLocalDevelopment()) {
          console.log('[DirectorNode] Created edge from ImageNode to PromptNode:', newEdge);
        }
      }

      // Add history after creating node and edge
      setTimeout(() => {
        if (addToHistory) {
          addToHistory(nodesRef.current, edgesRef.current);
        }
      }, 100);

      toast.success('Prompt generated and PromptNode created!');
    } catch (error: any) {
      if (isLocalDevelopment()) {
        console.error('[DirectorNode] Prompt generation error:', error);
      }

      updateNodeData<DirectorNodeData>(nodeId, {
        isGeneratingPrompt: false,
      }, 'director');

      const errorMessage = error?.message || 'Failed to generate prompt';
      toast.error(errorMessage);
    }
  }, [nodesRef, edgesRef, updateNodeData, setNodes, setEdges, addToHistory, handlersRef]);

  /**
   * Update Director node data
   */
  const handleDirectorNodeDataUpdate = useCallback((
    nodeId: string,
    newData: Partial<DirectorNodeData>
  ) => {
    updateNodeData<DirectorNodeData>(nodeId, newData, 'director');
  }, [updateNodeData]);

  return {
    handleDirectorAnalyze,
    handleDirectorGeneratePrompt,
    handleDirectorNodeDataUpdate,
  };
};
