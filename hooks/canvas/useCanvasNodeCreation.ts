import { useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, ImageNodeData, MergeNodeData, EditNodeData, UpscaleNodeData, UpscaleBicubicNodeData, MockupNodeData, PromptNodeData, OutputNodeData, BrandNodeData, AngleNodeData, LogoNodeData, PDFNodeData, StrategyNodeData, BrandCoreData, VideoNodeData, TextureNodeData, AmbienceNodeData, LuminanceNodeData, ShaderNodeData, TextNodeData, ChatNodeData } from '../../types/reactFlow';
import type { UploadedImage } from '../../types';
import type { Mockup } from '../../services/mockupApi';
import type { ReactFlowInstance } from '../../types/reactflow-instance';
import type { MockupPresetType } from '../../types/mockupPresets';
import { generateNodeId } from '../../utils/canvas/canvasNodeUtils';
import { toast } from 'sonner';
import { useCanvasStrategyHandler } from './useCanvasStrategyHandler';
import { useCanvasChatHandler } from './useCanvasChatHandler';
import { canvasApi } from '../../services/canvasApi';

export const useCanvasNodeCreation = (
  reactFlowInstance: ReactFlowInstance | null,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  addToHistory: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void,
  handleView: (mockup: Mockup) => void,
  handleEdit: (mockup: Mockup) => void,
  handleDelete: (id: string) => Promise<void>,
  handlersRef: React.MutableRefObject<any>,
  subscriptionStatus: any,
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>,
  updateNodeData: <T extends FlowNodeData>(nodeId: string, newData: Partial<T>, nodeType?: string) => void,
  saveImmediately?: () => Promise<void>,
  canvasId?: string
) => {
  // ========== STRATEGY NODE HANDLERS ==========
  // Handlers para gerenciar operações de node de estratégia
  // Utiliza hook separado useCanvasStrategyHandler

  const {
    handleStrategyNodeGenerate,
    handleStrategyNodeDataUpdate,
    handleStrategyNodeGenerateSection,
    handleStrategyNodeGenerateAll,
    handleStrategyNodeInitialAnalysis,
    handleStrategyNodeCancelGeneration,
    handleStrategyNodeGeneratePDF,
    handleStrategyNodeSave,
  } = useCanvasStrategyHandler({
    nodesRef,
    updateNodeData,
    saveImmediately,
  });

  // ========== REFS FOR NODE CREATORS ==========
  // Refs to hold node creation functions (defined later in hook)
  const nodeCreatorsRef = useRef<{
    addPromptNode?: (pos?: { x: number; y: number }, data?: any) => string | undefined;
    addMockupNode?: (pos?: { x: number; y: number }) => string | undefined;
    addStrategyNode?: (pos?: { x: number; y: number }) => string | undefined;
    addTextNode?: (pos?: { x: number; y: number }, text?: string) => string | undefined;
    addMergeNode?: (pos?: { x: number; y: number }) => string | undefined;
    addEditNode?: (pos?: { x: number; y: number }) => string | undefined;
    addImageNode?: (pos?: { x: number; y: number }) => string | undefined;
  }>({});
  
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // ========== CHAT NODE HANDLERS ==========
  // Handlers para gerenciar operações de node de chat
  // Utiliza hook separado useCanvasChatHandler

  const {
    handleChatSendMessage,
    handleChatUpdateData,
    handleChatClearHistory,
    handleChatAddPromptNode,
    handleChatCreateNode,
    handleChatEditConnectedNode,
    getConnectedNodeIds,
    handleChatAttachMedia,
  } = useCanvasChatHandler({
    nodesRef,
    edgesRef,
    updateNodeData,
    userId: undefined, // Optional: userId can be passed for user-specific features
    saveImmediately,
    nodeCreators: nodeCreatorsRef.current,
    setEdges: undefined, // Will be passed from CanvasPage if needed
    addPromptNode: (pos, data) => nodeCreatorsRef.current.addPromptNode?.(pos, data),
  });

  // Atualiza handlersRef com os Strategy handlers
  useEffect(() => {
    handlersRef.current = {
      ...handlersRef.current,
      handleStrategyNodeGenerate,
      handleStrategyNodeDataUpdate,
      handleStrategyNodeGenerateSection,
      handleStrategyNodeGenerateAll,
      handleStrategyNodeInitialAnalysis,
      handleStrategyNodeCancelGeneration,
      handleStrategyNodeGeneratePDF,
      handleStrategyNodeSave,
    };
  }, [
    handleStrategyNodeGenerate,
    handleStrategyNodeDataUpdate,
    handleStrategyNodeGenerateSection,
    handleStrategyNodeGenerateAll,
    handleStrategyNodeInitialAnalysis,
    handleStrategyNodeCancelGeneration,
    handleStrategyNodeGeneratePDF,
    handleStrategyNodeSave,
  ]);

  // Atualiza handlersRef com os Chat handlers
  useEffect(() => {
    handlersRef.current = {
      ...handlersRef.current,
      handleChatSendMessage,
      handleChatUpdateData,
      handleChatClearHistory,
      handleChatAddPromptNode,
      handleChatCreateNode,
      handleChatEditConnectedNode,
      getConnectedNodeIds,
      handleChatAttachMedia,
    };
  }, [
    handleChatSendMessage,
    handleChatUpdateData,
    handleChatClearHistory,
    handleChatAddPromptNode,
    handleChatCreateNode,
    handleChatEditConnectedNode,
    getConnectedNodeIds,
    handleChatAttachMedia,
  ]);

  const addMergeNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('merge'),
      type: 'merge',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'merge',
        prompt: '',
        model: 'gemini-2.5-flash-image',
        connectedImages: [],
        onGenerate: handlersRef.current?.handleMergeGenerate || (() => Promise.resolve()),
        onGeneratePrompt: handlersRef.current?.handleMergeGeneratePrompt || (() => Promise.resolve()),
      } as MergeNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addPromptNode = useCallback((customPosition?: { x: number; y: number }, initialData?: Partial<PromptNodeData>): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('prompt'),
      type: 'prompt',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'prompt',
        prompt: initialData?.prompt || '',
        model: initialData?.model || 'gemini-2.5-flash-image',
        onGenerate: handlersRef.current?.handlePromptGenerate || (() => Promise.resolve()),
        onSuggestPrompts: handlersRef.current?.handlePromptSuggestPrompts || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handlePromptNodeDataUpdate || (() => {}),
      } as PromptNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addVideoNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('video'),
      type: 'video',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'video',
        prompt: '',
        model: 'veo-3.1-generate-preview',
        onGenerate: handlersRef.current?.handleVideoNodeGenerate || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleVideoNodeDataUpdate || (() => {}),
      } as VideoNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addBrandNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('brand'),
      type: 'brand',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'brand',
        onAnalyze: handlersRef.current?.handleBrandAnalyze || (() => Promise.resolve()),
        onUploadLogo: handlersRef.current?.handleBrandLogoUpload || (() => {}),
        onUploadPdf: handlersRef.current?.handleBrandPdfUpload || (() => {}),
        onUpdateData: handlersRef.current?.handleBrandNodeDataUpdate || (() => {}),
      } as BrandNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addEditNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('edit'),
      type: 'edit',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'edit',
        model: 'gemini-2.5-flash-image',
        resolution: '1K',
        aspectRatio: '16:9',
        onApply: handlersRef.current?.handleEditApply || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleEditNodeDataUpdate || (() => {}),
        onGenerateSmartPrompt: handlersRef.current?.handleEditNodeGenerateSmartPrompt || (() => Promise.resolve()),
        onSuggestPrompts: handlersRef.current?.handleEditNodeSuggestPrompts || (() => Promise.resolve()),
        subscriptionStatus: subscriptionStatus,
      } as EditNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef, subscriptionStatus]);

  const addUpscaleNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('upscale'),
      type: 'upscale',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'upscale',
        targetResolution: '4K',
        onUpscale: handlersRef.current?.handleUpscale || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleUpscaleNodeDataUpdate || (() => {}),
      } as UpscaleNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addMockupNode = useCallback((customPosition?: { x: number; y: number }, isFlowPosition?: boolean): string | undefined => {
    if (!reactFlowInstance) return;

    let position;
    
    if (customPosition && isFlowPosition) {
      // Use flow coordinates directly
      position = customPosition;
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } else {
      // Convert screen coordinates to flow coordinates
      const screenPos = customPosition || {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      
      try {
        position = reactFlowInstance.screenToFlowPosition(screenPos);
        // Validate position
        if (!position || isNaN(position.x) || isNaN(position.y)) {
          position = { x: 0, y: 0 };
        }
      } catch (error) {
        console.error('Error converting screen position to flow position:', error);
        position = { x: 0, y: 0 };
      }
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('mockup'),
      type: 'mockup',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'mockup',
        selectedPreset: 'cap', // Default to first preset
        onGenerate: handlersRef.current?.handleMockupGenerate || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleMockupNodeDataUpdate || (() => {}),
        onAddMockupNode: () => {
          // This will be set by CanvasPage when node is updated
        },
      } as MockupNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addAngleNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('angle'),
      type: 'angle',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'angle',
        selectedAngle: 'eye-level', // Default to first angle
        onGenerate: handlersRef.current?.handleAngleGenerate || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleAngleNodeDataUpdate || (() => {}),
      } as AngleNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addTextureNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('texture'),
      type: 'texture',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'texture',
        selectedPreset: 'wood-grain', // Default to first texture
        onGenerate: handlersRef.current?.handleTextureGenerate || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleTextureNodeDataUpdate || (() => {}),
      } as TextureNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addAmbienceNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('ambience'),
      type: 'ambience',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'ambience',
        selectedPreset: 'studio', // Default to first ambience
        onGenerate: handlersRef.current?.handleAmbienceGenerate || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleAmbienceNodeDataUpdate || (() => {}),
      } as AmbienceNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addLuminanceNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('luminance'),
      type: 'luminance',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'luminance',
        selectedPreset: 'natural-light', // Default to first luminance
        onGenerate: handlersRef.current?.handleLuminanceGenerate || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleLuminanceNodeDataUpdate || (() => {}),
      } as LuminanceNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addShaderNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('shader'),
      type: 'shader',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'shader',
        onApply: handlersRef.current?.handleShaderApply || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleShaderNodeDataUpdate || (() => {}),
      } as ShaderNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addUpscaleBicubicNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);
    
    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('upscaleBicubic'),
      type: 'upscaleBicubic',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'upscaleBicubic',
        scaleFactor: 2.0,
        onApply: handlersRef.current?.handleUpscaleBicubicApply || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleUpscaleBicubicNodeDataUpdate || (() => {}),
      } as UpscaleBicubicNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addImageNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return undefined;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const tempMockup: Mockup = {
      _id: `temp-${Date.now()}`,
      imageBase64: '',
      prompt: 'Empty image node',
      designType: 'blank',
      tags: [],
      brandingTags: [],
      aspectRatio: '16:9',
    };

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('image'),
      type: 'image',
      position,
      style: { width: 150, height: 100 },
      data: {
        type: 'image',
        mockup: tempMockup,
        onView: handleView,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onUpload: handlersRef.current.handleUploadImage,
        onResize: handlersRef.current.handleImageNodeResize,
      } as ImageNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    toast.success('Image node added! Upload an image to fill it.', { duration: 3000 });
    return newNode.id;
  }, [reactFlowInstance, handleView, handleEdit, handleDelete, nodes, edges, addToHistory, setNodes, handlersRef]);

  const handlePasteImage = useCallback(async (image: UploadedImage) => {
    if (!reactFlowInstance) {
      toast.error('Canvas não está pronto. Por favor, aguarde um momento e tente novamente.');
      return;
    }
    
    // Validate image data
    if (!image.file && !image.base64) {
      toast.error('Nenhuma imagem encontrada. Por favor, tente colar novamente.');
      return;
    }

    const selectedImageNodes = nodes.filter(n => n.selected && n.type === 'image');
    
    // If File is available, use direct upload to R2 (bypasses 4.5MB JSON limit)
    if (image.file && canvasId) {
      try {
        // Show loading toast for large images
        const fileSizeMB = image.file.size / 1024 / 1024;
        const loadingToast = fileSizeMB > 2 
          ? toast.loading('Fazendo upload...', { duration: Infinity })
          : null;

        // Validate file size before processing (very large files may cause issues)
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB absolute limit
        if (image.file.size > MAX_FILE_SIZE) {
          if (loadingToast) toast.dismiss(loadingToast);
          toast.error(`Imagem muito grande (${(image.file.size / 1024 / 1024).toFixed(2)}MB). O tamanho máximo é ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB.`, { duration: 5000 });
          return;
        }

        if (selectedImageNodes.length > 0) {
          // Upload to existing nodes
          let successCount = 0;
          let errorCount = 0;
          
          for (const node of selectedImageNodes) {
            try {
              // Verify node still exists before uploading
              const currentNode = nodes.find(n => n.id === node.id && n.type === 'image');
              if (!currentNode) {
                console.warn(`Node ${node.id} no longer exists, skipping upload`);
                errorCount++;
                continue;
              }
              
              const imageUrl = await canvasApi.uploadImageToR2Direct(image.file, canvasId, node.id);
              
              // Verify node still exists before updating (may have been deleted during upload)
              setNodes((nds: Node<FlowNodeData>[]) => {
                const nodeExists = nds.some(n => n.id === node.id && n.type === 'image');
                if (!nodeExists) {
                  console.warn(`Node ${node.id} was deleted during upload`);
                  return nds;
                }
                
                return nds.map((n: Node<FlowNodeData>) => {
                  if (n.id === node.id && n.type === 'image') {
                    const data = n.data as ImageNodeData;
                    const updatedMockup: Mockup = {
                      ...data.mockup,
                      imageUrl,
                      imageBase64: undefined, // Remove base64 after successful upload
                      prompt: 'Pasted image',
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
              successCount++;
            } catch (error: any) {
              errorCount++;
              console.error(`Failed to upload image to node ${node.id}:`, error);
              // Try fallback to base64 for this specific node
              try {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const result = event.target?.result as string;
                  if (result) {
                    const base64 = result.includes(',') ? result.split(',')[1] : result;
                    setNodes((nds: Node<FlowNodeData>[]) => {
                      return nds.map((n: Node<FlowNodeData>) => {
                        if (n.id === node.id && n.type === 'image') {
                          const data = n.data as ImageNodeData;
                          const updatedMockup: Mockup = {
                            ...data.mockup,
                            imageBase64: base64,
                            prompt: 'Pasted image',
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
                  }
                };
                reader.readAsDataURL(image.file);
              } catch (fallbackError) {
                console.error(`Fallback to base64 also failed for node ${node.id}:`, fallbackError);
              }
            }
          }
          
          if (loadingToast) toast.dismiss(loadingToast);
          
          if (errorCount > 0 && successCount === 0) {
            toast.error(`Falha ao fazer upload da imagem para ${errorCount} node(s). Usando método alternativo.`, { duration: 4000 });
          } else if (errorCount > 0) {
            toast.warning(`Imagem colada em ${successCount} node(s), mas falhou em ${errorCount} node(s).`, { duration: 4000 });
          } else {
            toast.success(`Imagem colada em ${successCount} node${successCount > 1 ? 's' : ''}!`, { duration: 2000 });
          }
          return;
        }

        // Create new node and upload directly
        let position;
        try {
          position = reactFlowInstance.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
          if (!position || isNaN(position.x) || isNaN(position.y)) {
            position = { x: 0, y: 0 };
          }
        } catch (error) {
          console.error('Error converting screen position to flow position:', error);
          position = { x: 0, y: 0 };
        }

        const newNodeId = generateNodeId('image');
        const tempMockup: Mockup = {
          _id: `temp-${Date.now()}`,
          prompt: 'Pasted image',
          designType: 'blank',
          tags: [],
          brandingTags: [],
          aspectRatio: '16:9',
        };

        const newNode: Node<FlowNodeData> = {
          id: newNodeId,
          type: 'image',
          position,
          style: { width: 150, height: 100 },
          data: {
            type: 'image',
            mockup: tempMockup,
            onView: handleView,
            onEdit: handleEdit,
            onDelete: handleDelete,
            onUpload: handlersRef.current.handleUploadImage,
            onResize: handlersRef.current.handleImageNodeResize,
          } as ImageNodeData,
        };

        addToHistory(nodes, edges);
        setNodes((nds: Node<FlowNodeData>[]) => {
          const newNodes = [...nds, newNode];
          setTimeout(() => {
            addToHistory(newNodes, edges);
          }, 0);
          return newNodes;
        });

        // Upload directly to R2
        try {
          const imageUrl = await canvasApi.uploadImageToR2Direct(image.file, canvasId, newNodeId);
          
          // Verify node still exists before updating (may have been deleted during upload)
          setNodes((nds: Node<FlowNodeData>[]) => {
            const nodeExists = nds.some(n => n.id === newNodeId && n.type === 'image');
            if (!nodeExists) {
              console.warn(`Node ${newNodeId} was deleted during upload`);
              return nds;
            }
            
            return nds.map((n: Node<FlowNodeData>) => {
              if (n.id === newNodeId && n.type === 'image') {
                const data = n.data as ImageNodeData;
                const updatedMockup: Mockup = {
                  ...data.mockup,
                  imageUrl,
                  imageBase64: undefined, // Remove base64 after successful upload
                  prompt: 'Pasted image',
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
          
          if (loadingToast) toast.dismiss(loadingToast);
          toast.success('Imagem colada!', { duration: 2000 });
        } catch (error: any) {
          console.error('Failed to upload pasted image to R2:', error);
          if (loadingToast) toast.dismiss(loadingToast);
          
          // Show user-friendly error message
          const errorMessage = error?.message?.includes('Failed to get upload URL') 
            ? 'Falha ao conectar com o servidor. Usando método alternativo.'
            : error?.message?.includes('Failed to upload to R2')
            ? 'Falha ao fazer upload. Usando método alternativo.'
            : 'Falha ao fazer upload. Usando método alternativo.';
          
          toast.warning(errorMessage, { duration: 3000 });
          
          // Fallback to base64 if direct upload fails
          try {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result as string;
              if (result) {
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                setNodes((nds: Node<FlowNodeData>[]) => {
                  return nds.map((n: Node<FlowNodeData>) => {
                    if (n.id === newNodeId && n.type === 'image') {
                      const data = n.data as ImageNodeData;
                      const updatedMockup: Mockup = {
                        ...data.mockup,
                        imageBase64: base64,
                        prompt: 'Pasted image',
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
                toast.success('Imagem colada (método alternativo)!', { duration: 2000 });
              }
            };
            reader.onerror = () => {
              toast.error('Falha ao processar imagem. Por favor, tente novamente.', { duration: 4000 });
            };
            reader.readAsDataURL(image.file);
          } catch (fallbackError) {
            console.error('Fallback to base64 also failed:', fallbackError);
            toast.error('Falha ao processar imagem. Por favor, tente novamente.', { duration: 4000 });
          }
        }
        return;
      } catch (error: any) {
        console.error('Error processing pasted image with direct upload:', error);
        const errorMessage = error?.message || 'Erro desconhecido ao processar imagem';
        toast.error(`Erro: ${errorMessage}. Tentando método alternativo...`, { duration: 3000 });
        // Fall through to base64 method below
      }
    }

    // Fallback to base64 method (for compatibility or when File is not available)
    // This happens when: File is not available, canvasId is missing, or direct upload failed
    if (!canvasId) {
      toast.warning('Projeto não salvo. Salve o projeto para fazer upload direto de imagens grandes.', { duration: 4000 });
    }
    
    let processedBase64 = image.base64;
    if (!processedBase64) {
      toast.error('Falha ao processar imagem colada. Por favor, tente novamente.');
      return;
    }
    
    if (selectedImageNodes.length > 0) {
      selectedImageNodes.forEach(node => {
        handlersRef.current.handleUploadImage(node.id, processedBase64);
      });
      toast.success(`Image pasted into ${selectedImageNodes.length} node${selectedImageNodes.length > 1 ? 's' : ''}!`, { duration: 2000 });
      return;
    }

    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      // Validate position
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    const tempMockup: Mockup = {
      _id: `temp-${Date.now()}`,
      imageBase64: processedBase64,
      prompt: 'Pasted image',
      designType: 'blank',
      tags: [],
      brandingTags: [],
      aspectRatio: '16:9',
    };

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('image'),
      type: 'image',
      position,
      style: { width: 150, height: 100 },
      data: {
        type: 'image',
        mockup: tempMockup,
        onView: handleView,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onUpload: handlersRef.current.handleUploadImage,
        onResize: handlersRef.current.handleImageNodeResize,
      } as ImageNodeData,
    };

    addToHistory(nodes, edges);
    
    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    // Automatically upload to Cloudflare R2 in background
    // Use setTimeout to ensure node is added to state before upload
    setTimeout(() => {
      if (handlersRef.current?.handleUploadImage) {
        handlersRef.current.handleUploadImage(newNode.id, processedBase64);
      }
    }, 100);
    
    toast.success('Image pasted!', { duration: 2000 });
  }, [reactFlowInstance, handleView, handleEdit, handleDelete, nodes, edges, addToHistory, setNodes, handlersRef, canvasId]);

  const addOutputNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) return;

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('output'),
      type: 'output',
      position,
      style: { width: 150, height: 100 },
      data: {
        type: 'output',
        onView: (imageUrl: string) => {
          // Open in fullscreen viewer
          window.open(imageUrl, '_blank');
        },
      } as OutputNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addBrandKitNodes = useCallback((customPosition?: { x: number; y: number }): string[] => {
    if (!reactFlowInstance) return [];

    // 5 presets diferentes para o brand kit
    const brandKitPresets: MockupPresetType[] = ['cap', 'tshirt', 'business-card', 'mug', 'bag'];

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let basePosition;
    try {
      basePosition = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!basePosition || isNaN(basePosition.x) || isNaN(basePosition.y)) {
        basePosition = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      basePosition = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNodes: Node<FlowNodeData>[] = brandKitPresets.map((preset, index) => {
      // Organizar em coluna única: todos empilhados verticalmente
      const offsetY = index * 250; // Espaçamento vertical entre node

      return {
        id: generateNodeId('mockup'),
        type: 'mockup',
        position: {
          x: basePosition.x,
          y: basePosition.y + offsetY,
        },
        draggable: true,
        connectable: true,
        selectable: true,
        data: {
          type: 'mockup',
          selectedPreset: preset,
          onGenerate: handlersRef.current?.handleMockupGenerate || (() => Promise.resolve()),
          onUpdateData: handlersRef.current?.handleMockupNodeDataUpdate || (() => {}),
          onAddMockupNode: () => {
            // This will be set by CanvasPage when node is updated
          },
        } as MockupNodeData,
      };
    });

    const newNodeIds = newNodes.map(node => node.id);

    setNodes((nds: Node<FlowNodeData>[]) => {
      const updatedNodes = [...nds, ...newNodes];
      setTimeout(() => {
        addToHistory(updatedNodes, edges);
      }, 0);
      return updatedNodes;
    });

    toast.success('Brand Kit created with 5 mockup presets', { duration: 2000 });
    
    return newNodeIds;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addLogoNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('logo'),
      type: 'logo',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'logo',
        onUploadLogo: handlersRef.current?.handleLogoNodeUpload || (() => {}),
        onUpdateData: handlersRef.current?.handleLogoNodeDataUpdate || (() => {}),
      },
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addColorExtractorNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('colorExtractor'),
      type: 'colorExtractor',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'colorExtractor',
        extractedColors: [],
        onExtract: handlersRef.current?.handleColorExtractorExtract || (() => Promise.resolve()),
        onUpload: handlersRef.current?.handleColorExtractorUpload || (() => {}),
        onUpdateData: handlersRef.current?.handleColorExtractorNodeDataUpdate || (() => {}),
      },
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addPDFNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('pdf'),
      type: 'pdf',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'pdf',
        onUploadPdf: handlersRef.current?.handlePDFNodeUpload || (() => {}),
        onUpdateData: handlersRef.current?.handlePDFNodeDataUpdate || (() => {}),
      },
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addStrategyNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('strategy'),
      type: 'strategy',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'strategy',
        strategyType: 'all',
        onGenerate: handlersRef.current?.handleStrategyNodeGenerate || (() => Promise.resolve()),
        onGenerateSection: handlersRef.current?.handleStrategyNodeGenerateSection || (() => Promise.resolve()),
        onGenerateAll: handlersRef.current?.handleStrategyNodeGenerateAll || (() => Promise.resolve()),
        onInitialAnalysis: handlersRef.current?.handleStrategyNodeInitialAnalysis || (() => Promise.resolve()),
        onCancelGeneration: handlersRef.current?.handleStrategyNodeCancelGeneration || (() => {}),
        onGeneratePDF: handlersRef.current?.handleStrategyNodeGeneratePDF || (() => {}),
        onSave: handlersRef.current?.handleStrategyNodeSave || (() => Promise.resolve(undefined)),
        onUpdateData: handlersRef.current?.handleStrategyNodeDataUpdate || (() => {}),
      },
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addBrandCoreNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('brandCore'),
      type: 'brandCore',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'brandCore',
        onAnalyze: handlersRef.current?.handleBrandCoreAnalyze || (() => Promise.resolve()),
        onCancelAnalyze: handlersRef.current?.handleBrandCoreCancelAnalyze || (() => {}),
        onGenerateVisualPrompts: handlersRef.current?.handleBrandCoreGenerateVisualPrompts || (() => Promise.resolve()),
        onGenerateStrategicPrompts: handlersRef.current?.handleBrandCoreGenerateStrategicPrompts || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleBrandCoreDataUpdate || (() => {}),
        onUploadPdfToR2: handlersRef.current?.handleBrandCoreUploadPdfToR2 || (() => Promise.resolve('')),
      },
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addVideoInputNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('videoInput'),
      type: 'videoInput',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'videoInput',
        onUploadVideo: handlersRef.current?.handleVideoInputNodeUpload || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleVideoInputNodeDataUpdate || (() => {}),
      } as any,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addTextNode = useCallback((customPosition?: { x: number; y: number }, initialText?: string, isFlowPosition?: boolean): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    let position;
    if (customPosition && isFlowPosition) {
      // If customPosition is already in flow coordinates, validate and use it directly
      if (customPosition.x !== undefined && customPosition.y !== undefined && 
          !isNaN(customPosition.x) && !isNaN(customPosition.y)) {
        position = { x: customPosition.x, y: customPosition.y };
      } else {
        console.warn('Invalid flow position provided, using default position');
        position = { x: 0, y: 0 };
      }
    } else {
      // Otherwise, treat as screen coordinates and convert
      const screenPos = customPosition || {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      
      try {
        position = reactFlowInstance.screenToFlowPosition(screenPos);
        // Validate position
        if (!position || isNaN(position.x) || isNaN(position.y)) {
          position = { x: 0, y: 0 };
        }
      } catch (error) {
        console.error('Error converting screen position to flow position:', error);
        position = { x: 0, y: 0 };
      }
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('text'),
      type: 'text',
      position,
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'text',
        text: initialText || '',
        onUpdateData: handlersRef.current?.handleTextNodeDataUpdate || (() => {}),
      } as TextNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  const addChatNode = useCallback((customPosition?: { x: number; y: number }): string | undefined => {
    if (!reactFlowInstance) {
      toast.error('Canvas not ready. Please wait a moment and try again.');
      return;
    }

    const screenPos = customPosition || {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    let position;
    try {
      position = reactFlowInstance.screenToFlowPosition(screenPos);
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    addToHistory(nodes, edges);

    const newNode: Node<FlowNodeData> = {
      id: generateNodeId('chat'),
      type: 'chat',
      position,
      style: { width: 500, height: 800 },
      draggable: true,
      connectable: true,
      selectable: true,
      data: {
        type: 'chat',
        messages: [],
        userMessageCount: 0,
        model: 'gemini-2.5-flash',
        isLoading: false,
        onSendMessage: handlersRef.current?.handleChatSendMessage || (() => Promise.resolve()),
        onUpdateData: handlersRef.current?.handleChatUpdateData || (() => {}),
        onClearHistory: handlersRef.current?.handleChatClearHistory || (() => {}),
        onAddPromptNode: handlersRef.current?.handleChatAddPromptNode || (() => {}),
        onCreateNode: handlersRef.current?.handleChatCreateNode || (() => undefined),
        onEditConnectedNode: handlersRef.current?.handleChatEditConnectedNode || (() => {}),
        onAttachMedia: handlersRef.current?.handleChatAttachMedia || (() => undefined),
        connectedNodeIds: [],
      } as ChatNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });
    
    return newNode.id;
  }, [reactFlowInstance, nodes, edges, addToHistory, setNodes, handlersRef]);

  // ========== UPDATE NODE CREATORS REF ==========
  // Keep nodeCreatorsRef updated with the latest node creation functions
  useEffect(() => {
    nodeCreatorsRef.current = {
      addPromptNode,
      addMockupNode,
      addStrategyNode,
      addTextNode,
      addMergeNode,
      addEditNode,
      addImageNode,
    };
  }, [addPromptNode, addMockupNode, addStrategyNode, addTextNode, addMergeNode, addEditNode, addImageNode]);

  return {
    addMergeNode,
    addPromptNode,
    addVideoNode,
    addBrandNode,
    addEditNode,
    addUpscaleNode,
    addMockupNode,
    addAngleNode,
    addTextureNode,
    addAmbienceNode,
    addLuminanceNode,
    addShaderNode,
    addUpscaleBicubicNode,
    addImageNode,
    addOutputNode,
    handlePasteImage,
    addBrandKitNodes,
    addLogoNode,
    addPDFNode,
    addVideoInputNode,
    addStrategyNode,
    addBrandCoreNode,
    addColorExtractorNode,
    addTextNode,
    addChatNode,
  };
};



