import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react';
import { useLayout } from '../hooks/useLayout';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { getImageUrl } from '../utils/imageUtils';
import { ImageNode } from '../components/reactflow/ImageNode';
import { MergeNode } from '../components/reactflow/MergeNode';
import { EditNode } from '../components/reactflow/EditNode';
import { UpscaleNode } from '../components/reactflow/UpscaleNode';
import { UpscaleBicubicNode } from '../components/reactflow/UpscaleBicubicNode';
import { MockupNode } from '../components/reactflow/MockupNode';
import { AngleNode } from '../components/reactflow/AngleNode';
import { TextureNode } from '../components/reactflow/TextureNode';
import { AmbienceNode } from '../components/reactflow/AmbienceNode';
import { LuminanceNode } from '../components/reactflow/LuminanceNode';
import { ShaderNode } from '../components/reactflow/ShaderNode';
import { PromptNode } from '../components/reactflow/PromptNode';
import { OutputNode } from '../components/reactflow/OutputNode';
import { BrandNode } from '../components/reactflow/BrandNode';
import { LogoNode } from '../components/reactflow/LogoNode';
import { PDFNode } from '../components/reactflow/PDFNode';
import { StrategyNode } from '../components/reactflow/StrategyNode';
import { BrandCore } from '../components/reactflow/BrandCore';
import { VideoNode } from '../components/reactflow/VideoNode';
import { VideoInputNode } from '../components/reactflow/VideoInputNode';
import { ColorExtractorNode } from '../components/reactflow/ColorExtractorNode';
import { TextNode } from '../components/reactflow/TextNode';
import { ChatNode } from '../components/reactflow/ChatNode';
import { BrandingProjectSelectModal } from '../components/reactflow/BrandingProjectSelectModal';
import { ContextMenu } from '../components/reactflow/ContextMenu';
import { EdgeContextMenu } from '../components/reactflow/EdgeContextMenu';
import { ImageContextMenu } from '../components/reactflow/ImageContextMenu';
import { NodeContextMenu } from '../components/reactflow/NodeContextMenu';
import { usePasteImage } from '../hooks/usePasteImage';
import type { FlowNodeData, ImageNodeData, MergeNodeData, EditNodeData, UpscaleNodeData, UpscaleBicubicNodeData, PromptNodeData, OutputNodeData, BrandNodeData, MockupNodeData, LogoNodeData, PDFNodeData, StrategyNodeData, BrandCoreData, VideoNodeData, VideoInputNodeData, AngleNodeData, TextureNodeData, AmbienceNodeData, LuminanceNodeData, ShaderNodeData, ColorExtractorNodeData, TextNodeData, ChatNodeData } from '../types/reactFlow';
import type { Mockup } from '../services/mockupApi';
import { mockupApi } from '../services/mockupApi';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { ImageFullscreenModal } from '../components/reactflow/shared/ImageFullscreenModal';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useCanvasHistory } from '../hooks/canvas/useCanvasHistory';
import { useCanvasProject } from '../hooks/canvas/useCanvasProject';
import { useCanvasNodeHandlers } from '../hooks/canvas/useCanvasNodeHandlers';
import { useCanvasNodeCreation } from '../hooks/canvas/useCanvasNodeCreation';
import { useCanvasEvents } from '../hooks/canvas/useCanvasEvents';
import { useCanvasKeyboard } from '../hooks/canvas/useCanvasKeyboard';
import { CanvasToolbar } from '../components/canvas/CanvasToolbar';
import { CanvasHeader } from '../components/canvas/CanvasHeader';
import { CanvasFlow } from '../components/canvas/CanvasFlow';
import { ShaderControlsSidebar } from '../components/canvas/ShaderControlsSidebar';
import { ShareModal } from '../components/canvas/ShareModal';
import { cleanEdgeHandles, mockupArraysEqual, arraysEqual, getConnectedBrandIdentity, generateNodeId, getImageFromSourceNode, syncConnectedImage, getMediaFromNodeForCopy } from '../utils/canvas/canvasNodeUtils';
import { SEO } from '../components/SEO';
import { ExportPanel } from '../components/ui/ExportPanel';
import { toast } from 'sonner';
import type { ReactFlowInstance } from '../types/reactflow-instance';
import { canvasApi } from '../services/canvasApi';
import { RoomProvider } from '../config/liveblocks';
import { LiveList } from '@liveblocks/client';
import { useCanvasCollaboration } from '../hooks/canvas/useCanvasCollaboration';
import { authService } from '../services/authService';
import { CollaborativeCursors } from '../components/canvas/CollaborativeCursors';
import { useTranslation } from '../hooks/useTranslation';
import { AuthModal } from '../components/AuthModal';
import { useImageNodeHandlers } from '../hooks/canvas/useImageNodeHandlers';
import { useImmediateR2Upload } from '../hooks/canvas/useImmediateR2Upload';
import { collectR2UrlsForDeletion } from '../hooks/canvas/utils/r2UploadHelpers';
import type { UploadedImage } from '../types';

import { isLocalDevelopment } from '../utils/env';

// Node types
const nodeTypes = {
  image: ImageNode,
  merge: MergeNode,
  edit: EditNode,
  upscale: UpscaleNode,
  upscaleBicubic: UpscaleBicubicNode,
  mockup: MockupNode,
  angle: AngleNode,
  texture: TextureNode,
  ambience: AmbienceNode,
  luminance: LuminanceNode,
  shader: ShaderNode,
  prompt: PromptNode,
  output: OutputNode,
  brand: BrandNode,
  logo: LogoNode,
  pdf: PDFNode,
  strategy: StrategyNode,
  brandCore: BrandCore,
  video: VideoNode,
  videoInput: VideoInputNode,
  colorExtractor: ColorExtractorNode,
  text: TextNode,
  chat: ChatNode,
} as const;

export const CanvasPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, subscriptionStatus, setSubscriptionStatus } = useLayout();
  const { hasAccess, isLoading: isLoadingAccess } = usePremiumAccess();
  const { t } = useTranslation();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvasBackgroundColor') || 'var(--brand-bg)';
    }
    return 'var(--brand-bg)';
  });
  const [gridColor, setGridColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvasGridColor') || 'rgba(255, 255, 255, 0.1)';
    }
    return 'rgba(255, 255, 255, 0.1)';
  });
  const [showGrid, setShowGrid] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasShowGrid');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasShowMinimap');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showControls, setShowControls] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasShowControls');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [cursorColor, setCursorColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvasCursorColor') || '#FFFFFF';
    }
    return '#FFFFFF';
  });
  const [isShaderSidebarCollapsed, setIsShaderSidebarCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sourceNodeId?: string } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [imageContextMenu, setImageContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [userMockups, setUserMockups] = useState<Mockup[]>([]);
  const [exportPanel, setExportPanel] = useState<{ nodeId: string; nodeName: string; imageUrl: string | null; nodeType: string } | null>(null);
  const [imageFullscreenModal, setImageFullscreenModal] = useState<{
    imageUrl: string | null;
    imageBase64?: string | null;
    title?: string;
    sliders?: Array<{
      label: string;
      value: number;
      min: number;
      max: number;
      step?: number;
      onChange: (value: number) => void;
      formatValue?: (value: number) => string;
    }>;
  } | null>(null);

  const [experimentalMode, setExperimentalMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasExperimentalMode');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);

  // Persist settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasBackgroundColor', backgroundColor);
      localStorage.setItem('canvasGridColor', gridColor);
      localStorage.setItem('canvasShowGrid', String(showGrid));
      localStorage.setItem('canvasShowMinimap', String(showMinimap));
      localStorage.setItem('canvasShowControls', String(showControls));
      localStorage.setItem('canvasCursorColor', cursorColor);
      localStorage.setItem('canvasExperimentalMode', String(experimentalMode));
    }
  }, [backgroundColor, gridColor, showGrid, showMinimap, showControls, cursorColor, experimentalMode]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Hooks - initialize history first so it can be used in handlers
  const { addToHistory, handleUndo, handleRedo } = useCanvasHistory(
    nodes,
    edges,
    setNodes,
    setEdges
  );

  // Handler functions
  const handleView = useCallback((mockup: Mockup) => {
    setSelectedMockup(mockup);
  }, []);

  const handleViewOutput = useCallback((imageUrl: string) => {
    // Create a temporary mockup from imageUrl for OutputNode
    const tempMockup: Mockup = {
      _id: `temp-output-${Date.now()}`,
      imageUrl: imageUrl.startsWith('data:') ? undefined : imageUrl,
      imageBase64: imageUrl.startsWith('data:') ? imageUrl : undefined,
      prompt: t('canvas.outputImagePrompt'),
      designType: 'blank',
      tags: [],
      brandingTags: [],
      aspectRatio: '16:9',
    };
    setSelectedMockup(tempMockup);
  }, []);

  const handleEdit = useCallback((mockup: Mockup) => {
    const imageUrl = getImageUrl(mockup);
    if (imageUrl && mockup.imageBase64) {
      navigate(`/editor?image=${encodeURIComponent(mockup.imageBase64)}`);
    }
  }, [navigate]);

  const handleEditOutput = useCallback((imageUrl: string) => {
    // For OutputNode, we need to convert imageUrl to base64 or use it directly
    // If it's already a data URL, use it; otherwise navigate with URL
    if (imageUrl.startsWith('data:')) {
      navigate(`/editor?image=${encodeURIComponent(imageUrl)}`);
    } else {
      // For R2 URLs, we'll need to fetch and convert, but for now just navigate with URL
      navigate(`/editor?imageUrl=${encodeURIComponent(imageUrl)}`);
    }
  }, [navigate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!id || !isAuthenticated) {
      return;
    }

    // Add to history before deletion
    addToHistory(nodes, edges);

    try {
      await mockupApi.delete(id);

      setNodes((prev: Node<FlowNodeData>[]) => {
        const newNodes = prev.filter(n => {
          if (n.type === 'image') {
            return (n.data as ImageNodeData).mockup._id !== id;
          }
          return true;
        });

        // Add to history after deletion
        setTimeout(() => {
          addToHistory(newNodes, edges);
        }, 0);

        return newNodes;
      });
    } catch (err: any) {
      // Error handling is done by toast in the service, but ensure user sees feedback
      const errorMessage = err?.message || t('canvas.failedToDeleteMockup');
      toast.error(errorMessage, { duration: 5000 });
      if (isLocalDevelopment()) {
        console.error('Failed to delete mockup:', err);
      }
    }
  }, [isAuthenticated, setNodes, nodes, edges, addToHistory]);

  const handleCloseViewer = () => {
    setSelectedMockup(null);
  };

  const handleExport = useCallback(() => {
    if (!contextMenu?.sourceNodeId) return;

    const node = nodes.find(n => n.id === contextMenu.sourceNodeId);
    if (!node) return;

    let imageUrl: string | null = null;
    let nodeName = node.data.label || `${node.type}-${node.id.substring(0, 8)}`;

    // Get image URL based on node type
    if (node.type === 'image') {
      const imageData = node.data as ImageNodeData;
      imageUrl = getImageUrl(imageData.mockup) || null;
      nodeName = imageData.mockup.prompt || nodeName;
    } else if (node.type === 'merge' || node.type === 'edit' || node.type === 'upscale' || node.type === 'mockup' || node.type === 'angle' || node.type === 'prompt') {
      const nodeData = node.data as any;
      imageUrl = nodeData.resultImageUrl || (nodeData.resultImageBase64 ? `data:image/png;base64,${nodeData.resultImageBase64}` : null);
    } else if (node.type === 'output') {
      const outputData = node.data as OutputNodeData;
      imageUrl = outputData.resultImageUrl || (outputData.resultImageBase64 ? `data:image/png;base64,${outputData.resultImageBase64}` : null);
    } else if (node.type === 'brand') {
      const brandData = node.data as BrandNodeData;
      if (brandData.logoBase64) {
        imageUrl = brandData.logoBase64.startsWith('data:') ? brandData.logoBase64 : `data:image/png;base64,${brandData.logoBase64}`;
      } else {
        imageUrl = brandData.logoImage || null;
      }
    }

    if (!imageUrl) {
      toast.error(t('canvas.noImageAvailableToExport'), { duration: 3000 });
      return;
    }

    setExportPanel({
      nodeId: node.id,
      nodeName,
      imageUrl,
      nodeType: node.type || 'unknown',
    });
  }, [contextMenu, nodes]);

  const {
    isLoadingProject,
    projectName,
    setProjectName,
    showMigrationModal,
    handleMigrationSave,
    handleMigrationDiscard,
    projectId,
    saveImmediately,
    shareId,
    isCollaborative,
    canEdit,
    canView,
    setShareId,
    setIsCollaborative,
    setCanEdit,
    setCanView,
  } = useCanvasProject(
    isAuthenticated,
    nodes,
    edges,
    setNodes,
    setEdges
  );

  const [showShareModal, setShowShareModal] = useState(false);
  const [isAdminOrPremium, setIsAdminOrPremium] = useState(false);
  const [othersCount, setOthersCount] = useState(0);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalNodeId, setProjectModalNodeId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check if user is admin or premium
  useEffect(() => {
    const checkUserStatus = async () => {
      if (isAuthenticated) {
        try {
          const user = await authService.verifyToken();
          const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription || false;
          const isAdmin = user?.isAdmin || false;
          setIsAdminOrPremium(hasActiveSubscription || isAdmin);
        } catch (error) {
          setIsAdminOrPremium(false);
        }
      }
    };
    checkUserStatus();
  }, [isAuthenticated, subscriptionStatus]);

  // Show auth modal if user is not authenticated
  useEffect(() => {
    if (isAuthenticated === false) {
      setShowAuthModal(true);
    } else if (isAuthenticated === true) {
      setShowAuthModal(false);
    }
  }, [isAuthenticated]);

  // Collaboration hook (only used inside RoomProvider)
  const collaboration = isCollaborative && projectId ? {
    projectId,
    isCollaborative,
    nodes,
    edges,
    setNodes,
    setEdges,
    onSave: saveImmediately,
  } : null;

  const {
    handleMergeGenerate,
    handleMergeGeneratePrompt,
    handleEditApply,
    handleUpscale,
    handleMockupGenerate,
    handleMockupNodeDataUpdate,
    handleAngleGenerate,
    handleAngleNodeDataUpdate,
    handleUploadImage,
    handleEditNodeDataUpdate,
    handleEditNodeGenerateSmartPrompt,
    handleEditNodeSuggestPrompts,
    handleUpscaleNodeDataUpdate,
    handlePromptNodeDataUpdate,
    handleTextNodeDataUpdate,
    handlersRef,
    nodesRef,
    updateNodeData,
  } = useCanvasNodeHandlers(
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
    subscriptionStatus,
    setSubscriptionStatus,
    handleView,
    handleEdit,
    handleDelete,
    addToHistory,
    projectId,
    saveImmediately
  );

  // Upload imediato de base64 para R2
  useImmediateR2Upload({
    nodes,
    canvasId: projectId,
    isAuthenticated: isAuthenticated === true,
    setNodes,
    handlersRef,
  });

  const {
    addMergeNode,
    addPromptNode,
    addVideoNode,
    addBrandNode,
    addEditNode,
    addUpscaleNode,
    addUpscaleBicubicNode,
    addMockupNode,
    addAngleNode,
    addTextureNode,
    addAmbienceNode,
    addLuminanceNode,
    addShaderNode,
    addColorExtractorNode,
    addImageNode,
    addOutputNode,
    handlePasteImage,
    addBrandKitNodes,
    addLogoNode,
    addPDFNode,
    addVideoInputNode,
    addStrategyNode,
    addBrandCoreNode,
    addTextNode,
    addChatNode,
  } = useCanvasNodeCreation(
    reactFlowInstance,
    nodes,
    edges,
    setNodes,
    addToHistory,
    handleView,
    handleEdit,
    handleDelete,
    handlersRef,
    subscriptionStatus,
    nodesRef,
    updateNodeData,
    saveImmediately,
    projectId
  );

  const {
    onConnect,
    onConnectStart,
    onConnectEnd,
    onNodeDragStop: onNodeDragStopOriginal,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeClick,
    onEdgeContextMenu,
    handleRemoveEdge,
  } = useCanvasEvents(
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowWrapper,
    setContextMenu,
    setEdgeContextMenu,
    setImageContextMenu,
    setNodeContextMenu,
    addToHistory,
    reactFlowInstance
  );

  // Callback for when drag starts - set ref to prevent useEffect execution
  // Note: This will be overridden in CollaborativeCanvas for collaborative mode
  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  // Wrapper for onNodeDragStop - reset ref and call original handler
  const onNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
    onNodeDragStopOriginal();
  }, [onNodeDragStopOriginal]);

  // Duplicate multiple nodes
  const handleDuplicateNodes = useCallback((nodeIds: string[]) => {
    if (!reactFlowInstance || nodeIds.length === 0) return;

    const nodesToDuplicate = nodes.filter(n => nodeIds.includes(n.id));
    if (nodesToDuplicate.length === 0) return;

    addToHistory(nodes, edges);

    const duplicatedNodes: Node<FlowNodeData>[] = nodesToDuplicate.map((node, index) => {
      const newPosition = {
        x: node.position.x + 50 + (index * 10),
        y: node.position.y + 50 + (index * 10),
      };

      return {
        ...node,
        id: generateNodeId(node.type || 'node'),
        position: newPosition,
        selected: false,
        data: {
          ...node.data,
          // Reset loading states
          isLoading: false,
          isGenerating: false,
          isDescribing: false,
          isAnalyzing: false,
          isGeneratingPrompt: false,
          isSuggestingPrompts: false,
          // Clear result images for flow nodes
          resultImageBase64: undefined,
          resultImageUrl: undefined,
        } as FlowNodeData,
      };
    });

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, ...duplicatedNodes];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });

    toast.success(t('canvas.nodeDuplicated', {
      count: duplicatedNodes.length,
      plural: duplicatedNodes.length > 1 ? 's' : ''
    }), { duration: 2000 });
  }, [nodes, edges, reactFlowInstance, setNodes, addToHistory]);

  useCanvasKeyboard(
    nodes,
    edges,
    setNodes,
    setEdges,
    setContextMenu,
    handleUndo,
    handleRedo,
    addToHistory,
    handlersRef,
    reactFlowInstance,
    reactFlowWrapper,
    handleDuplicateNodes,
    addMockupNode,
    addPromptNode,
    addUpscaleNode
  );

  usePasteImage(handlePasteImage, isAuthenticated === true);

  // Handle drop of images onto canvas
  const handleDropImage = useCallback((image: UploadedImage, position: { x: number; y: number }) => {
    if (!reactFlowInstance) return;

    const tempMockup: Mockup = {
      _id: `temp-${Date.now()}`,
      imageBase64: image.base64,
      prompt: t('canvas.droppedImagePrompt'),
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
        onUpload: handlersRef.current?.handleUploadImage || (() => { }),
        onResize: handlersRef.current?.handleImageNodeResize || (() => { }),
        addTextNode: addTextNode,
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

    // Upload para R2 será feito automaticamente pelo hook useImmediateR2Upload
    toast.success(t('canvas.imageDropped'), { duration: 2000 });
  }, [reactFlowInstance, handleView, handleEdit, handleDelete, nodes, edges, addToHistory, setNodes, handlersRef, addTextNode, t]);

  // Handle drop of toolbar nodes onto canvas
  const handleDropNode = useCallback((nodeType: string, position: { x: number; y: number }) => {
    if (!reactFlowInstance) return;

    // Position is already in flow coordinates from CanvasFlow
    const flowPosition = position;

    // Helper to convert flow to screen coordinates
    const flowToScreen = (flowPos: { x: number; y: number }): { x: number; y: number } => {
      if (reactFlowInstance.flowToScreenPosition) {
        const screenPos = reactFlowInstance.flowToScreenPosition(flowPos);
        if (screenPos) return screenPos;
      }
      // Fallback: use viewport to calculate
      if (reactFlowInstance.getViewport) {
        const viewport = reactFlowInstance.getViewport();
        if (viewport) {
          // Approximate conversion: flowPos * zoom + viewport offset
          // This is a simplified calculation - actual ReactFlow might be more complex
          return {
            x: flowPos.x * viewport.zoom + viewport.x,
            y: flowPos.y * viewport.zoom + viewport.y,
          };
        }
      }
      // Ultimate fallback: return center of screen
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    };

    switch (nodeType) {
      case 'prompt':
        addPromptNode(flowToScreen(flowPosition));
        break;
      case 'mockup':
        // addMockupNode supports flow coordinates directly
        addMockupNode(flowPosition, true);
        break;
      case 'shader':
        addShaderNode(flowToScreen(flowPosition));
        break;
      case 'edit':
        addPromptNode(flowToScreen(flowPosition));
        break;
      case 'angle':
        addAngleNode(flowToScreen(flowPosition));
        break;
      case 'brandkit':
        addBrandKitNodes(flowToScreen(flowPosition));
        break;
      case 'logo':
        addLogoNode(flowToScreen(flowPosition));
        break;
      case 'pdf':
        addPDFNode(flowToScreen(flowPosition));
        break;
      case 'strategy':
        addStrategyNode(flowToScreen(flowPosition));
        break;
      case 'brandcore':
        addBrandCoreNode(flowToScreen(flowPosition));
        break;
      case 'text':
        addTextNode(flowPosition, undefined, true);
        break;
      case 'chat':
        addChatNode(flowToScreen(flowPosition));
        break;
      default:
        console.warn(`Unknown node type: ${nodeType}`);
    }
  }, [reactFlowInstance, addPromptNode, addMockupNode, addShaderNode, addAngleNode, addBrandKitNodes, addLogoNode, addPDFNode, addStrategyNode, addBrandCoreNode, addTextNode, addChatNode]);

  // Close context menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't close if clicking on a context menu or its children
      if (target.closest('[data-context-menu]')) {
        return;
      }

      // Close all context menus
      if (contextMenu || edgeContextMenu || imageContextMenu || nodeContextMenu) {
        setContextMenu(null);
        setEdgeContextMenu(null);
        setImageContextMenu(null);
        setNodeContextMenu(null);
      }
    };

    // Also close on Escape key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setEdgeContextMenu(null);
        setImageContextMenu(null);
        setNodeContextMenu(null);
      }
    };

    if (contextMenu || edgeContextMenu || imageContextMenu || nodeContextMenu) {
      // Use mousedown for immediate response, click may interfere with menu buttons
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu, edgeContextMenu, imageContextMenu, nodeContextMenu]);

  // Wrapper for onNodesChange - onNodeDragStop handles history for drag operations
  // This wrapper is kept simple to avoid duplicate history entries
  const handleNodesChange = useCallback((changes: any[]) => {
    // Apply changes immediately - history is handled by onNodeDragStop for drag operations
    onNodesChange(changes);
  }, [onNodesChange]);

  // Handler to update MergeNode data
  const handleMergeNodeDataUpdate = useCallback((nodeId: string, newData: Partial<MergeNodeData>) => {
    setNodes((nds: Node<FlowNodeData>[]) =>
      nds.map((n: Node<FlowNodeData>) =>
        n.id === nodeId && n.type === 'merge'
          ? {
            ...n,
            data: {
              ...(n.data as MergeNodeData),
              ...newData,
            } as MergeNodeData,
          } as Node<FlowNodeData>
          : n
      )
    );
  }, [setNodes]);

  // Handler to update ImageNode data
  const handleImageNodeDataUpdate = useCallback((nodeId: string, newData: Partial<ImageNodeData>) => {
    setNodes((nds: Node<FlowNodeData>[]) =>
      nds.map((n: Node<FlowNodeData>) =>
        n.id === nodeId && n.type === 'image'
          ? {
            ...n,
            data: {
              ...(n.data as ImageNodeData),
              ...newData,
            } as ImageNodeData,
          } as Node<FlowNodeData>
          : n
      )
    );
  }, [setNodes]);

  // Unified handlers for ImageNode and OutputNode
  const {
    handleDownload,
    handleExport: handleImageExport,
    handleFullscreen,
    handleCopy,
    handleCopyPNG,
    handleEditWithPrompt,
    handleDelete: handleImageNodeDelete,
    handleDuplicate,
    handleImageLike,
    handleImageDescribe,
    handleOutputLike,
  } = useImageNodeHandlers({
    imageContextMenu,
    nodes,
    edges,
    setNodes,
    setEdges,
    setExportPanel,
    reactFlowInstance,
    reactFlowWrapper,
    addToHistory,
    addPromptNode,
    onConnect,
    onNodesChange,
    isAuthenticated,
    handleImageNodeDataUpdate,
    handleView,
    handleEdit,
    onDeleteMockup: handleDelete,
    handlersRef,
    t,
  });

  // Handler for Brand Kit feature - creates MockupNodes and generates images
  const handleBrandKit = useCallback(async (nodeId: string, presetIds: string[]) => {
    if (isLocalDevelopment()) {
      console.log('[handleBrandKit] Called with:', { nodeId, presetIds });
    }

    if (!reactFlowInstance || presetIds.length === 0) {
      if (isLocalDevelopment()) {
        console.warn('[handleBrandKit] Missing reactFlowInstance or no presetIds');
      }
      return;
    }

    const sourceNode = nodes.find(n => n.id === nodeId);
    if (!sourceNode || (sourceNode.type !== 'image' && sourceNode.type !== 'output')) {
      if (isLocalDevelopment()) {
        console.error('[handleBrandKit] Source node not found or invalid type:', { nodeId, sourceNode });
      }
      toast.error(t('canvas.sourceNodeNotFound'), { duration: 3000 });
      return;
    }

    if (isLocalDevelopment()) {
      console.log('[handleBrandKit] Source node found:', { nodeId, position: sourceNode.position, type: sourceNode.type });
    }

    // Get image base64 from ImageNode or OutputNode
    let imageBase64: string | undefined;

    if (sourceNode.type === 'image') {
      const imageData = sourceNode.data as ImageNodeData;
      if (imageData.mockup?.imageBase64) {
        const base64 = imageData.mockup.imageBase64.trim();
        imageBase64 = base64.startsWith('data:') ? base64.split(',')[1] || base64 : base64;
      } else {
        // Try to get from URL
        const imageUrl = getImageUrl(imageData.mockup);
        if (imageUrl) {
          try {
            const { normalizeImageToBase64 } = await import('../services/reactFlowService');
            // Use base64 fallback if available (from mockup.imageBase64)
            const base64Fallback = imageData.mockup.imageBase64;
            imageBase64 = await normalizeImageToBase64(imageUrl, base64Fallback);
          } catch (error: any) {
            if (isLocalDevelopment()) {
              console.error('[handleBrandKit] Failed to load image from URL:', error);
            }
            toast.error(error?.message || t('canvas.failedToLoadImage'), { duration: 3000 });
            return;
          }
        }
      }
    } else if (sourceNode.type === 'output') {
      const outputData = sourceNode.data as OutputNodeData;
      // Get base64 from OutputNode
      if (outputData.resultImageBase64) {
        const base64 = outputData.resultImageBase64.trim();
        imageBase64 = base64.startsWith('data:') ? base64.split(',')[1] || base64 : base64;
      } else if (outputData.resultImageUrl) {
        // Try to get from URL
        try {
          const { normalizeImageToBase64 } = await import('../services/reactFlowService');
          imageBase64 = await normalizeImageToBase64(outputData.resultImageUrl, outputData.resultImageBase64);
        } catch (error: any) {
          if (isLocalDevelopment()) {
            console.error('[handleBrandKit] Failed to load image from URL:', error);
          }
          toast.error(error?.message || t('canvas.failedToLoadImage'), { duration: 3000 });
          return;
        }
      }
    }

    if (!imageBase64) {
      if (isLocalDevelopment()) {
        console.error('[handleBrandKit] No image data available');
      }
      toast.error(t('canvas.noImageDataAvailable'), { duration: 3000 });
      return;
    }

    if (isLocalDevelopment()) {
      console.log('[handleBrandKit] Image data loaded, length:', imageBase64.length);
    }

    // Prepare image as base64 string for generation
    const imageInput = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    // Create MockupNodes in a horizontal grid
    const mockupNodeIds: { id: string; presetId: string }[] = [];
    const gridOffsetX = 320; // Horizontal spacing between nodes
    const startX = sourceNode.position.x + gridOffsetX;
    const startY = sourceNode.position.y;

    if (isLocalDevelopment()) {
      console.log('[handleBrandKit] Starting node creation at:', { startX, startY, count: presetIds.length });
    }

    // Add to history before making changes
    addToHistory(nodes, edges);

    // Create nodes directly with flow coordinates - build all nodes first
    const newNodes: Node<FlowNodeData>[] = [];

    for (let i = 0; i < presetIds.length; i++) {
      const presetId = presetIds[i];
      const nodePosition = {
        x: startX + (i * gridOffsetX),
        y: startY,
      };

      if (isLocalDevelopment()) {
        console.log(`[handleBrandKit] Preparing node ${i + 1}/${presetIds.length} for preset:`, presetId, 'at position:', nodePosition);
      }

      // Create MockupNode directly with flow coordinates
      const newNodeId = generateNodeId('mockup');
      const newNode: Node<FlowNodeData> = {
        id: newNodeId,
        type: 'mockup',
        position: nodePosition,
        draggable: true,
        connectable: true,
        selectable: true,
        data: {
          type: 'mockup',
          selectedPreset: presetId,
          userMockups: userMockups,
          onGenerate: handlersRef.current?.handleMockupGenerate || (() => Promise.resolve()),
          onUpdateData: handlersRef.current?.handleMockupNodeDataUpdate || (() => { }),
          onAddMockupNode: () => {
            // This will be set by CanvasPage when node is updated
          },
        } as MockupNodeData,
      };

      mockupNodeIds.push({ id: newNodeId, presetId });
      newNodes.push(newNode);
    }

    // Add all nodes at once
    setNodes((nds: Node<FlowNodeData>[]) => {
      if (isLocalDevelopment()) {
        console.log(`[handleBrandKit] Adding ${newNodes.length} nodes to canvas`);
      }
      return [...nds, ...newNodes];
    });

    // Create edges after nodes are added
    setTimeout(() => {
      for (const { id: mockupNodeId } of mockupNodeIds) {
        if (isLocalDevelopment()) {
          console.log(`[handleBrandKit] Creating edge from ${nodeId} to ${mockupNodeId}`);
        }
        onConnect({
          source: nodeId,
          target: mockupNodeId,
          sourceHandle: null,
          targetHandle: null,
        } as any);
      }
    }, 200);

    if (isLocalDevelopment()) {
      console.log('[handleBrandKit] Created nodes:', mockupNodeIds.map(m => m.id));
    }

    // Wait for edges to be created and nodes to be updated, then trigger generation
    setTimeout(async () => {
      if (isLocalDevelopment()) {
        console.log('[handleBrandKit] Starting generation for', mockupNodeIds.length, 'nodes');
      }

      // Use functional update to get latest nodes state
      setNodes((currentNodes: Node<FlowNodeData>[]) => {
        for (const { id: mockupNodeId, presetId } of mockupNodeIds) {
          const mockupNode = currentNodes.find(n => n.id === mockupNodeId);

          if (mockupNode && mockupNode.type === 'mockup' && handlersRef.current?.handleMockupGenerate) {
            if (isLocalDevelopment()) {
              console.log(`[handleBrandKit] Triggering generation for node ${mockupNodeId} with preset ${presetId}`);
            }

            // Trigger generation asynchronously
            Promise.resolve().then(async () => {
              try {
                await handlersRef.current.handleMockupGenerate(
                  mockupNodeId,
                  imageInput,
                  presetId,
                  undefined, // selectedColors
                  false, // withHuman
                  undefined // customPrompt
                );
                if (isLocalDevelopment()) {
                  console.log(`[handleBrandKit] Generation completed for node ${mockupNodeId}`);
                }
              } catch (error: any) {
                if (isLocalDevelopment()) {
                  console.error(`[handleBrandKit] Failed to generate mockup for node ${mockupNodeId}:`, error);
                }
                toast.error(t('canvas.failedToGenerateMockup', { presetId }), { duration: 3000 });
              }
            });
          } else {
            if (isLocalDevelopment()) {
              console.warn(`[handleBrandKit] Cannot generate for node ${mockupNodeId}:`, {
                nodeExists: !!mockupNode,
                nodeType: mockupNode?.type,
                hasHandler: !!handlersRef.current?.handleMockupGenerate
              });
            }
          }
        }
        return currentNodes; // Return unchanged nodes (we're just using this to access latest state)
      });
    }, 600 + (presetIds.length * 100)); // Wait longer for all nodes and edges to be created

    toast.success(t('canvas.creatingMockups', {
      count: presetIds.length,
      plural: presetIds.length > 1 ? 's' : ''
    }), { duration: 2000 });
  }, [reactFlowInstance, nodes, edges, addMockupNode, onConnect, handlersRef, addToHistory, setNodes]);

  // Handler to remove edge from PromptNode
  const handlePromptRemoveEdge = useCallback((nodeId: string, targetHandle: 'input-1' | 'input-2' | 'input-3' | 'input-4') => {
    addToHistory(nodes, edges);

    setEdges((eds: Edge[]) => {
      const edgeToRemove = eds.find(
        e => e.target === nodeId && e.targetHandle === targetHandle
      );

      if (!edgeToRemove) {
        return eds;
      }

      const newEdges = eds.filter(e => e.id !== edgeToRemove.id);

      setTimeout(() => {
        addToHistory(nodes, newEdges);
      }, 0);

      return newEdges;
    });
  }, [nodes, edges, setEdges, addToHistory]);

  // Handler to delete node by ID (used by NodeContainer delete button)
  const handleDeleteNodeById = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    addToHistory(nodes, edges);

    // Check if the image is liked (should be preserved in R2 for MyOutputsPage)
    const nodeData = node.data as any;
    const isLiked = nodeData.isLiked === true || nodeData.mockup?.isLiked === true;

    // Coletar todas as URLs do R2 que precisam ser deletadas
    const urlsToDelete = collectR2UrlsForDeletion(node, isLiked);

    // Deletar todas as URLs do R2
    if (urlsToDelete.length > 0) {
      await Promise.allSettled(
        urlsToDelete.map(url => canvasApi.deleteImageFromR2(url))
      ).catch((error) => {
        if (isLocalDevelopment()) {
          console.error('Failed to delete some files from R2:', error);
        }
      });
    }

    const nodeIdsToRemove = new Set([nodeId]);
    const newNodes = nodes.filter(n => !nodeIdsToRemove.has(n.id));
    const newEdges = edges.filter(e =>
      !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target)
    );

    setNodes(newNodes);
    setEdges(newEdges);

    setTimeout(() => {
      addToHistory(newNodes, newEdges);
    }, 0);

    toast.success(t('canvas.nodeDeleted'), { duration: 2000 });
  }, [nodes, edges, setNodes, setEdges, addToHistory, t]);

  // Update node data with handlers - always ensure handlers are attached
  const lastSubscriptionStatusRef = useRef(subscriptionStatus);
  const isUpdatingRef = useRef(false);
  const previousNodesRef = useRef<Node<FlowNodeData>[]>(nodes);
  const previousEdgesRef = useRef<Edge[]>(edges);
  const isDraggingRef = useRef(false);
  const draggingNodeIdRef = useRef<string | null>(null);
  const lastPresenceUpdateRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    // Guard against infinite loops - prevent concurrent updates
    if (isUpdatingRef.current) {
      return;
    }

    // Skip execution during drag - will run once when drag ends
    if (isDraggingRef.current) {
      return;
    }

    // Check if nodes/edges actually changed by comparing references
    // This helps prevent unnecessary updates when the array reference changes but content is the same
    const nodesChanged = previousNodesRef.current !== nodes;
    const edgesChanged = previousEdgesRef.current !== edges;

    // Ignore changes that are only slider property updates (to prevent loops during shader editing)
    if (nodesChanged && previousNodesRef.current && nodes.length === previousNodesRef.current.length) {
      const sliderProperties = [
        'ditherIntensity', 'threshold', 'ditherPixelSize',
        'dotSize', 'angle', 'contrast', 'spacing', 'halftoneThreshold',
        'tapeWaveIntensity', 'tapeCreaseIntensity', 'switchingNoiseIntensity',
        'bloomIntensity', 'acBeatIntensity', 'matrixSize', 'bias',
      ];

      let onlySliderChanges = true;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const prevNode = previousNodesRef.current[i];

        if (!prevNode || node.id !== prevNode.id || node.type !== prevNode.type) {
          onlySliderChanges = false;
          break;
        }

        // Check if only slider properties changed
        if (node.type === 'shader') {
          const nodeData = node.data as any;
          const prevNodeData = prevNode.data as any;

          // Compare all properties except slider properties
          const allKeys = new Set([...Object.keys(nodeData), ...Object.keys(prevNodeData)]);
          for (const key of allKeys) {
            if (!sliderProperties.includes(key) && nodeData[key] !== prevNodeData[key]) {
              onlySliderChanges = false;
              break;
            }
          }
          if (!onlySliderChanges) break;
        } else {
          // For non-shader nodes, check if data actually changed
          if (JSON.stringify(node.data) !== JSON.stringify(prevNode.data)) {
            onlySliderChanges = false;
            break;
          }
        }

        // Check position changes
        if (node.position.x !== prevNode.position.x || node.position.y !== prevNode.position.y) {
          onlySliderChanges = false;
          break;
        }
      }

      // If only slider properties changed, skip the update to prevent loops
      if (onlySliderChanges && !edgesChanged) {
        previousNodesRef.current = nodes;
        return;
      }
    }

    // Check if any node is currently loading/generating
    const hasNodesLoading = nodes.some(n => (n.data as any)?.isLoading === true);

    // Check if loading just finished (transition from loading to not loading)
    let loadingJustFinished = false;
    if (nodesChanged && previousNodesRef.current && nodes.length === previousNodesRef.current.length) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const prevNode = previousNodesRef.current[i];

        if (prevNode && node.id === prevNode.id) {
          const prevLoading = (prevNode.data as any)?.isLoading ?? false;
          const currLoading = (node.data as any)?.isLoading ?? false;

          // Detect loading finished: true -> false
          if (prevLoading === true && currLoading === false) {
            loadingJustFinished = true;
            break;
          }
        }
      }
    }


    // Skip updates during active loading/generation
    // Only allow updates when:
    // 1. Loading just finished (to process final state), OR
    // 2. No nodes are loading AND edges changed (structural changes), OR
    // 3. No nodes are loading AND node count/structure changed (new/removed nodes)
    if (hasNodesLoading && !loadingJustFinished) {
      // During loading, only process if there are structural changes
      const structuralChange =
        edgesChanged || // Edges changed
        !previousNodesRef.current || // No previous state
        nodes.length !== previousNodesRef.current.length || // Node count changed
        nodes.some((node, index) => {
          const prevNode = previousNodesRef.current[index];
          return !prevNode || node.id !== prevNode.id || node.type !== prevNode.type;
        }); // Node structure changed

      if (!structuralChange) {
        // No structural changes during loading - skip update
        // Update refs to prevent future triggers
        if (nodesChanged) {
          previousNodesRef.current = nodes;
        }
        return;
      }
    }

    if (import.meta.env.DEV && isLocalDevelopment()) {
      console.log('[CanvasPage] useEffect triggered - updating nodes', {
        nodesCount: nodes.length,
        edgesCount: edges.length,
        hasNodesLoading,
        loadingJustFinished,
      });
    }

    if (lastSubscriptionStatusRef.current !== subscriptionStatus) {
      lastSubscriptionStatusRef.current = subscriptionStatus;
    }

    // Always check and update handlers for all nodes
    setNodes((nds: Node<FlowNodeData>[]) => {
      // Check if any nodes need handlers to be attached
      const hasNodesNeedingHandlers = nds.some(n =>
        (n.type === 'merge' && (!(n.data as MergeNodeData).onGenerate || !(n.data as MergeNodeData).onGeneratePrompt || !(n.data as MergeNodeData).onUpdateData || !handlersRef.current?.handleMergeGenerate || !handlersRef.current?.handleMergeGeneratePrompt)) ||
        (n.type === 'prompt' && (!(n.data as PromptNodeData).onGenerate || !(n.data as PromptNodeData).onUpdateData || !handlersRef.current?.handlePromptGenerate)) ||
        (n.type === 'edit' && (!(n.data as EditNodeData).onApply || !(n.data as EditNodeData).onUpdateData || !handlersRef.current?.handleEditApply || (n.data as EditNodeData).subscriptionStatus !== subscriptionStatus)) ||
        (n.type === 'upscale' && (!(n.data as UpscaleNodeData).onUpscale || !(n.data as UpscaleNodeData).onUpdateData || !handlersRef.current?.handleUpscale)) ||
        (n.type === 'mockup' && (!(n.data as any).onGenerate || !(n.data as any).onUpdateData || !handlersRef.current?.handleMockupGenerate || !mockupArraysEqual((n.data as any).userMockups, userMockups))) ||
        (n.type === 'image' && (!(n.data as ImageNodeData).onUpload || !(n.data as ImageNodeData).onView || !(n.data as ImageNodeData).addTextNode || !handlersRef.current?.handleUploadImage)) ||
        (n.type === 'brand' && (!(n.data as BrandNodeData).onAnalyze || !(n.data as BrandNodeData).onUploadLogo || !(n.data as BrandNodeData).onUpdateData || !handlersRef.current?.handleBrandAnalyze)) ||
        (n.type === 'brandCore' && (!(n.data as BrandCoreData).onAnalyze || !(n.data as BrandCoreData).onUpdateData || !(n.data as BrandCoreData).onUploadPdfToR2 || !(n.data as BrandCoreData).onCancelAnalyze || !handlersRef.current?.handleBrandCoreAnalyze || !handlersRef.current?.handleBrandCoreDataUpdate || !handlersRef.current?.handleBrandCoreUploadPdfToR2 || !handlersRef.current?.handleBrandCoreCancelAnalyze))
      );

      // Check if there are edges connected to nodes that need image synchronization
      // This ensures we always sync images when edges change, even if handlers are already present
      const nodeTypesNeedingImageSync = ['edit', 'mockup', 'prompt', 'upscale', 'upscaleBicubic', 'merge'] as const;
      const hasEdgesNeedingImageSync = edges.some(edge => {
        const targetNode = nds.find(n => n.id === edge.target);
        return targetNode && nodeTypesNeedingImageSync.includes(targetNode.type as typeof nodeTypesNeedingImageSync[number]);
      });

      // Only return early if:
      // 1. No nodes need handlers, AND
      // 2. No edges need image synchronization, AND
      // 3. Handlers are available
      // This ensures image sync always happens when edges change
      if (!hasNodesNeedingHandlers && !hasEdgesNeedingImageSync && handlersRef.current) {
        return nds;
      }

      // Only update if handlers are available
      if (!handlersRef.current) {
        return nds;
      }

      let hasChanges = false;
      const updatedNodes = nds.map((n: Node<FlowNodeData>) => {
        if (n.type === 'merge') {
          const mergeData = n.data as MergeNodeData;
          // Calculate connected images - prioritize base64 for better thumbnail display
          const connectedImages = edges
            .filter(e => e.target === n.id)
            .map(e => {
              const sourceNode = nds.find(node => node.id === e.source);
              return sourceNode ? getImageFromSourceNode(sourceNode) : null;
            })
            .filter((img): img is string => img !== null && typeof img === 'string' && img.length > 0);

          const needsUpdate = !mergeData.onGenerate ||
            !mergeData.onGeneratePrompt ||
            !mergeData.onUpdateData ||
            !arraysEqual(mergeData.connectedImages, connectedImages) ||
            !handlersRef.current?.handleMergeGenerate ||
            !handlersRef.current?.handleMergeGeneratePrompt;

          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...mergeData,
                onGenerate: handlersRef.current.handleMergeGenerate,
                onGeneratePrompt: handlersRef.current.handleMergeGeneratePrompt,
                onUpdateData: handleMergeNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImages,
                model: mergeData.model || 'gemini-2.5-flash-image',
              } as MergeNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'prompt') {
          const promptData = n.data as PromptNodeData;

          // Get images by handle (input-1, input-2, input-3, input-4)
          const image1Edge = edges.find(e => e.target === n.id && e.targetHandle === 'input-1');
          const image2Edge = edges.find(e => e.target === n.id && e.targetHandle === 'input-2');
          const image3Edge = edges.find(e => e.target === n.id && e.targetHandle === 'input-3');
          const image4Edge = edges.find(e => e.target === n.id && e.targetHandle === 'input-4');

          // Determine max handles based on model
          const model = promptData.model || 'gemini-2.5-flash-image';
          const maxHandles = model === 'gemini-3-pro-image-preview' ? 4 : 2;

          // Helper function to get image from edge
          const getImageFromEdge = (edge: Edge | undefined) => {
            if (!edge) return null;
            const sourceNode = nds.find(node => node.id === edge.source);
            return sourceNode ? getImageFromSourceNode(sourceNode) : null;
          };

          const connectedImage1 = getImageFromEdge(image1Edge);
          const connectedImage2 = getImageFromEdge(image2Edge);
          const connectedImage3 = maxHandles >= 3 ? getImageFromEdge(image3Edge) : null;
          const connectedImage4 = maxHandles >= 4 ? getImageFromEdge(image4Edge) : null;

          // Check if images changed - always update if edges exist or images changed
          // Use explicit undefined for comparison to properly detect when edges are removed
          const currentImage1 = promptData.connectedImage1 ?? undefined;
          const currentImage2 = promptData.connectedImage2 ?? undefined;
          const currentImage3 = promptData.connectedImage3 ?? undefined;
          const currentImage4 = promptData.connectedImage4 ?? undefined;

          const newImage1 = connectedImage1 ?? undefined;
          const newImage2 = connectedImage2 ?? undefined;
          const newImage3 = connectedImage3 ?? undefined;
          const newImage4 = connectedImage4 ?? undefined;

          // Detect changes: compare current vs new, handling undefined cases
          const imagesChanged =
            currentImage1 !== newImage1 ||
            currentImage2 !== newImage2 ||
            currentImage3 !== newImage3 ||
            currentImage4 !== newImage4;

          const hasConnectedEdges = !!image1Edge || !!image2Edge || !!image3Edge || !!image4Edge;
          const hasImagesToClear = !hasConnectedEdges && (
            currentImage1 !== undefined ||
            currentImage2 !== undefined ||
            currentImage3 !== undefined ||
            currentImage4 !== undefined
          );

          // Always update if:
          // 1. Images changed (connected or disconnected)
          // 2. Edges exist but images aren't set
          // 3. Edges removed but images still present (needs cleanup)
          // 4. Handlers missing
          const hasAnyConnectedImage = newImage1 || newImage2 || newImage3 || newImage4;

          // Check for connected BrandNode or BrandCore and extract brand identity
          let connectedBrandIdentity = getConnectedBrandIdentity(n.id, nds, edges);

          // Also check for BrandCore connections (smart handle)
          const brandCoreEdge = edges.find(e => e.target === n.id && e.sourceHandle === 'prompt-output');
          if (brandCoreEdge && !connectedBrandIdentity) {
            const brandCoreNode = nds.find(node => node.id === brandCoreEdge.source);
            if (brandCoreNode?.type === 'brandCore') {
              const brandCoreData = brandCoreNode.data as any;
              if (brandCoreData.brandIdentity) {
                connectedBrandIdentity = brandCoreData.brandIdentity;
              }
            }
          }

          const brandIdentityChanged = JSON.stringify(promptData.connectedBrandIdentity) !== JSON.stringify(connectedBrandIdentity);

          // Check if connected BrandNode or BrandCore has PDF
          let hasPdfIdentity = false;
          const brandEdges = edges.filter(e => e.target === n.id);
          for (const edge of brandEdges) {
            const sourceNode = nds.find(node => node.id === edge.source);
            if (sourceNode?.type === 'brand') {
              const brandData = sourceNode.data as BrandNodeData;
              if (brandData.identityFileType === 'pdf' && (brandData.identityPdfBase64 || brandData.identityPdfUrl)) {
                hasPdfIdentity = true;
                break;
              }
            } else if (sourceNode?.type === 'brandCore' && edge.sourceHandle === 'prompt-output') {
              const brandCoreData = sourceNode.data as any;
              // BrandCore can have PDF identity
              if (brandCoreData.connectedPdf || brandCoreData.uploadedIdentityType === 'pdf') {
                hasPdfIdentity = true;
                break;
              }
            }
          }

          const needsUpdate = !promptData.onGenerate ||
            !promptData.onUpdateData ||
            imagesChanged ||
            hasImagesToClear ||
            brandIdentityChanged ||
            !handlersRef.current?.handlePromptGenerate ||
            (hasConnectedEdges && !hasAnyConnectedImage);

          if (needsUpdate) {
            if (imagesChanged && isLocalDevelopment()) {
              console.log('[CanvasPage] PromptNode images updated:', {
                nodeId: n.id,
                model,
                maxHandles,
                previousImage1: currentImage1 ? 'present' : 'none',
                previousImage2: currentImage2 ? 'present' : 'none',
                previousImage3: currentImage3 ? 'present' : 'none',
                previousImage4: currentImage4 ? 'present' : 'none',
                newImage1: newImage1 ? 'present' : 'none',
                newImage2: newImage2 ? 'present' : 'none',
                newImage3: newImage3 ? 'present' : 'none',
                newImage4: newImage4 ? 'present' : 'none',
              });
            }
            hasChanges = true;

            // Build update object with only defined images
            const imageUpdates: Partial<PromptNodeData> = {
              connectedImage1: connectedImage1 || undefined,
              connectedImage2: connectedImage2 || undefined,
              connectedBrandIdentity: connectedBrandIdentity || undefined,
            };

            // Only show PDF reference input if BrandNode has PDF
            if (!hasPdfIdentity && promptData.pdfPageReference) {
              imageUpdates.pdfPageReference = undefined;
            }

            // Only include image3 and image4 if model supports them (4K)
            if (maxHandles >= 3) {
              imageUpdates.connectedImage3 = connectedImage3 || undefined;
            } else {
              imageUpdates.connectedImage3 = undefined;
            }

            if (maxHandles >= 4) {
              imageUpdates.connectedImage4 = connectedImage4 || undefined;
            } else {
              imageUpdates.connectedImage4 = undefined;
            }

            return {
              ...n,
              data: {
                ...promptData,
                ...imageUpdates,
                onGenerate: handlersRef.current.handlePromptGenerate,
                onUpdateData: handlePromptNodeDataUpdate,
                onRemoveEdge: handlePromptRemoveEdge,
                onDeleteNode: handleDeleteNodeById,
                model: promptData.model || 'gemini-2.5-flash-image',
                prompt: promptData.prompt || '',
              } as PromptNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'edit') {
          const editData = n.data as EditNodeData;

          // Check for connected ImageNode, LogoNode, BrandNode, or OutputNode and sync uploadedImage
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output';

          // Determine new uploadedImage based on edge connection state
          let newUploadedImage: { base64: string; mimeType: string } | null = null;

          if (hasConnectedImage && sourceNode) {
            // Get image from source node
            const imageData = getImageFromSourceNode(sourceNode);
            if (imageData) {
              // Extract base64 (remove data: prefix if present)
              const base64 = imageData.startsWith('data:')
                ? imageData.split(',')[1] || imageData
                : imageData;
              newUploadedImage = {
                base64: base64,
                mimeType: 'image/png',
              };
            }
            // If edge exists but no imageBase64, keep newUploadedImage as null (clear)
          }
          // If no edge connected (!hasConnectedImage), newUploadedImage stays null (clear)

          // Detect change: compare current vs new, handling null cases
          const currentUploadedImage = editData.uploadedImage || null;
          const uploadedImageChanged =
            (currentUploadedImage?.base64 !== newUploadedImage?.base64) ||
            (currentUploadedImage === null && newUploadedImage !== null) ||
            (currentUploadedImage !== null && newUploadedImage === null);

          const needsUpdate = !editData.onApply || !editData.onUpdateData || !handlersRef.current?.handleEditApply || editData.subscriptionStatus !== subscriptionStatus || uploadedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...editData,
                onApply: handlersRef.current.handleEditApply,
                onUpdateData: handlersRef.current.handleEditNodeDataUpdate,
                onGenerateSmartPrompt: handlersRef.current.handleEditNodeGenerateSmartPrompt,
                onSuggestPrompts: handlersRef.current.handleEditNodeSuggestPrompts,
                subscriptionStatus: subscriptionStatus,
                uploadedImage: newUploadedImage,
              } as EditNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'upscale') {
          const upscaleData = n.data as UpscaleNodeData;

          // Check for connected ImageNode, LogoNode, BrandNode, or OutputNode and sync connectedImage
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output';

          // Get connected image - prioritize base64 for better thumbnail display
          let newConnectedImage: string | undefined = undefined;
          if (hasConnectedImage && sourceNode) {
            if (sourceNode.type === 'image') {
              const imageData = sourceNode.data as ImageNodeData;
              // Prioritize base64 for thumbnails
              if (imageData.mockup?.imageBase64) {
                const base64 = imageData.mockup.imageBase64.startsWith('data:')
                  ? imageData.mockup.imageBase64
                  : `data:image/png;base64,${imageData.mockup.imageBase64}`;
                newConnectedImage = base64;
              } else {
                // Fallback to URL
                const imageUrl = getImageUrl(imageData.mockup);
                if (imageUrl && imageUrl.length > 0) {
                  newConnectedImage = imageUrl;
                }
              }
            } else if (sourceNode.type === 'logo') {
              const logoData = sourceNode.data as LogoNodeData;
              // Prioritize base64 for thumbnails
              if (logoData.logoBase64) {
                const base64 = logoData.logoBase64.startsWith('data:')
                  ? logoData.logoBase64
                  : `data:image/png;base64,${logoData.logoBase64}`;
                newConnectedImage = base64;
              } else if (logoData.logoImageUrl) {
                // Fallback to logoImageUrl
                newConnectedImage = logoData.logoImageUrl;
              }
            } else if (sourceNode.type === 'merge' || sourceNode.type === 'edit' || sourceNode.type === 'mockup' || sourceNode.type === 'angle' || sourceNode.type === 'prompt' || sourceNode.type === 'upscale' || sourceNode.type === 'output') {
              const nodeData = sourceNode.data as any;
              // Prioritize base64 for thumbnails
              if (nodeData.resultImageBase64) {
                const base64 = nodeData.resultImageBase64.startsWith('data:')
                  ? nodeData.resultImageBase64
                  : `data:image/png;base64,${nodeData.resultImageBase64}`;
                newConnectedImage = base64;
              } else if (nodeData.resultImageUrl) {
                // Fallback to URL
                newConnectedImage = nodeData.resultImageUrl;
              }
            } else if (sourceNode.type === 'brand') {
              const brandData = sourceNode.data as BrandNodeData;
              // Prioritize base64 for thumbnails
              if (brandData.logoBase64) {
                const base64 = brandData.logoBase64.startsWith('data:')
                  ? brandData.logoBase64
                  : `data:image/png;base64,${brandData.logoBase64}`;
                newConnectedImage = base64;
              } else if (brandData.logoImage) {
                // Fallback to logoImage
                newConnectedImage = brandData.logoImage;
              }
            }
          }

          // Detect change
          const currentConnectedImage = (upscaleData as any).connectedImage ?? undefined;
          const connectedImageChanged = currentConnectedImage !== newConnectedImage;

          const needsUpdate = !upscaleData.onUpscale || !upscaleData.onUpdateData || !handlersRef.current?.handleUpscale || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...upscaleData,
                onUpscale: handlersRef.current.handleUpscale,
                onUpdateData: handlersRef.current.handleUpscaleNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImage: newConnectedImage,
              } as any,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'mockup') {
          const mockupData = n.data as any;

          // Check for connected ImageNode, LogoNode, BrandNode, or OutputNode and sync connectedImage
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output';

          // Get connected image - prioritize base64 for better thumbnail display
          const newConnectedImage: string | undefined = hasConnectedImage && sourceNode
            ? (getImageFromSourceNode(sourceNode) || undefined)
            : undefined;
          // If no edge connected, explicitly set to undefined to clear the image
          // This ensures cleanup when edge is removed

          // Detect change: compare current value with new value, handling undefined/null cases
          const currentConnectedImage = mockupData.connectedImage || undefined;
          const connectedImageChanged = currentConnectedImage !== newConnectedImage;

          const needsUpdate = !mockupData.onGenerate || !mockupData.onUpdateData || !mockupData.onAddMockupNode || !handlersRef.current?.handleMockupGenerate || !mockupArraysEqual(mockupData.userMockups, userMockups) || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...mockupData,
                onGenerate: handlersRef.current.handleMockupGenerate,
                onUpdateData: handlersRef.current.handleMockupNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                onAddMockupNode: () => {
                  if (reactFlowInstance) {
                    try {
                      // Position new node to the right of current node with slight vertical offset
                      const nodeWidth = 320; // MockupNode width
                      const horizontalOffset = nodeWidth + 50; // Space between nodes
                      const verticalOffset = 30; // Slight vertical offset for visual separation
                      const newPosition = {
                        x: n.position.x + horizontalOffset,
                        y: n.position.y + verticalOffset,
                      };
                      addMockupNode(newPosition, true); // true = isFlowPosition
                    } catch (error) {
                      if (isLocalDevelopment()) {
                        console.error('Error creating new mockup node:', error);
                      }
                    }
                  }
                },
                userMockups: userMockups,
                connectedImage: newConnectedImage,
              } as any,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'angle') {
          const angleData = n.data as any;

          // Check for connected ImageNode, LogoNode, BrandNode, or OutputNode and sync connectedImage
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output';

          // Get connected image - prioritize base64 for better thumbnail display
          const newConnectedImage: string | undefined = hasConnectedImage && sourceNode
            ? (getImageFromSourceNode(sourceNode) || undefined)
            : undefined;

          const connectedImageChanged = angleData.connectedImage !== newConnectedImage;
          const needsUpdate = !angleData.onGenerate || !angleData.onUpdateData || !handlersRef.current?.handleAngleGenerate || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...angleData,
                onGenerate: handlersRef.current.handleAngleGenerate,
                onUpdateData: handlersRef.current.handleAngleNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImage: newConnectedImage,
              } as any,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'texture') {
          const textureData = n.data as any;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output';
          const newConnectedImage: string | undefined = hasConnectedImage && sourceNode
            ? (getImageFromSourceNode(sourceNode) || undefined)
            : undefined;
          const connectedImageChanged = textureData.connectedImage !== newConnectedImage;
          const needsUpdate = !textureData.onGenerate || !textureData.onUpdateData || !handlersRef.current?.handleTextureGenerate || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...textureData,
                onGenerate: handlersRef.current.handleTextureGenerate,
                onUpdateData: handlersRef.current.handleTextureNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImage: newConnectedImage,
              } as any,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'ambience') {
          const ambienceData = n.data as any;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output';
          const newConnectedImage: string | undefined = hasConnectedImage && sourceNode
            ? (getImageFromSourceNode(sourceNode) || undefined)
            : undefined;
          const connectedImageChanged = ambienceData.connectedImage !== newConnectedImage;
          const needsUpdate = !ambienceData.onGenerate || !ambienceData.onUpdateData || !handlersRef.current?.handleAmbienceGenerate || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...ambienceData,
                onGenerate: handlersRef.current.handleAmbienceGenerate,
                onUpdateData: handlersRef.current.handleAmbienceNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImage: newConnectedImage,
              } as any,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'luminance') {
          const luminanceData = n.data as any;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output';
          const newConnectedImage: string | undefined = hasConnectedImage && sourceNode
            ? (getImageFromSourceNode(sourceNode) || undefined)
            : undefined;
          const connectedImageChanged = luminanceData.connectedImage !== newConnectedImage;
          const needsUpdate = !luminanceData.onGenerate || !luminanceData.onUpdateData || !handlersRef.current?.handleLuminanceGenerate || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...luminanceData,
                onGenerate: handlersRef.current.handleLuminanceGenerate,
                onUpdateData: handlersRef.current.handleLuminanceNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImage: newConnectedImage,
              } as any,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'shader') {
          const shaderData = n.data as ShaderNodeData;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output' || sourceNode?.type === 'merge' || sourceNode?.type === 'edit' || sourceNode?.type === 'upscale' || sourceNode?.type === 'upscaleBicubic' || sourceNode?.type === 'mockup' || sourceNode?.type === 'angle' || sourceNode?.type === 'prompt' || sourceNode?.type === 'shader' || sourceNode?.type === 'video' || sourceNode?.type === 'videoInput';
          const newConnectedImage: string | undefined = hasConnectedImage && sourceNode
            ? (getImageFromSourceNode(sourceNode) || undefined)
            : undefined;
          const connectedImageChanged = shaderData.connectedImage !== newConnectedImage;
          const needsUpdate = !shaderData.onApply || !shaderData.onUpdateData || !shaderData.onViewFullscreen || !handlersRef.current?.handleShaderApply || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...shaderData,
                onApply: handlersRef.current.handleShaderApply,
                onUpdateData: handlersRef.current.handleShaderNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImage: newConnectedImage,
                onViewFullscreen: (imageUrl: string | null, imageBase64?: string | null, sliders?: Array<{
                  label: string;
                  value: number;
                  min: number;
                  max: number;
                  step?: number;
                  onChange: (value: number) => void;
                  formatValue?: (value: number) => string;
                }>) => {
                  setImageFullscreenModal({
                    imageUrl,
                    imageBase64,
                    title: t('canvas.shaderEffect'),
                    sliders,
                  });
                },
              } as ShaderNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'upscaleBicubic') {
          const upscaleBicubicData = n.data as UpscaleBicubicNodeData;
          const connectedEdge = edges.find(e => e.target === n.id);
          const sourceNode = connectedEdge ? nds.find(node => node.id === connectedEdge.source) : null;
          const hasConnectedImage = sourceNode?.type === 'image' || sourceNode?.type === 'logo' || sourceNode?.type === 'brand' || sourceNode?.type === 'output' || sourceNode?.type === 'merge' || sourceNode?.type === 'edit' || sourceNode?.type === 'upscale' || sourceNode?.type === 'upscaleBicubic' || sourceNode?.type === 'mockup' || sourceNode?.type === 'angle' || sourceNode?.type === 'prompt' || sourceNode?.type === 'shader';
          const newConnectedImage: string | undefined = hasConnectedImage && sourceNode
            ? (getImageFromSourceNode(sourceNode) || undefined)
            : undefined;
          const connectedImageChanged = upscaleBicubicData.connectedImage !== newConnectedImage;
          const needsUpdate = !upscaleBicubicData.onApply || !upscaleBicubicData.onUpdateData || !handlersRef.current?.handleUpscaleBicubicApply || connectedImageChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...upscaleBicubicData,
                onApply: handlersRef.current.handleUpscaleBicubicApply,
                onUpdateData: handlersRef.current.handleUpscaleBicubicNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
                connectedImage: newConnectedImage,
              } as UpscaleBicubicNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'image') {
          const data = n.data as ImageNodeData;
          const userMockupsChanged = !mockupArraysEqual(data.userMockups, userMockups);
          const needsUpdate = !data.onUpload || !data.onView || !data.onUpdateData || !data.onBrandKit || !data.addTextNode || !handlersRef.current?.handleUploadImage || userMockupsChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...data,
                userMockups: userMockups,
                onView: handleView,
                onEdit: handleEdit,
                onDelete: handleDelete,
                onUpload: handlersRef.current.handleUploadImage,
                onUpdateData: handleImageNodeDataUpdate,
                onBrandKit: handleBrandKit,
                addTextNode: addTextNode,
                onDeleteNode: handleDeleteNodeById,
              } as ImageNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'output') {
          const outputData = n.data as OutputNodeData;
          const userMockupsChanged = !arraysEqual(outputData.userMockups || [], userMockups);
          // Update if handlers are missing or userMockups changed
          const needsUpdate = !outputData.onView || !outputData.onEdit || !outputData.onDelete || !outputData.onBrandKit || userMockupsChanged;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...outputData,
                onView: handleViewOutput,
                onEdit: handleEditOutput,
                onDelete: handleDelete,
                onBrandKit: handleBrandKit,
                userMockups: userMockups,
                onDeleteNode: handleDeleteNodeById,
              } as OutputNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'text') {
          const textData = n.data as TextNodeData;
          const needsUpdate = !textData.onUpdateData || !handlersRef.current?.handleTextNodeDataUpdate;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...textData,
                onUpdateData: handleTextNodeDataUpdate,
                onDeleteNode: handleDeleteNodeById,
              } as TextNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'brand') {
          const brandData = n.data as BrandNodeData;
          const needsHandlerUpdate = !brandData.onAnalyze || !brandData.onUploadLogo || !brandData.onUpdateData || !handlersRef.current?.handleBrandAnalyze;

          // Sync connected data from edges
          const updates: Partial<BrandNodeData> = {};
          let brandHasChanges = false;

          // Helper para extrair imagem de um Node (prioriza URL do R2, fallback para base64)
          const getImageFromNode = (sourceNode: Node<FlowNodeData>): { url?: string; base64?: string } => {
            if (sourceNode.type === 'image') {
              const imageData = sourceNode.data as ImageNodeData;
              // Priorizar URL do R2 se disponível
              if (imageData.mockup) {
                const imageUrl = getImageUrl(imageData.mockup);
                if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
                  return { url: imageUrl };
                }
                // Fallback para base64
                const base64 = imageData.mockup.imageBase64;
                if (base64) {
                  const cleanBase64 = base64.startsWith('data:')
                    ? base64.split(',')[1] || base64
                    : base64;
                  return { base64: cleanBase64 };
                }
              }
            } else if (sourceNode.type === 'logo') {
              const logoData = sourceNode.data as LogoNodeData;
              // LogoNode pode ter logoImageUrl ou logoBase64
              if (logoData.logoImageUrl && (logoData.logoImageUrl.startsWith('http://') || logoData.logoImageUrl.startsWith('https://'))) {
                return { url: logoData.logoImageUrl };
              }
              const base64 = logoData.logoBase64;
              if (base64) {
                const cleanBase64 = base64.startsWith('data:')
                  ? base64.split(',')[1] || base64
                  : base64;
                return { base64: cleanBase64 };
              }
            } else if (sourceNode.type === 'output') {
              const outputData = sourceNode.data as OutputNodeData;
              // Priorizar URL do R2 se disponível
              if (outputData.resultImageUrl && (outputData.resultImageUrl.startsWith('http://') || outputData.resultImageUrl.startsWith('https://'))) {
                return { url: outputData.resultImageUrl };
              }
              // Fallback para base64
              if (outputData.resultImageBase64) {
                const cleanBase64 = outputData.resultImageBase64.startsWith('data:')
                  ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
                  : outputData.resultImageBase64;
                return { base64: cleanBase64 };
              }
            }
            return {};
          };

          // Logo connection (logo-input handle)
          const logoEdge = edges.find(e => e.target === n.id && e.targetHandle === 'logo-input');
          if (logoEdge) {
            const logoNode = nds.find(node => node.id === logoEdge.source);
            if (logoNode && (logoNode.type === 'image' || logoNode.type === 'logo' || logoNode.type === 'output')) {
              const imageData = getImageFromNode(logoNode);
              // Armazenar URL ou base64 (prioriza URL para preview, mas mantém base64 para análise)
              const logoValue = imageData.url || imageData.base64;
              if (logoValue && brandData.connectedLogo !== logoValue) {
                updates.connectedLogo = logoValue;
                brandHasChanges = true;
              }
            }
          } else {
            if (brandData.connectedLogo) {
              updates.connectedLogo = undefined;
              brandHasChanges = true;
            }
          }

          // Identity connection (identity-input handle)
          const identityEdge = edges.find(e => e.target === n.id && e.targetHandle === 'identity-input');
          if (identityEdge) {
            const identityNode = nds.find(node => node.id === identityEdge.source);
            if (identityNode?.type === 'pdf') {
              const pdfData = identityNode.data as PDFNodeData;
              if (pdfData.pdfBase64 && (brandData.connectedIdentity !== pdfData.pdfBase64 || brandData.connectedIdentityType !== 'pdf')) {
                updates.connectedIdentity = pdfData.pdfBase64;
                updates.connectedIdentityType = 'pdf';
                brandHasChanges = true;
              }
            } else if (identityNode && (identityNode.type === 'image' || identityNode.type === 'output')) {
              // Identity guide PNG pode ser conectado via identity-input
              const imageData = getImageFromNode(identityNode);
              const imageValue = imageData.url || imageData.base64;
              if (imageValue && (brandData.connectedIdentity !== imageValue || brandData.connectedIdentityType !== 'png')) {
                updates.connectedIdentity = imageValue;
                updates.connectedIdentityType = 'png';
                brandHasChanges = true;
              }
            }
          } else {
            if (brandData.connectedIdentity) {
              updates.connectedIdentity = undefined;
              brandHasChanges = true;
            }
            if (brandData.connectedIdentityType) {
              updates.connectedIdentityType = undefined;
              brandHasChanges = true;
            }
          }

          if (needsHandlerUpdate || brandHasChanges) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...brandData,
                ...updates,
                onAnalyze: handlersRef.current?.handleBrandAnalyze || (() => Promise.resolve()),
                onUploadLogo: handlersRef.current?.handleBrandLogoUpload || (() => { }),
                onUploadPdf: handlersRef.current?.handleBrandPdfUpload || (() => { }),
                onUpdateData: handlersRef.current?.handleBrandNodeDataUpdate || (() => { }),
                onDeleteNode: handleDeleteNodeById,
              } as BrandNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'strategy') {
          const strategyData = n.data as StrategyNodeData;
          const needsUpdate = !strategyData.onOpenProjectModal;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...strategyData,
                onOpenProjectModal: (nodeId: string) => {
                  setProjectModalNodeId(nodeId);
                  setShowProjectModal(true);
                },
                onDeleteNode: handleDeleteNodeById,
              } as StrategyNodeData,
            } as Node<FlowNodeData>;
          }
        }
        if (n.type === 'brandCore') {
          const brandCoreData = n.data as BrandCoreData;
          const updates: Partial<BrandCoreData> = {};
          let brandCoreHasChanges = false;

          // Helper para extrair imagem de um Node (prioriza URL do R2, fallback para base64)
          // Retorna URL quando disponível (para preview), ou base64 para análise
          const getImageFromNode = (sourceNode: Node<FlowNodeData>): { url?: string; base64?: string } => {
            if (sourceNode.type === 'image') {
              const imageData = sourceNode.data as ImageNodeData;
              // Priorizar URL do R2 se disponível
              if (imageData.mockup) {
                const imageUrl = getImageUrl(imageData.mockup);
                if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
                  return { url: imageUrl };
                }
                // Fallback para base64
                const base64 = imageData.mockup.imageBase64;
                if (base64) {
                  const cleanBase64 = base64.startsWith('data:')
                    ? base64.split(',')[1] || base64
                    : base64;
                  return { base64: cleanBase64 };
                }
              }
            } else if (sourceNode.type === 'logo') {
              const logoData = sourceNode.data as LogoNodeData;
              // LogoNode pode ter logoImageUrl ou logoBase64
              if (logoData.logoImageUrl && (logoData.logoImageUrl.startsWith('http://') || logoData.logoImageUrl.startsWith('https://'))) {
                return { url: logoData.logoImageUrl };
              }
              const base64 = logoData.logoBase64;
              if (base64) {
                const cleanBase64 = base64.startsWith('data:')
                  ? base64.split(',')[1] || base64
                  : base64;
                return { base64: cleanBase64 };
              }
            } else if (sourceNode.type === 'output') {
              const outputData = sourceNode.data as OutputNodeData;
              // Priorizar URL do R2 se disponível
              if (outputData.resultImageUrl && (outputData.resultImageUrl.startsWith('http://') || outputData.resultImageUrl.startsWith('https://'))) {
                return { url: outputData.resultImageUrl };
              }
              // Fallback para base64
              if (outputData.resultImageBase64) {
                const cleanBase64 = outputData.resultImageBase64.startsWith('data:')
                  ? outputData.resultImageBase64.split(',')[1] || outputData.resultImageBase64
                  : outputData.resultImageBase64;
                return { base64: cleanBase64 };
              }
            }
            return {};
          };

          // Logo connection (image-input handle) - prioriza logo, logoNode, output
          const logoEdge = edges.find(e => e.target === n.id && e.targetHandle === 'image-input');
          if (logoEdge) {
            const logoNode = nds.find(node => node.id === logoEdge.source);
            if (logoNode && (logoNode.type === 'logo' || logoNode.type === 'image' || logoNode.type === 'output')) {
              const imageData = getImageFromNode(logoNode);
              // Armazenar URL ou base64 (prioriza URL para preview, mas mantém base64 para análise)
              // Para compatibilidade, armazenamos URL se disponível, senão base64
              const logoValue = imageData.url || imageData.base64;
              if (logoValue && brandCoreData.connectedLogo !== logoValue) {
                updates.connectedLogo = logoValue;
                brandCoreHasChanges = true;
              }
            }
          } else if (brandCoreData.connectedLogo) {
            updates.connectedLogo = undefined;
            brandCoreHasChanges = true;
          }

          // PDF connection (pdf-input handle)
          const pdfEdge = edges.find(e => e.target === n.id && e.targetHandle === 'pdf-input');
          if (pdfEdge) {
            const pdfNode = nds.find(node => node.id === pdfEdge.source);
            if (pdfNode?.type === 'pdf') {
              const pdfData = pdfNode.data as PDFNodeData;
              if (pdfData.pdfBase64 && brandCoreData.connectedPdf !== pdfData.pdfBase64) {
                updates.connectedPdf = pdfData.pdfBase64;
                brandCoreHasChanges = true;
              }
            } else if (pdfNode && (pdfNode.type === 'image' || pdfNode.type === 'output')) {
              // Identity guide PNG pode ser conectado via pdf-input também
              const imageData = getImageFromNode(pdfNode);
              const imageValue = imageData.url || imageData.base64;
              if (imageValue && brandCoreData.connectedImage !== imageValue) {
                updates.connectedImage = imageValue;
                brandCoreHasChanges = true;
              }
            }
          } else {
            if (brandCoreData.connectedPdf) {
              updates.connectedPdf = undefined;
              brandCoreHasChanges = true;
            }
            // Verificar se connectedImage deve ser limpo também
            const imageEdgeForIdentity = edges.find(e => e.target === n.id && e.targetHandle === 'pdf-input');
            if (!imageEdgeForIdentity && brandCoreData.connectedImage) {
              updates.connectedImage = undefined;
              brandCoreHasChanges = true;
            }
          }

          // Strategy connections
          const strategyEdges = edges.filter(e => e.target === n.id && e.targetHandle === 'strategy-input');
          const connectedStrategies: any[] = [];
          strategyEdges.forEach(edge => {
            const strategyNode = nds.find(node => node.id === edge.source);
            if (strategyNode?.type === 'strategy') {
              const strategyData = strategyNode.data as StrategyNodeData;
              if (strategyData.strategyData) {
                connectedStrategies.push({
                  nodeId: strategyNode.id,
                  strategyType: strategyData.strategyType || 'all',
                  data: strategyData.strategyData,
                });
              }
            }
          });

          const strategiesChanged = JSON.stringify(connectedStrategies) !== JSON.stringify(brandCoreData.connectedStrategies || []);
          if (strategiesChanged) {
            updates.connectedStrategies = connectedStrategies;
            brandCoreHasChanges = true;
          }

          // Verificar se precisa atualizar handlers ou dados
          const needsUpdate = brandCoreHasChanges ||
            !brandCoreData.onAnalyze ||
            !brandCoreData.onUpdateData ||
            !brandCoreData.onUploadPdfToR2 ||
            !brandCoreData.onCancelAnalyze ||
            !brandCoreData.onGenerateVisualPrompts ||
            !brandCoreData.onGenerateStrategicPrompts ||
            !handlersRef.current?.handleBrandCoreAnalyze ||
            !handlersRef.current?.handleBrandCoreDataUpdate ||
            !handlersRef.current?.handleBrandCoreUploadPdfToR2 ||
            !handlersRef.current?.handleBrandCoreCancelAnalyze ||
            !handlersRef.current?.handleBrandCoreGenerateVisualPrompts ||
            !handlersRef.current?.handleBrandCoreGenerateStrategicPrompts;

          if (needsUpdate) {
            // Handlers will be attached on next render cycle if not available yet
            // Fallback handlers are provided below to prevent errors
            hasChanges = true;
            return {
              ...n,
              data: {
                ...brandCoreData,
                ...updates,
                onAnalyze: handlersRef.current?.handleBrandCoreAnalyze || (() => Promise.resolve()),
                onCancelAnalyze: handlersRef.current?.handleBrandCoreCancelAnalyze || (() => { }),
                onGenerateVisualPrompts: handlersRef.current?.handleBrandCoreGenerateVisualPrompts || (() => Promise.resolve()),
                onGenerateStrategicPrompts: handlersRef.current?.handleBrandCoreGenerateStrategicPrompts || (() => Promise.resolve()),
                onUpdateData: handlersRef.current?.handleBrandCoreDataUpdate || (() => { }),
                onUploadPdfToR2: handlersRef.current?.handleBrandCoreUploadPdfToR2 || (() => Promise.resolve('')),
                onDeleteNode: handleDeleteNodeById,
              } as BrandCoreData,
            } as Node<FlowNodeData>;
          }
        }

        // Ensure all nodes have onDeleteNode handler
        if (!(n.data as any).onDeleteNode) {
          hasChanges = true;
          return {
            ...n,
            data: {
              ...n.data,
              onDeleteNode: handleDeleteNodeById,
            } as FlowNodeData,
          } as Node<FlowNodeData>;
        }

        return n;
      });

      // Only update if there are actual changes
      if (hasChanges) {
        isUpdatingRef.current = true;
        // Update previous refs after state update completes
        setTimeout(() => {
          previousNodesRef.current = updatedNodes;
          previousEdgesRef.current = edges;
          isUpdatingRef.current = false;
        }, 0);
        return updatedNodes;
      }

      // Update refs even if no changes to track current state
      previousNodesRef.current = nds;
      previousEdgesRef.current = edges;
      return nds;
    });
  }, [nodes, edges, setNodes, handleView, handleEdit, handleEditOutput, handleDelete, subscriptionStatus, handlersRef, handleMergeGeneratePrompt, handleMergeNodeDataUpdate, handlePromptNodeDataUpdate, handlePromptRemoveEdge, userMockups, handleBrandKit, handleDeleteNodeById]);

  // Validate and fix node positions to prevent NaN errors
  useEffect(() => {
    const hasInvalidPositions = nodes.some(
      (node) => !node.position || isNaN(node.position.x) || isNaN(node.position.y)
    );

    if (hasInvalidPositions) {
      setNodes((nds: Node<FlowNodeData>[]) =>
        nds.map((node) => {
          if (!node.position || isNaN(node.position.x) || isNaN(node.position.y)) {
            return {
              ...node,
              position: { x: 0, y: 0 },
            };
          }
          return node;
        })
      );
    }
  }, [nodes, setNodes]);

  // Validate and fix edges to prevent React Flow errors
  useEffect(() => {
    const nodeIds = new Set(nodes.map(n => n.id));

    // Check for invalid edges or edges with null/"null" handles
    const hasInvalidEdges = edges.some((edge) => {
      if (!edge.source || !edge.target) return true;
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return true;
      if (edge.sourceHandle === null || edge.sourceHandle === 'null') return true;
      if (edge.targetHandle === null || edge.targetHandle === 'null') return true;
      return false;
    });

    if (hasInvalidEdges) {
      setEdges((eds: Edge[]) => {
        const validEdges = eds
          .filter((edge) => {
            // Filter out edges with invalid source or target
            if (!edge.source || !edge.target) return false;
            if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
            return true;
          })
          .map((edge) => {
            // Clean sourceHandle and targetHandle: convert null or "null" string to undefined
            return cleanEdgeHandles(edge);
          });
        return validEdges;
      });
    }
  }, [nodes, edges, setEdges]);

  // Import mockup from localStorage if available
  useEffect(() => {
    if (!reactFlowInstance || !isAuthenticated) return;

    try {
      const importMockupData = localStorage.getItem('import-mockup');
      if (importMockupData) {
        let mockup: Mockup;
        try {
          mockup = JSON.parse(importMockupData);
        } catch (parseError) {
          if (isLocalDevelopment()) {
            console.error('Failed to parse imported mockup data:', parseError);
          }
          toast.error(t('canvas.invalidMockupDataFormat'), { duration: 3000 });
          localStorage.removeItem('import-mockup');
          return;
        }

        // Validate mockup has required fields
        if (!mockup || typeof mockup !== 'object') {
          if (isLocalDevelopment()) {
            console.error('Invalid mockup object:', mockup);
          }
          toast.error(t('canvas.invalidMockupData'), { duration: 3000 });
          localStorage.removeItem('import-mockup');
          return;
        }

        // Validate mockup has at least imageUrl or imageBase64
        if (!mockup.imageUrl && !mockup.imageBase64) {
          if (isLocalDevelopment()) {
            console.error('Mockup missing image data:', mockup);
          }
          toast.error(t('canvas.mockupMissingImageData'), { duration: 3000 });
          localStorage.removeItem('import-mockup');
          return;
        }

        // Remove from localStorage after validation
        try {
          localStorage.removeItem('import-mockup');
        } catch (storageError: any) {
          // Quota errors can occur, but we can continue with import
          if (isLocalDevelopment()) {
            console.warn('Failed to remove import-mockup from localStorage:', storageError);
          }
        }

        // Wait a bit for React Flow to be ready
        setTimeout(() => {
          if (!reactFlowInstance) return;

          const screenPos = {
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
            if (isLocalDevelopment()) {
              console.error('Error converting screen position to flow position:', error);
            }
            position = { x: 0, y: 0 };
          }

          addToHistory(nodes, edges);

          const newNode: Node<FlowNodeData> = {
            id: `image-${Date.now()}`,
            type: 'image',
            position,
            style: { width: 150, height: 100 },
            data: {
              type: 'image',
              mockup: mockup,
              onView: handleView,
              onEdit: handleEdit,
              onDelete: handleDelete,
              onUpload: handlersRef.current?.handleUploadImage || (() => { }),
              addTextNode: addTextNode,
            } as ImageNodeData,
          };

          setNodes((nds: Node<FlowNodeData>[]) => {
            const newNodes = [...nds, newNode];
            setTimeout(() => {
              addToHistory(newNodes, edges);
            }, 0);
            return newNodes;
          });

          // Show success message
          toast.success(t('canvas.mockupImportedToCanvas'), { duration: 3000 });
        }, 500);
      }
    } catch (error: any) {
      if (isLocalDevelopment()) {
        console.error('Failed to import mockup:', error);
      }

      // Handle specific error types
      let errorMessage = t('canvas.failedToDeleteMockup');
      if (error?.name === 'QuotaExceededError' || error?.code === 22) {
        errorMessage = t('canvas.storageQuotaExceeded');
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, { duration: 5000 });

      // Try to remove item even if there was an error
      try {
        localStorage.removeItem('import-mockup');
      } catch {
        // Ignore errors when trying to clean up
      }
    }
  }, [reactFlowInstance, isAuthenticated, nodes, edges, setNodes, addToHistory, handleView, handleEdit, handleDelete, handlersRef]);

  // Load user mockups when authenticated
  useEffect(() => {
    const loadUserMockups = async () => {
      if (isAuthenticated === true) {
        try {
          const mockups = await mockupApi.getAll();
          // Filter only blank mockups
          const blankMockups = mockups.filter(m => m.designType === 'blank' && (m.imageUrl || m.imageBase64));
          setUserMockups(blankMockups);
        } catch (error) {
          if (isLocalDevelopment()) {
            console.error('Failed to load user mockups:', error);
          }
          setUserMockups([]);
        }
      } else {
        setUserMockups([]);
      }
    };

    loadUserMockups();
  }, [isAuthenticated]);

  // Disable page scroll permanently on this page
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Image context menu handlers

  // Generic node handlers for NodeContextMenu
  const handleNodeDuplicate = useCallback(() => {
    if (!nodeContextMenu?.nodeId || !reactFlowInstance) return;

    const node = nodes.find(n => n.id === nodeContextMenu.nodeId);
    if (!node) return;

    addToHistory(nodes, edges);

    const newPosition = {
      x: node.position.x + 50,
      y: node.position.y + 50,
    };

    // Create duplicate based on node type
    const duplicatedNode: Node<FlowNodeData> = {
      ...node,
      id: generateNodeId(node.type || 'node'),
      position: newPosition,
      selected: false,
      data: {
        ...node.data,
        // Reset loading states
        isLoading: false,
        isGenerating: false,
        isDescribing: false,
        isAnalyzing: false,
        isGeneratingPrompt: false,
        isSuggestingPrompts: false,
        // Clear result images for flow nodes
        resultImageBase64: undefined,
        resultImageUrl: undefined,
      } as FlowNodeData,
    };

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, duplicatedNode];
      setTimeout(() => {
        addToHistory(newNodes, edges);
      }, 0);
      return newNodes;
    });

    toast.success(t('canvas.nodeDuplicatedSingular'), { duration: 2000 });
  }, [nodeContextMenu, nodes, edges, reactFlowInstance, setNodes, addToHistory, t]);

  const handleNodeDelete = useCallback(async () => {
    if (!nodeContextMenu?.nodeId) return;

    const node = nodes.find(n => n.id === nodeContextMenu.nodeId);
    if (!node) return;

    addToHistory(nodes, edges);

    // Check if the image is liked (should be preserved in R2 for MyOutputsPage)
    const nodeData = node.data as any;
    const isLiked = nodeData.isLiked === true || nodeData.mockup?.isLiked === true;

    // Delete image from R2 if node has resultImageUrl AND is not liked
    const imageUrl = nodeData.resultImageUrl;

    if (!isLiked && imageUrl && !imageUrl.startsWith('data:')) {
      try {
        await canvasApi.deleteImageFromR2(imageUrl);
      } catch (error) {
        if (isLocalDevelopment()) {
          console.error('Failed to delete image from R2:', error);
        }
      }
    }

    const nodeIdsToRemove = new Set([node.id]);
    const newNodes = nodes.filter(n => !nodeIdsToRemove.has(n.id));
    const newEdges = edges.filter(e =>
      !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target)
    );

    setNodes(newNodes);
    setEdges(newEdges);

    setTimeout(() => {
      addToHistory(newNodes, newEdges);
    }, 0);

    toast.success(t('canvas.nodeDeleted'), { duration: 2000 });
  }, [nodeContextMenu, nodes, edges, setNodes, setEdges, addToHistory, t]);

  // Show loading state while loading project
  // Show loading state while checking access
  if (isLoadingAccess) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 flex items-center justify-center">
        <GlitchLoader />
      </div>
    );
  }

  // Don't render content if redirecting
  if (!hasAccess) {
    return null;
  }

  // Show loading screen only if we're actually loading a project from backend
  // Allow visual rendering of canvas even during authentication
  if (isLoadingProject && isAuthenticated !== false) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <GlitchLoader size={36} className="mx-auto mb-4" />
              <p className="text-zinc-400 font-mono text-sm">{t('canvas.loadingProject')}</p>
            </div>
          </div>
        </div>
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => {
              // Don't allow closing without authentication
              if (!isAuthenticated) {
                return;
              }
              setShowAuthModal(false);
            }}
            onSuccess={() => {
              setShowAuthModal(false);
              // Project will reload automatically when isAuthenticated becomes true
            }}
            isSignUp={false}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="min-h-screen text-zinc-300 relative overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: backgroundColor }}
      >
        <div className="fixed inset-0 z-0" style={{ position: 'relative', opacity: 1, scale: 5 }}>
          <GridDotsBackground />
        </div>

        <CanvasHeader
          projectName={projectName}
          onBack={() => navigate('/canvas')}
          onProjectNameChange={(newName: string) => {
            setProjectName(newName);
            toast.success(t('canvas.projectNameUpdated'), { duration: 1200 });
          }}
          selectedNodesCount={nodes.filter(n => n.selected).length}
          selectedNodes={nodes.filter(n => n.selected) as Node<FlowNodeData>[]}
          onShareClick={isAdminOrPremium ? () => setShowShareModal(true) : undefined}
          isCollaborative={isCollaborative}
          othersCount={othersCount}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={(color) => {
            setBackgroundColor(color);
            if (typeof window !== 'undefined') {
              localStorage.setItem('canvasBackgroundColor', color);
            }
          }}
          gridColor={gridColor}
          onGridColorChange={(color) => {
            setGridColor(color);
            if (typeof window !== 'undefined') {
              localStorage.setItem('canvasGridColor', color);
            }
          }}
          showGrid={showGrid}
          onShowGridChange={(show) => {
            setShowGrid(show);
            if (typeof window !== 'undefined') {
              localStorage.setItem('canvasShowGrid', String(show));
            }
          }}
          showMinimap={showMinimap}
          onShowMinimapChange={(show) => {
            setShowMinimap(show);
            if (typeof window !== 'undefined') {
              localStorage.setItem('canvasShowMinimap', String(show));
            }
          }}
          showControls={showControls}
          onShowControlsChange={(show) => {
            setShowControls(show);
            if (typeof window !== 'undefined') {
              localStorage.setItem('canvasShowControls', String(show));
            }
          }}
          cursorColor={cursorColor}
          onCursorColorChange={(color) => {
            setCursorColor(color);
            if (typeof window !== 'undefined') {
              localStorage.setItem('canvasCursorColor', color);
            }
          }}
          experimentalMode={experimentalMode}
          onExperimentalModeChange={setExperimentalMode}
          onImportCommunityPreset={(preset, type) => {
            if (!reactFlowInstance) return;

            // Get center of viewport
            const viewport = reactFlowInstance.getViewport();
            const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
            const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

            // Create appropriate node based on preset type
            switch (type) {
              case 'mockup':
                addMockupNode({ x: centerX, y: centerY }, true);
                // Update the newly created node with the preset
                setTimeout(() => {
                  setNodes((nds) => {
                    const newNodes = [...nds];
                    const lastMockupNode = newNodes.filter(n => n.type === 'mockup').pop();
                    if (lastMockupNode && lastMockupNode.data.onUpdateData) {
                      lastMockupNode.data.onUpdateData(lastMockupNode.id, { selectedPreset: preset.id });
                    }
                    return newNodes;
                  });
                }, 100);
                break;
              case 'angle':
                addAngleNode({ x: centerX, y: centerY });
                setTimeout(() => {
                  setNodes((nds) => {
                    const newNodes = [...nds];
                    const lastAngleNode = newNodes.filter(n => n.type === 'angle').pop();
                    if (lastAngleNode && lastAngleNode.data.onUpdateData) {
                      lastAngleNode.data.onUpdateData(lastAngleNode.id, { selectedPreset: preset.id });
                    }
                    return newNodes;
                  });
                }, 100);
                break;
              case 'texture':
                addTextureNode({ x: centerX, y: centerY });
                setTimeout(() => {
                  setNodes((nds) => {
                    const newNodes = [...nds];
                    const lastTextureNode = newNodes.filter(n => n.type === 'texture').pop();
                    if (lastTextureNode && lastTextureNode.data.onUpdateData) {
                      lastTextureNode.data.onUpdateData(lastTextureNode.id, { selectedPreset: preset.id });
                    }
                    return newNodes;
                  });
                }, 100);
                break;
              case 'ambience':
                addAmbienceNode({ x: centerX, y: centerY });
                setTimeout(() => {
                  setNodes((nds) => {
                    const newNodes = [...nds];
                    const lastAmbienceNode = newNodes.filter(n => n.type === 'ambience').pop();
                    if (lastAmbienceNode && lastAmbienceNode.data.onUpdateData) {
                      lastAmbienceNode.data.onUpdateData(lastAmbienceNode.id, { selectedPreset: preset.id });
                    }
                    return newNodes;
                  });
                }, 100);
                break;
              case 'luminance':
                addLuminanceNode({ x: centerX, y: centerY });
                setTimeout(() => {
                  setNodes((nds) => {
                    const newNodes = [...nds];
                    const lastLuminanceNode = newNodes.filter(n => n.type === 'luminance').pop();
                    if (lastLuminanceNode && lastLuminanceNode.data.onUpdateData) {
                      lastLuminanceNode.data.onUpdateData(lastLuminanceNode.id, { selectedPreset: preset.id });
                    }
                    return newNodes;
                  });
                }, 100);
                break;
            }

            toast.success(t('canvas.presetImported', { name: preset.name }) || `Imported ${preset.name}`, { duration: 2000 });
          }}
        />

        {isCollaborative && projectId && isAuthenticated && authService.getToken() ? (
          <RoomProvider
            id={`canvas-${projectId}`}
            initialPresence={{ cursor: null, selectedNodeId: null, nodePosition: null, isMoving: false }}
            initialStorage={{ nodes: new LiveList([]) as any, edges: new LiveList([]) as any }}
          >
            <CollaborativeCanvas
              nodes={nodes}
              edges={edges}
              handleNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onPaneContextMenu={onPaneContextMenu}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeClick={onEdgeClick}
              onEdgeContextMenu={onEdgeContextMenu}
              nodeTypes={nodeTypes}
              setReactFlowInstance={setReactFlowInstance}
              reactFlowWrapper={reactFlowWrapper}
              projectId={projectId}
              isCollaborative={isCollaborative}
              setNodes={setNodes}
              setEdges={setEdges}
              saveImmediately={saveImmediately}
              onOthersCountChange={setOthersCount}
              backgroundColor={backgroundColor}
              gridColor={gridColor}
              showGrid={showGrid}
              showMinimap={showMinimap}
              showControls={showControls}
              onDropImage={handleDropImage}
              onDropNode={handleDropNode}
              onAddColorExtractor={addColorExtractorNode}
              experimentalMode={experimentalMode}
            />
          </RoomProvider>
        ) : (
          <CanvasFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeClick={onEdgeClick}
            onEdgeContextMenu={onEdgeContextMenu}
            nodeTypes={nodeTypes}
            onInit={setReactFlowInstance}
            reactFlowWrapper={reactFlowWrapper}
            backgroundColor={backgroundColor}
            gridColor={gridColor}
            showGrid={showGrid}
            showMinimap={showMinimap}
            showControls={showControls}
            cursorColor={cursorColor}
            onDropImage={handleDropImage}
            onDropNode={handleDropNode}
            reactFlowInstance={reactFlowInstance}
            experimentalMode={experimentalMode}
            onAddColorExtractor={addColorExtractorNode}
          />
        )}

        {/* Full Screen Viewer */}
        {selectedMockup && getImageUrl(selectedMockup) && (
          <FullScreenViewer
            base64Image={selectedMockup.imageBase64 || undefined}
            imageUrl={selectedMockup.imageUrl || undefined}
            isLoading={false}
            onClose={handleCloseViewer}
            onOpenInEditor={(imageBase64: string) => {
              navigate(`/editor?image=${encodeURIComponent(imageBase64)}`);
            }}
            mockup={selectedMockup}
            onDelete={isAuthenticated && selectedMockup._id ? () => handleDelete(selectedMockup._id) : undefined}
            isDeleting={false}
            isAuthenticated={isAuthenticated === true}
          />
        )}

        {/* Image Fullscreen Modal */}
        {imageFullscreenModal && (
          <ImageFullscreenModal
            imageUrl={imageFullscreenModal.imageUrl}
            imageBase64={imageFullscreenModal.imageBase64}
            onClose={() => setImageFullscreenModal(null)}
            title={imageFullscreenModal.title}
            sliders={imageFullscreenModal.sliders}
          />
        )}

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            sourceNodeId={contextMenu.sourceNodeId}
            onClose={() => setContextMenu(null)}
            onExport={handleExport}
            onAddImage={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addImageNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddText={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addTextNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddMerge={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addMergeNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddPrompt={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addPromptNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddVideo={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addVideoNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                        targetHandle: 'input-image',
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddBrand={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addBrandNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddEdit={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addEditNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddUpscale={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addUpscaleNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddUpscaleBicubic={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addUpscaleBicubicNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddMockup={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addMockupNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddAngle={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addAngleNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddTexture={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addTextureNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddAmbience={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addAmbienceNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddLuminance={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addLuminanceNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddShader={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addShaderNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                      } as any);
                    }, 100);
                  }
                }
              }
            }}
            onAddColorExtractor={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  const newNodeId = addColorExtractorNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                  // Connect automatically if sourceNodeId exists
                  if (newNodeId && contextMenu.sourceNodeId) {
                    setTimeout(() => {
                      onConnect({
                        source: contextMenu.sourceNodeId,
                        target: newNodeId,
                        targetHandle: 'image-input',
                      } as any);
                    }, 100);
                  }
                }
              }
            }}

            onAddBrandKit={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addBrandKitNodes({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddLogo={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addLogoNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddPDF={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addPDFNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddVideoInput={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addVideoInputNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddStrategy={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addStrategyNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddBrandCore={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addBrandCoreNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            onAddChat={() => {
              if (reactFlowInstance) {
                const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
                if (pane) {
                  const rect = pane.getBoundingClientRect();
                  addChatNode({
                    x: contextMenu.x + rect.left,
                    y: contextMenu.y + rect.top,
                  });
                }
              }
            }}
            experimentalMode={experimentalMode}
          />
        )}

        {/* Edge Context Menu */}
        {edgeContextMenu && (
          <EdgeContextMenu
            x={edgeContextMenu.x}
            y={edgeContextMenu.y}
            onClose={() => setEdgeContextMenu(null)}
            onRemove={() => handleRemoveEdge(edgeContextMenu.edgeId)}
          />
        )}

        {/* Image Context Menu */}
        {imageContextMenu && (() => {
          const node = nodes.find(n => n.id === imageContextMenu.nodeId);
          if (!node) return null;

          // Check if node has media
          const media = getMediaFromNodeForCopy(node);
          if (!media) return null;

          const imageUrl = media.mediaUrl;
          const isLiked = (node.data as any).isLiked || (node.data as any).mockup?.isLiked || false;

          // Use appropriate handlers
          const isOutputNode = node.type === 'output';

          const onLike = isOutputNode ? handleOutputLike : handleImageLike;
          const onDownload = handleDownload;
          const onExport = handleImageExport;
          const onFullscreen = handleFullscreen;
          const onCopy = handleCopy;
          const onCopyPNG = handleCopyPNG;
          const onEditWithPrompt = handleEditWithPrompt;
          const onDelete = handleImageNodeDelete;
          const onDuplicate = handleDuplicate;
          const onDescribe = isOutputNode ? undefined : handleImageDescribe;

          return (
            <ImageContextMenu
              x={imageContextMenu.x}
              y={imageContextMenu.y}
              onClose={() => setImageContextMenu(null)}
              onLike={onLike}
              onDownload={onDownload}
              onExport={onExport}
              onFullscreen={onFullscreen}
              onCopy={onCopy}
              onCopyPNG={onCopyPNG}
              onDescribe={onDescribe}
              onEditWithPrompt={onEditWithPrompt}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              imageUrl={imageUrl}
              isLiked={isLiked}
            />
          );
        })()}

        {/* Node Context Menu */}
        {nodeContextMenu && (
          <NodeContextMenu
            x={nodeContextMenu.x}
            y={nodeContextMenu.y}
            onClose={() => setNodeContextMenu(null)}
            onDuplicate={handleNodeDuplicate}
            onDelete={handleNodeDelete}
          />
        )}

        {/* Migration Modal */}
        <ConfirmationModal
          isOpen={showMigrationModal}
          onClose={handleMigrationDiscard}
          onConfirm={handleMigrationSave}
          title={t('canvas.saveCanvasProject')}
          message={t('canvas.unsavedCanvasProject')}
          confirmText={t('canvas.saveProject')}
          cancelText={t('canvas.discard')}
          variant="info"
        />

        {/* Export Panel */}
        {exportPanel && (
          <ExportPanel
            isOpen={!!exportPanel}
            onClose={() => setExportPanel(null)}
            nodeId={exportPanel.nodeId}
            nodeName={exportPanel.nodeName}
            imageUrl={exportPanel.imageUrl}
            nodeType={exportPanel.nodeType}
          />
        )}
      </div>

      {/* Share Modal */}
      {projectId && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          projectId={projectId}
          shareId={shareId}
          isCollaborative={isCollaborative}
          canEdit={canEdit}
          canView={canView}
          onShareUpdate={async () => {
            // Reload project to get updated share info
            if (projectId) {
              try {
                const project = await canvasApi.getById(projectId);
                setShareId(project.shareId || null);
                setIsCollaborative(project.isCollaborative || false);
                setCanEdit(Array.isArray(project.canEdit) ? project.canEdit : []);
                setCanView(Array.isArray(project.canView) ? project.canView : []);
              } catch (error) {
                if (isLocalDevelopment()) {
                  console.error('Failed to reload project:', error);
                }
              }
            }
          }}

        />
      )}

      {/* Branding Project Selection Modal */}
      {projectModalNodeId && (
        <BrandingProjectSelectModal
          isOpen={showProjectModal}
          onClose={() => {
            setShowProjectModal(false);
            setProjectModalNodeId(null);
          }}
          onSelectProject={async (projectId: string) => {
            if (projectModalNodeId) {
              const node = nodes.find(n => n.id === projectModalNodeId);
              if (node && node.type === 'strategy') {
                const strategyData = node.data as StrategyNodeData;
                // Load project using the handler from StrategyNode
                try {
                  const { brandingApi } = await import('../services/brandingApi');
                  const project = await brandingApi.getById(projectId);

                  // Convert BrandingData to StrategyNodeData format
                  const convertedStrategyData: any = {};

                  if (typeof project.data.marketResearch === 'string') {
                    convertedStrategyData.marketResearch = {
                      mercadoNicho: project.data.mercadoNicho || '',
                      publicoAlvo: project.data.publicoAlvo || '',
                      posicionamento: project.data.posicionamento || '',
                      insights: project.data.insights || '',
                    };
                  } else if (project.data.marketResearch && typeof project.data.marketResearch === 'object') {
                    convertedStrategyData.marketResearch = project.data.marketResearch;
                  } else if (project.data.mercadoNicho || project.data.publicoAlvo || project.data.posicionamento || project.data.insights) {
                    convertedStrategyData.marketResearch = {
                      mercadoNicho: project.data.mercadoNicho || '',
                      publicoAlvo: project.data.publicoAlvo || '',
                      posicionamento: project.data.posicionamento || '',
                      insights: project.data.insights || '',
                    };
                  }

                  if (project.data.persona) convertedStrategyData.persona = project.data.persona;
                  if (project.data.archetypes) convertedStrategyData.archetypes = project.data.archetypes;
                  if (project.data.competitors && Array.isArray(project.data.competitors) && project.data.competitors.length > 0) {
                    convertedStrategyData.competitors = project.data.competitors;
                  }
                  if (project.data.references && Array.isArray(project.data.references) && project.data.references.length > 0) {
                    convertedStrategyData.references = project.data.references;
                  }
                  if (project.data.swot) convertedStrategyData.swot = project.data.swot;
                  if (project.data.colorPalettes && Array.isArray(project.data.colorPalettes) && project.data.colorPalettes.length > 0) {
                    convertedStrategyData.colorPalettes = project.data.colorPalettes;
                  }
                  if (project.data.visualElements && Array.isArray(project.data.visualElements) && project.data.visualElements.length > 0) {
                    convertedStrategyData.visualElements = project.data.visualElements;
                  }
                  if (project.data.mockupIdeas && Array.isArray(project.data.mockupIdeas) && project.data.mockupIdeas.length > 0) {
                    convertedStrategyData.mockupIdeas = project.data.mockupIdeas;
                  }
                  if (project.data.moodboard) convertedStrategyData.moodboard = project.data.moodboard;

                  if (strategyData.onUpdateData) {
                    strategyData.onUpdateData(projectModalNodeId, {
                      prompt: project.prompt,
                      strategyData: convertedStrategyData,
                      projectId: project._id || (project as any).id,
                    });
                  }

                  toast.success(t('canvas.projectLoadedSuccessfully'));
                } catch (error: any) {
                  if (isLocalDevelopment()) {
                    console.error('Failed to load project:', error);
                  }
                  toast.error(error?.message || t('canvas.failedToLoadProject'), { duration: 3000 });
                }
              }
            }
            setShowProjectModal(false);
            setProjectModalNodeId(null);
          }}
          onCreateNew={() => {
            if (projectModalNodeId) {
              // Clear the node data to show create new form
              setNodes((nds) => {
                return nds.map((n) => {
                  if (n.id === projectModalNodeId && n.type === 'strategy') {
                    const strategyData = n.data as StrategyNodeData;
                    // Update to show create new form
                    if (strategyData.onUpdateData) {
                      // Use onUpdateData to trigger node re-render
                      setTimeout(() => {
                        strategyData.onUpdateData?.(projectModalNodeId, {
                          prompt: '',
                          strategyData: undefined,
                          projectId: undefined,
                        });
                      }, 0);
                    }
                    return {
                      ...n,
                      data: {
                        ...strategyData,
                        prompt: '',
                        strategyData: undefined,
                        projectId: undefined,
                      } as StrategyNodeData,
                    };
                  }
                  return n;
                });
              });
            }
            setShowProjectModal(false);
            setProjectModalNodeId(null);
          }}
        />
      )}

      {/* Auth Modal - shown when user is not authenticated, overlaid on canvas */}
      {showAuthModal && isAuthenticated === false && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => {
              // Don't allow closing without authentication - redirect to canvas list
              navigate('/canvas');
            }}
            onSuccess={() => {
              setShowAuthModal(false);
              // Project will reload automatically when isAuthenticated becomes true
            }}
            isSignUp={false}
          />
        </div>
      )}

      {/* Shader Controls Sidebar - Only show when a ShaderNode is selected */}
      {(() => {
        const selectedShaderNode = nodes.find(
          (node) => node.type === 'shader' && node.selected === true
        ) as Node<ShaderNodeData> | undefined;

        return selectedShaderNode ? (
          <div className="fixed right-4 top-[81px] z-40 flex flex-col gap-2">
            <ShaderControlsSidebar
              isCollapsed={isShaderSidebarCollapsed}
              onToggleCollapse={() => setIsShaderSidebarCollapsed(!isShaderSidebarCollapsed)}
              nodeData={selectedShaderNode.data}
              nodeId={selectedShaderNode.id}
              onUpdateData={selectedShaderNode.data.onUpdateData}
              variant="stacked"
            />
          </div>
        ) : null;
      })()}

      {/* Canvas Toolbar - Always visible, independent from ShaderControlsSidebar */}
      <div className="fixed left-4 top-[81px] z-40">
        <CanvasToolbar
          variant="stacked"
          position="left"
          selectedNodesCount={nodes.filter(n => n.selected).length}
          experimentalMode={experimentalMode}
          onAddMerge={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            const newNodeId = addMergeNode();
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddEdit={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            const newNodeId = addPromptNode();
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddUpscale={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            const newNodeId = addUpscaleNode();
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddMockup={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeId: string | undefined;
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeId = addMockupNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddAngle={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeId: string | undefined;
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeId = addAngleNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddTexture={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeId: string | undefined;
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeId = addTextureNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddAmbience={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeId: string | undefined;
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeId = addAmbienceNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddLuminance={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeId: string | undefined;
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeId = addLuminanceNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddBrandKit={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeIds: string[] = [];
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeIds = addBrandKitNodes({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeIds.length > 0 && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                selectedNodes[0].id && newNodeIds.forEach(newNodeId => {
                  onConnect({
                    source: selectedNodes[0].id,
                    target: newNodeId,
                  } as any);
                });
              }, 100);
            }
          }}
          onAddLogo={() => {
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                addLogoNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
          }}
          onAddPDF={() => {
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                addPDFNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
          }}
          onAddStrategy={() => {
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                addStrategyNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
          }}
          onAddBrandCore={() => {
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                addBrandCoreNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
          }}
          onAddChat={() => {
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                addChatNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
          }}
          onAddPrompt={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeId: string | undefined;
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeId = addPromptNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
          onAddColorExtractor={() => {
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                addColorExtractorNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
          }}
          onAddShader={() => {
            const selectedNodes = nodes.filter(n => n.selected);
            let newNodeId: string | undefined;
            if (reactFlowInstance) {
              const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
              if (pane) {
                newNodeId = addShaderNode({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
              }
            }
            if (newNodeId && selectedNodes.length > 0 && onConnect) {
              setTimeout(() => {
                onConnect({
                  source: selectedNodes[0].id,
                  target: newNodeId,
                } as any);
              }, 100);
            }
          }}
        />
      </div>
    </>
  );
};

// Collaborative Canvas Component (wrapped in RoomProvider)
const CollaborativeCanvas: React.FC<{
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  handleNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  onConnectStart: any;
  onConnectEnd: any;
  onNodeDragStart: any;
  onNodeDragStop: any;
  onPaneContextMenu: any;
  onNodeContextMenu: any;
  onEdgeClick: any;
  onEdgeContextMenu: any;
  nodeTypes: any;
  setReactFlowInstance: any;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  projectId: string;
  isCollaborative: boolean;
  setNodes: any;
  setEdges: any;
  saveImmediately: () => Promise<void>;
  onOthersCountChange?: (count: number) => void;
  backgroundColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  showMinimap?: boolean;
  showControls?: boolean;
  onDropImage?: (image: UploadedImage, position: { x: number; y: number }) => void;
  onDropNode?: (nodeType: string, position: { x: number; y: number }) => void;
  onAddColorExtractor?: (position?: { x: number; y: number }) => void;
  experimentalMode?: boolean;
}> = ({
  nodes,
  edges,
  handleNodesChange,
  onEdgesChange,
  onConnect,
  onConnectStart,
  onConnectEnd,
  onNodeDragStart,
  onNodeDragStop,
  onPaneContextMenu,
  onNodeContextMenu,
  onEdgeClick,
  onEdgeContextMenu,
  nodeTypes,
  setReactFlowInstance,
  reactFlowWrapper,
  projectId,
  isCollaborative,
  setNodes,
  setEdges,
  saveImmediately,
  onOthersCountChange,
  backgroundColor = '#121212',
  gridColor = 'rgba(255, 255, 255, 0.1)',
  showGrid = true,
  showMinimap = true,
  showControls = true,
  onDropImage,
  onDropNode,
  onAddColorExtractor,
  experimentalMode = false,
}) => {
    const { t } = useTranslation();
    const [reactFlowInstance, setReactFlowInstanceLocal] = React.useState<ReactFlowInstance | null>(null);
    const draggingNodeIdRef = React.useRef<string | null>(null);
    const lastPresenceUpdateRef = React.useRef<{ nodeId: string; x: number; y: number } | null>(null);

    // Use collaboration hook inside RoomProvider
    const {
      others,
      updateNodePositionInPresence,
      clearNodePositionInPresence,
      isNodeBeingMovedByOthers,
    } = useCanvasCollaboration({
      projectId,
      isCollaborative,
      nodes,
      edges,
      setNodes,
      setEdges,
      onSave: saveImmediately,
    });

    // Update others count
    React.useEffect(() => {
      if (onOthersCountChange) {
        onOthersCountChange(others?.length || 0);
      }
    }, [others, onOthersCountChange]);

    const handleInit = (instance: ReactFlowInstance) => {
      setReactFlowInstanceLocal(instance);
      setReactFlowInstance(instance);
    };

    // Enhanced onNodeDragStart with conflict prevention
    // Note: ReactFlow doesn't pass node in onNodeDragStart, so we'll detect it in onNodesChange
    const handleNodeDragStart = React.useCallback(() => {
      // Call original handler - actual node detection happens in handleNodesChangeWithPresence
      onNodeDragStart();
    }, [onNodeDragStart]);

    // Enhanced handleNodesChange to update presence during drag
    const handleNodesChangeWithPresence = React.useCallback((changes: any[]) => {
      // Detect drag start: if we see a position change and no node is currently being dragged
      if (!draggingNodeIdRef.current) {
        const positionChange = changes.find((change) => change.type === 'position' && change.position);
        if (positionChange) {
          const nodeId = positionChange.id;
          const node = nodes.find((n) => n.id === nodeId);

          if (node) {
            // Check if another user is already moving this node
            const conflict = isNodeBeingMovedByOthers(nodeId);
            if (conflict.isMoving) {
              // Prevent drag by reverting the position change
              const moveMessage = conflict.userName
                ? t('canvas.nodeBeingMovedBy', { userName: conflict.userName })
                : t('canvas.nodeBeingMovedByAnother');
              toast.error(moveMessage, { duration: 2000 });
              // Revert the position change by setting it back to the original position
              const revertChange = {
                ...positionChange,
                position: node.position,
              };
              const revertedChanges = changes.map((c) => (c.id === nodeId && c.type === 'position' ? revertChange : c));
              handleNodesChange(revertedChanges);
              return;
            }

            // Mark that we're dragging this node
            draggingNodeIdRef.current = nodeId;

            // Update presence to indicate we're moving this node
            updateNodePositionInPresence(nodeId, node.position.x, node.position.y);
            lastPresenceUpdateRef.current = { nodeId, x: node.position.x, y: node.position.y };
          }
        }
      }

      // Apply changes
      handleNodesChange(changes);

      // Check if any change is a position update during drag
      if (draggingNodeIdRef.current) {
        const positionChange = changes.find(
          (change) =>
            change.type === 'position' &&
            change.id === draggingNodeIdRef.current &&
            change.position
        );

        if (positionChange && positionChange.position) {
          const { x, y } = positionChange.position;
          const lastUpdate = lastPresenceUpdateRef.current;

          // Throttle updates: only update if position changed significantly (more than 5px)
          if (
            !lastUpdate ||
            lastUpdate.nodeId !== draggingNodeIdRef.current ||
            Math.abs(lastUpdate.x - x) > 5 ||
            Math.abs(lastUpdate.y - y) > 5
          ) {
            updateNodePositionInPresence(draggingNodeIdRef.current, x, y);
            lastPresenceUpdateRef.current = { nodeId: draggingNodeIdRef.current, x, y };
          }
        }
      }
    }, [handleNodesChange, updateNodePositionInPresence, isNodeBeingMovedByOthers, nodes, t]);

    // Enhanced onNodeDragStop to clear presence
    const handleNodeDragStop = React.useCallback(() => {
      // Clear presence
      if (draggingNodeIdRef.current) {
        clearNodePositionInPresence();
        draggingNodeIdRef.current = null;
        lastPresenceUpdateRef.current = null;
      }

      // Call original handler
      onNodeDragStop();
    }, [clearNodePositionInPresence, onNodeDragStop]);

    // Cleanup on unmount
    React.useEffect(() => {
      return () => {
        if (draggingNodeIdRef.current) {
          clearNodePositionInPresence();
          draggingNodeIdRef.current = null;
          lastPresenceUpdateRef.current = null;
        }
      };
    }, [clearNodePositionInPresence]);

    return (
      <>
        <SEO
          title={t('canvas.seoTitle')}
          description={t('canvas.seoDescription')}
          noindex={true}
        />
        <CanvasFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChangeWithPresence}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={(e, node) => onNodeContextMenu(e, node)}
          onEdgeClick={onEdgeClick}
          onEdgeContextMenu={onEdgeContextMenu}
          onAddColorExtractor={onAddColorExtractor}
          experimentalMode={experimentalMode}
          nodeTypes={nodeTypes as any}
          onInit={handleInit}
          reactFlowWrapper={reactFlowWrapper}
          backgroundColor={backgroundColor}
          gridColor={gridColor}
          showGrid={showGrid}
          showMinimap={showMinimap}
          showControls={showControls}
          onDropImage={onDropImage}
          onDropNode={onDropNode}
          reactFlowInstance={reactFlowInstance}

        />
        {reactFlowInstance && reactFlowWrapper.current && (
          <CollaborativeCursors
            reactFlowInstance={reactFlowInstance}
            reactFlowWrapper={reactFlowWrapper}
            nodes={nodes}
          />
        )}
      </>
    );
  };
