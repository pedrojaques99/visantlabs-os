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
import { SavePromptModal } from '../components/reactflow/SavePromptModal';
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
import { CanvasBottomToolbar, type CanvasTool } from '../components/canvas/CanvasBottomToolbar';
import { ContextMenu } from '../components/reactflow/contextmenu/ContextMenu';
import { EdgeContextMenu } from '../components/reactflow/contextmenu/EdgeContextMenu';
import { ImageContextMenu } from '../components/reactflow/contextmenu/ImageContextMenu';
import { NodeContextMenu } from '../components/reactflow/contextmenu/NodeContextMenu';
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
import { CanvasToolbar } from '../components/canvas/CanvasNodeToolbar';
import { useCanvasHeader } from '../components/canvas/CanvasHeaderContext';
import { CanvasFlow } from '../components/canvas/CanvasFlow';
import { UniversalSidePanel } from '../components/canvas/UniversalSidePanel';
import { cleanEdgeHandles, mockupArraysEqual, arraysEqual, getConnectedBrandIdentity, generateNodeId, getImageFromSourceNode, syncConnectedImage, getMediaFromNodeForCopy } from '../utils/canvas/canvasNodeUtils';
import { SEO } from '../components/SEO';
import { toast } from 'sonner';
import type { ReactFlowInstance } from '../types/reactflow-instance';
import { canvasApi } from '../services/canvasApi';
import { MultiExportModal } from '../components/canvas/MultiExportModal';
import { exportImageWithScale } from '../utils/exportUtils';
import { RoomProvider } from '../config/liveblocks';
import { LiveList } from '@liveblocks/client';
import { useCanvasCollaboration } from '../hooks/canvas/useCanvasCollaboration';
import { authService } from '../services/authService';
import { getCanvasSettings, updateCanvasSettings } from '../services/userSettingsService';
import { CollaborativeCursors } from '../components/canvas/CollaborativeCursors';
import { useTranslation } from '../hooks/useTranslation';
import { AuthModal } from '../components/AuthModal';
import { useImageNodeHandlers } from '../hooks/canvas/useImageNodeHandlers';
import { useImmediateR2Upload } from '../hooks/canvas/useImmediateR2Upload';
import { collectR2UrlsForDeletion } from '../hooks/canvas/utils/r2UploadHelpers';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useCanvasDrawing } from '../hooks/canvas/useCanvasDrawing';
import type { UploadedImage } from '../types';

import { SaveWorkflowDialog } from '../components/SaveWorkflowDialog';
import { workflowApi } from '../services/workflowApi';
import type { CanvasWorkflow } from '../services/workflowApi';

import { isLocalDevelopment } from '../utils/env';
import { ExportPanel } from '@/components/ui/ExportPanel';

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
  const canvasHeader = useCanvasHeader();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Log when CanvasPage component mounts
  useEffect(() => {
    if (isLocalDevelopment()) {
      console.log('[CanvasPage] 🎨 Component mounted:', {
        timestamp: new Date().toISOString(),
        isAuthenticated,
        hasAccess,
        isLoadingAccess
      });
    }
  }, []);

  // Handle node creation from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const type = params.get('type');
    const presetId = params.get('presetId');

    if (action === 'createNode' && type && presetId) {
      const validTypes = ['mockup', 'angle', 'texture', 'ambience', 'luminance'];

      if (validTypes.includes(type)) {
        const newNode: Node<FlowNodeData> = {
          id: generateNodeId(type),
          type: type,
          position: {
            x: window.innerWidth / 2 - 160,
            y: window.innerHeight / 2 - 100
          },
          data: {
            selectedPreset: presetId,
            isLoading: false,
          } as any
        };

        setNodes((nds) => nds.concat(newNode));
        toast.success(t('common.nodeCreated') || 'Node created from preset');

        // Clear query params without reloading
        navigate(window.location.pathname, { replace: true });
      }
    }
  }, [navigate, setNodes, t]);

  // Use settings directly from context instead of duplicating state
  const backgroundColor = canvasHeader.backgroundColor;
  const gridColor = canvasHeader.gridColor;
  const showGrid = canvasHeader.showGrid;
  const showMinimap = canvasHeader.showMinimap;
  const showControls = canvasHeader.showControls;
  const cursorColor = canvasHeader.cursorColor;
  const brandCyan = canvasHeader.brandCyan;
  const edgeStyle = canvasHeader.edgeStyle;
  const edgeStrokeWidth = canvasHeader.edgeStrokeWidth;
  // Universal Panel State
  const [isUniversalPanelOpen, setIsUniversalPanelOpen] = useState(false);
  const [openChatNodeId, setOpenChatNodeId] = useState<string | null>(null);
  const chatSidebarRef = useRef<HTMLElement>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  // Chat sidebar dimensions
  const CHAT_SIDEBAR_WIDTH = 400;
  const CHAT_SIDEBAR_COLLAPSED_WIDTH = 56;
  const RESIZER_WIDTH = 8;
  const [showDeleteChatNodeModal, setShowDeleteChatNodeModal] = useState(false);
  const [chatNodeToDelete, setChatNodeToDelete] = useState<string | null>(null);

  // Check screen size for resizer visibility
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sourceNodeId?: string } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [imageContextMenu, setImageContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [userMockups, setUserMockups] = useState<Mockup[]>([]);
  const [exportPanel, setExportPanel] = useState<{ nodeId: string; nodeName: string; imageUrl: string | null; nodeType: string } | null>(null);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // Workflow state

  const [showSaveWorkflow, setShowSaveWorkflow] = useState(false);
  const [showMultiExportModal, setShowMultiExportModal] = useState(false);

  // Save Prompt Modal State
  const [savePromptModalState, setSavePromptModalState] = useState<{
    isOpen: boolean;
    prompt: string;
    initialData?: { name?: string; description?: string };
  }>({
    isOpen: false,
    prompt: '',
  });

  // Load user settings from backend and update context
  useEffect(() => {
    const loadSettings = async () => {
      if (isAuthenticated === true && !isSettingsLoaded) {
        try {
          const settings = await getCanvasSettings();
          if (settings) {
            if (settings.backgroundColor) canvasHeader.setBackgroundColor(settings.backgroundColor);
            if (settings.gridColor) canvasHeader.setGridColor(settings.gridColor);
            if (settings.showGrid !== undefined) canvasHeader.setShowGrid(settings.showGrid);
            if (settings.showMinimap !== undefined) canvasHeader.setShowMinimap(settings.showMinimap);
            if (settings.showControls !== undefined) canvasHeader.setShowControls(settings.showControls);
            if (settings.cursorColor) canvasHeader.setCursorColor(settings.cursorColor);
            if (settings.brandCyan) canvasHeader.setBrandCyan(settings.brandCyan);
            if (settings.experimentalMode !== undefined) canvasHeader.setExperimentalMode(settings.experimentalMode);
            setIsSettingsLoaded(true);
          }
        } catch (error) {
          console.error('Failed to load canvas settings:', error);
        }
      }
    };

    loadSettings();
  }, [isAuthenticated, isSettingsLoaded, canvasHeader]);

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

  // Use experimentalMode directly from context
  const experimentalMode = canvasHeader.experimentalMode;

  // Debounced settings update to backend
  const debouncedUpdateSettings = useDebouncedCallback(async (settings: any) => {
    if (isAuthenticated === true) {
      try {
        await updateCanvasSettings(settings);
      } catch (error) {
        console.error('Failed to update canvas settings on backend:', error);
      }
    }
  }, 1000);

  // Apply brandCyan color to CSS variable when it changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      // Apply the brand cyan color as CSS variable
      // This will override the default oklch value in index.css
      root.style.setProperty('--brand-cyan', brandCyan);
    }
  }, [brandCyan]);



  // Sync selected nodes count and handle Auto-Open Logic
  const setSelectedNodesCountInContext = canvasHeader.setSelectedNodesCount;

  // Track previous selection to avoid unnecessary effect runs
  const prevSelectedNodeIdsRef = useRef<string>('');

  useEffect(() => {
    const selected = nodes.filter(n => n.selected);
    const selectedIds = selected.map(n => n.id).sort().join(',');

    // Always update count
    setSelectedNodesCountInContext(selected.length);

    // Only run auto-open logic if selection actually touched/changed
    if (selectedIds !== prevSelectedNodeIdsRef.current) {
      prevSelectedNodeIdsRef.current = selectedIds;

      // Auto-open panel if a shader node is newly selected
      const hasShader = selected.some(n => n.type === 'shader');
      if (hasShader) {
        setIsUniversalPanelOpen(true);
      }
    }
  }, [nodes, setSelectedNodesCountInContext]);

  // Persist settings to backend (localStorage is handled by context)
  useEffect(() => {
    // Update backend when settings change
    if (isAuthenticated === true) {
      debouncedUpdateSettings({
        backgroundColor,
        gridColor,
        showGrid,
        showMinimap,
        showControls,
        cursorColor,
        brandCyan,
        experimentalMode,
        edgeStyle,
        edgeStrokeWidth,
      });
    }
  }, [backgroundColor, gridColor, showGrid, showMinimap, showControls, cursorColor, brandCyan, experimentalMode, edgeStyle, edgeStrokeWidth, isAuthenticated, debouncedUpdateSettings]);


  // Drawing hook - initialize before history so we can pass drawings to it
  const drawing = useCanvasDrawing(reactFlowInstance);

  // Hooks - initialize history first so it can be used in handlers
  const { addToHistory, handleUndo, handleRedo } = useCanvasHistory(
    nodes,
    edges,
    setNodes,
    setEdges,
    drawing.drawings,
    drawing.setDrawings
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
  }, [t]);

  const handleSavePrompt = useCallback((prompt: string) => {
    setSavePromptModalState({
      isOpen: true,
      prompt,
      initialData: { name: t('canvasNodes.promptNode.savedPromptName') || 'New Prompt' }
    });
  }, [t]);

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
    addToHistory(nodes, edges, drawing.drawings);

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
          addToHistory(newNodes, edges, drawing.drawings);
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
  }, [isAuthenticated, setNodes, nodes, edges, addToHistory, t]);

  const handleDuplicateNodes = useCallback((nodeIds: string[]) => {
    if (!reactFlowInstance || nodeIds.length === 0) return;

    const nodesToDuplicate = nodes.filter(n => nodeIds.includes(n.id));
    if (nodesToDuplicate.length === 0) return;

    addToHistory(nodes, edges, drawing.drawings);

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
        addToHistory(newNodes, edges, drawing.drawings);
      }, 0);
      return newNodes;
    });

    toast.success(t('canvas.nodeDuplicated', {
      count: duplicatedNodes.length,
      plural: duplicatedNodes.length > 1 ? 's' : ''
    }), { duration: 2000 });
  }, [nodes, edges, reactFlowInstance, setNodes, addToHistory, t]);

  const handleDuplicate = useCallback((id: string) => {
    handleDuplicateNodes([id]);
  }, [handleDuplicateNodes]);

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
    // Open the universal panel when export is triggered
    setIsUniversalPanelOpen(true);
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
    setEdges,
    drawing.drawings,
    drawing.setDrawings
  );

  // Log when projectId changes (project loaded)
  useEffect(() => {
    if (isLocalDevelopment() && projectId) {
      console.log('[CanvasPage] 📦 Project ID available:', {
        projectId,
        projectName,
        isCollaborative,
        isLoadingProject,
        timestamp: new Date().toISOString()
      });
    }
  }, [projectId, projectName, isCollaborative, isLoadingProject]);

  // Log when project finishes loading
  useEffect(() => {
    if (isLocalDevelopment() && !isLoadingProject && projectId) {
      console.log('[CanvasPage] ✅ Project fully loaded and ready:', {
        projectId,
        projectName,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        drawingCount: drawing.drawings.length,
        isCollaborative,
        timestamp: new Date().toISOString()
      });
    }
  }, [isLoadingProject, projectId, projectName, nodes.length, edges.length, drawing.drawings.length, isCollaborative]);

  // Poll for project name updates in collaborative mode
  useEffect(() => {
    if (!isCollaborative || !projectId || !isAuthenticated || isLoadingProject) {
      return;
    }

    // Poll every 5 seconds to check for name updates from other users
    const pollInterval = setInterval(async () => {
      try {
        const project = await canvasApi.getById(projectId);
        const latestName = project.name || 'Untitled';

        // Only update if name changed (to avoid unnecessary re-renders)
        if (latestName !== projectName) {
          setProjectName(latestName);
        }
      } catch (error) {
        // Silently fail - don't spam console with errors
        if (isLocalDevelopment()) {
          console.warn('[CanvasPage] Failed to poll project name:', error);
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [isCollaborative, projectId, isAuthenticated, isLoadingProject, projectName, setProjectName]);

  const [isAdminOrPremium, setIsAdminOrPremium] = useState(false);
  const [othersCount, setOthersCount] = useState(0);

  // Sync project name with header context
  // Use ref to track previous value and avoid unnecessary updates
  const previousProjectNameRef = useRef<string>(projectName || '');
  const setProjectNameInContext = canvasHeader.setProjectName;
  useEffect(() => {
    // Only update if projectName actually changed
    if (previousProjectNameRef.current !== projectName) {
      previousProjectNameRef.current = projectName || '';
      setProjectNameInContext(projectName || '');
    }
  }, [projectName, setProjectNameInContext]);

  // Sync project name change handler
  // Use useCallback to prevent handler from being recreated on every render
  // Use ref to access latest projectName without causing re-renders
  const projectNameRef = useRef<string>(projectName || '');
  useEffect(() => {
    projectNameRef.current = projectName || '';
  }, [projectName]);

  const handleProjectNameChange = useCallback(async (newName: string) => {
    // Only update if name actually changed and is not empty
    if (!newName || typeof newName !== 'string') {
      return; // Safety check: ignore undefined/null/non-string values
    }
    const trimmedName = newName.trim();

    // Save any valid name that's different from current (including generic names with timestamps)
    if (trimmedName && trimmedName !== projectNameRef.current) {
      // Update ref immediately so saveImmediately uses the new name
      const previousName = projectNameRef.current;
      projectNameRef.current = trimmedName;

      // Update local state
      setProjectName(trimmedName);

      // Save to database immediately (don't wait for debounce)
      if (projectId && saveImmediately) {
        try {
          // Small delay to ensure state is updated
          await new Promise(resolve => setTimeout(resolve, 50));
          await saveImmediately();
          toast.success(t('canvas.projectNameUpdated'), { duration: 1200 });
        } catch (error) {
          console.error('Failed to save project name:', error);
          toast.error(t('canvas.failedToUpdateProjectName') || 'Failed to update project name', { duration: 3000 });
          // Revert to previous name on error
          projectNameRef.current = previousName;
          setProjectName(previousName);
        }
      } else {
        toast.success(t('canvas.projectNameUpdated'), { duration: 1200 });
      }
    }
  }, [setProjectName, t, projectId, saveImmediately]);

  const setOnProjectNameChangeInContext = canvasHeader.setOnProjectNameChange;
  const setOnExportImagesRequestInContext = canvasHeader.setOnExportImagesRequest;
  const setOnExportAllImagesRequestInContext = canvasHeader.setOnExportAllImagesRequest;

  // Handle multi-export requests
  const handleExportImagesRequest = useCallback(() => {
    setShowMultiExportModal(true);
  }, []);

  const handleExportAllImagesRequest = useCallback(async () => {
    // Collect output images from the canvas
    const imagesToExport: Array<{ url: string; name: string }> = [];

    nodes.forEach(node => {
      let url: string | null = null;
      let name = node.data.label || `${node.type}-${node.id.substring(0, 4)}`;

      // Filter: Only select 'output' nodes or nodes with explicit result data
      if (node.type === 'output') {
        const data = node.data as any;
        url = data.resultImageUrl || (data.resultImageBase64 ? (data.resultImageBase64.startsWith('data:') ? data.resultImageBase64 : `data:image/png;base64,${data.resultImageBase64}`) : null);
        name = data.label || name;
      } else if (['merge', 'edit', 'upscale', 'upscaleBicubic', 'mockup', 'angle', 'prompt', 'shader'].includes(node.type)) {
        // Only include if it has explicit result data
        const data = node.data as any;
        if (data.resultImageUrl || data.resultImageBase64) {
          url = data.resultImageUrl || (data.resultImageBase64 ? (data.resultImageBase64.startsWith('data:') ? data.resultImageBase64 : `data:image/png;base64,${data.resultImageBase64}`) : null);
        }
      }

      if (url) {
        imagesToExport.push({ url, name });
      }
    });

    if (imagesToExport.length === 0) {
      toast.error(t('canvas.noImagesToExport') || 'No output images found to export');
      return;
    }

    // Try using File System Access API for folder selection
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore - showDirectoryPicker is not yet in standard types
        const dirHandle = await window.showDirectoryPicker();

        toast.info((t('canvas.exportingImages') || 'Exporting images...') + ` (${imagesToExport.length})`);

        let savedCount = 0;
        let errorCount = 0;

        const usedNames = new Set<string>();

        for (const img of imagesToExport) {
          try {
            // Fetch blob
            const response = await fetch(img.url);
            const blob = await response.blob();

            // Prepare unique filename
            const safeName = img.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            let baseFilename = safeName || 'image';
            let filename = `${baseFilename}.png`;

            // Handle duplicates
            let counter = 1;
            while (usedNames.has(filename)) {
              filename = `${baseFilename}_${counter}.png`;
              counter++;
            }
            usedNames.add(filename);

            // Create/Get file handle
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            savedCount++;
          } catch (err) {
            console.error(`Failed to save ${img.name}:`, err);
            errorCount++;
          }
        }

        if (savedCount > 0) {
          toast.success((t('canvas.exportComplete') || 'Export complete!') + ` ${savedCount} saved.`);
        }
        if (errorCount > 0) {
          toast.warning(`${errorCount} images failed to save.`);
        }

      } catch (err: any) {
        // User cancelled or API error
        if (err.name !== 'AbortError') {
          console.error('Directory selection failed:', err);
          toast.error(t('canvas.exportFailed') || 'Failed to access folder');
        }
      }
    } else {
      // Fallback to serial download for unsupported browsers
      toast.info((t('canvas.exportingImages') || 'Exporting images...') + ` (${imagesToExport.length})`);

      for (let i = 0; i < imagesToExport.length; i++) {
        const img = imagesToExport[i];
        setTimeout(async () => {
          try {
            await exportImageWithScale(img.url, 'png', 1.5, img.name);
            if (i === imagesToExport.length - 1) {
              toast.success(t('canvas.exportComplete') || 'Export complete!');
            }
          } catch (err) {
            console.error(`Failed to export ${img.name}:`, err);
          }
        }, i * 300);
      }
    }
  }, [nodes, t]);

  useEffect(() => {
    setOnProjectNameChangeInContext(() => handleProjectNameChange);
  }, [handleProjectNameChange, setOnProjectNameChangeInContext]);

  useEffect(() => {
    setOnExportImagesRequestInContext(() => handleExportImagesRequest);
  }, [handleExportImagesRequest, setOnExportImagesRequestInContext]);

  useEffect(() => {
    setOnExportAllImagesRequestInContext(() => handleExportAllImagesRequest);
  }, [handleExportAllImagesRequest, setOnExportAllImagesRequestInContext]);

  // Sync project sharing data to context
  const setProjectIdInContext = canvasHeader.setProjectId;
  const setShareIdInContext = canvasHeader.setShareId;
  const setIsCollaborativeInContext = canvasHeader.setIsCollaborative;
  const setCanEditInContext = canvasHeader.setCanEdit;
  const setCanViewInContext = canvasHeader.setCanView;
  const setOthersCountInContext = canvasHeader.setOthersCount;

  useEffect(() => {
    setProjectIdInContext(projectId || null);
  }, [projectId, setProjectIdInContext]);

  useEffect(() => {
    setShareIdInContext(shareId || null);
  }, [shareId, setShareIdInContext]);

  useEffect(() => {
    setIsCollaborativeInContext(isCollaborative);
  }, [isCollaborative, setIsCollaborativeInContext]);

  useEffect(() => {
    setCanEditInContext(canEdit || []);
  }, [canEdit, setCanEditInContext]);

  useEffect(() => {
    setCanViewInContext(canView || []);
  }, [canView, setCanViewInContext]);

  useEffect(() => {
    setOthersCountInContext(othersCount);
  }, [othersCount, setOthersCountInContext]);



  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalNodeId, setProjectModalNodeId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check if user is admin or premium (still needed for other features)
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
      } else {
        setIsAdminOrPremium(false);
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
    saveImmediately,
    handleSavePrompt
  );

  // Upload imediato de base64 para R2
  useImmediateR2Upload({
    nodes,
    canvasId: projectId,
    isAuthenticated: isAuthenticated === true,
    setNodes,
    handlersRef,
  });

  // Canvas tool state
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);

  // Handle tool changes
  const handleToolChange = useCallback((tool: CanvasTool) => {
    setActiveTool(tool);

    if (tool === 'hand') {
      // Enable pan mode (space key behavior)
      // This is handled by the space key logic in CanvasFlow
    } else if (tool === 'select') {
      // Disable drawing mode
      if (drawing.drawingState.isDrawingMode) {
        drawing.setIsDrawingMode(false);
      }
    } else if (tool === 'draw') {
      // Drawing mode is toggled by onToggleDrawing
    } else if (tool === 'type') {
      // Type tool is independent - does not activate drawing mode
      if (drawing.drawingState.isDrawingMode) {
        drawing.setIsDrawingMode(false);
      }
    } else if (tool === 'shapes') {
      // Set drawing type to shape
      drawing.setDrawingType('shape');
      if (!drawing.drawingState.isDrawingMode) {
        drawing.setIsDrawingMode(true);
      }
    }
  }, [drawing]);

  // Handle drawing type change
  const handleDrawingTypeChange = useCallback((type: 'freehand' | 'text' | 'shape') => {
    drawing.setDrawingType(type);
    if (type === 'text') {
      setActiveTool('type');
    } else if (type === 'shape') {
      setActiveTool('shapes');
    } else {
      setActiveTool('draw');
    }
  }, [drawing]);

  // Handle shape type change
  const handleShapeTypeChange = useCallback((type: 'rectangle' | 'circle' | 'line' | 'arrow') => {
    drawing.setShapeType(type);
  }, [drawing]);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    drawing.setStrokeColor(color);
    drawing.setTextColor(color);
    drawing.setShapeColor(color);
    if (drawing.setShapeStrokeColor) {
      drawing.setShapeStrokeColor(color);
    }
  }, [drawing]);

  // Wrappers for drawing functions that update history
  const handleStopDrawing = useCallback(() => {
    // Add to history before stopping (captures current state)
    addToHistory(nodes, edges, drawing.drawings);
    drawing.stopDrawing();
  }, [drawing, nodes, edges, addToHistory]);

  const handleDeleteSelectedDrawings = useCallback(() => {
    if (drawing.selectedDrawingIds.size > 0) {
      addToHistory(nodes, edges, drawing.drawings);
      drawing.deleteSelectedDrawings();
    }
  }, [drawing, nodes, edges, addToHistory]);

  const handleUpdateDrawingText = useCallback((id: string, newText: string) => {
    // Only add to history if text actually changed
    const drawingToUpdate = drawing.drawings.find(d => d.id === id);
    if (drawingToUpdate && drawingToUpdate.text !== newText) {
      addToHistory(nodes, edges, drawing.drawings);
    }
    drawing.updateDrawingText(id, newText);
  }, [drawing, nodes, edges, addToHistory]);

  // Handle Delete key for drawings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && drawing.selectedDrawingIds.size > 0) {
        e.preventDefault();
        handleDeleteSelectedDrawings();
      }
      // Escape key to stop editing text
      if (e.key === 'Escape' && drawing.editingDrawingId) {
        drawing.stopEditingText();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawing, handleDeleteSelectedDrawings]);

  // Stop editing when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawing.editingDrawingId) {
        const target = e.target as HTMLElement;
        // Check if click is outside the text editor
        if (!target.closest('textarea, .drawing-text-editor')) {
          drawing.stopEditingText();
        }
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [drawing.editingDrawingId, drawing]);

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
    handleDuplicate,
    handlersRef,
    subscriptionStatus,
    nodesRef,
    updateNodeData,
    saveImmediately,
    projectId
  );



  // Register handleSavePrompt in handlersRef for new nodes
  useEffect(() => {
    if (handlersRef.current) {
      handlersRef.current.handleSavePrompt = handleSavePrompt;
    }
  }, [handleSavePrompt, handlersRef]);

  // Inject handleSavePrompt into existing nodes (e.g. on load)
  useEffect(() => {
    const hasPromptNodes = nodes.some(n => n.type === 'prompt');
    if (!hasPromptNodes) return;

    let needsUpdate = false;
    const updatedNodes = nodes.map(node => {
      if (node.type === 'prompt') {
        const promptData = node.data as PromptNodeData;
        if (promptData.onSavePrompt !== handleSavePrompt) {
          needsUpdate = true;
          return {
            ...node,
            data: {
              ...promptData,
              onSavePrompt: handleSavePrompt
            }
          };
        }
      }
      return node;
    });

    if (needsUpdate) {
      setNodes(updatedNodes);
    }
  }, [nodes, handleSavePrompt, setNodes]);

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
    reactFlowInstance,
    {
      addPromptNode,
      addTextNode,
      addStrategyNode,
      addImageNode,
    }
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

  // Duplicate multiple nodes deleted from here since it was moved up

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
    drawing.drawings,
    reactFlowInstance,
    reactFlowWrapper,
    handleDuplicateNodes,
    addMockupNode,
    addPromptNode,
    addUpscaleNode
  );

  usePasteImage(handlePasteImage, isAuthenticated === true);

  // Workflow handlers
  const handleSaveWorkflow = useCallback(async (metadata: {
    name: string;
    description: string;
    category: string;
    tags: string[];
    isPublic: boolean;
  }) => {
    try {
      await workflowApi.create({
        ...metadata,
        nodes,
        edges,
      });

      toast.success(t('workflows.messages.saved') || 'Workflow saved successfully!');
    } catch (error: any) {
      console.error('Error saving workflow:', error);
      toast.error(error.message || t('workflows.errors.failedToSave') || 'Failed to save workflow');
      throw error;
    }
  }, [nodes, edges, t]);

  const handleLoadWorkflow = useCallback((workflow: CanvasWorkflow) => {
    // Add to history before clearing
    addToHistory(nodes, edges, drawing.drawings);

    // Clear current canvas
    setNodes([]);
    setEdges([]);
    drawing.setDrawings([]);

    // Load workflow nodes and edges
    setTimeout(() => {
      setNodes(workflow.nodes as Node<FlowNodeData>[]);
      setEdges(workflow.edges as Edge[]);

      // Add to history after loading
      setTimeout(() => {
        addToHistory(workflow.nodes as Node<FlowNodeData>[], workflow.edges as Edge[], []);
      }, 100);
    }, 50);

    // Increment usage count
    workflowApi.incrementUsage(workflow._id);

    toast.success(t('workflows.messages.loaded') || `Loaded workflow: ${workflow.name}`);
  }, [nodes, edges, drawing, setNodes, setEdges, addToHistory, t]);

  // Expose workflow functions to header context
  const setOnSaveWorkflow = canvasHeader.setOnSaveWorkflow;
  const setOnLoadWorkflow = canvasHeader.setOnLoadWorkflow;

  useEffect(() => {
    if (setOnSaveWorkflow) {
      setOnSaveWorkflow(() => () => setShowSaveWorkflow(true));
    }
  }, [setOnSaveWorkflow]);



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
      data: {
        type: 'image',
        mockup: tempMockup,
        onView: handleView,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onDuplicate: handleDuplicate,
        onUpload: handlersRef.current?.handleUploadImage || (() => { }),
        onResize: handlersRef.current?.handleImageNodeResize || (() => { }),
        addTextNode: addTextNode,
      } as ImageNodeData,
    };

    addToHistory(nodes, edges, drawing.drawings);

    setNodes((nds: Node<FlowNodeData>[]) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        addToHistory(newNodes, edges, drawing.drawings);
      }, 0);
      return newNodes;
    });

    // Upload para R2 será feito automaticamente pelo hook useImmediateR2Upload
    toast.success(t('canvas.imageDropped'), { duration: 2000 });
  }, [reactFlowInstance, handleView, handleEdit, handleDelete, handleDuplicate, nodes, edges, addToHistory, setNodes, handlersRef, addTextNode, t]);

  // Handle drop of toolbar nodes onto canvas
  const handleDropNode = useCallback((nodeType: string, position: { x: number; y: number }) => {
    if (!reactFlowInstance) return;

    // Position is already in flow coordinates from CanvasFlow
    const flowPosition = position;

    // Helper to convert flow coordinates to screen coordinates
    // Most node creation functions expect screen coordinates and convert internally
    const flowToScreen = (flowPos: { x: number; y: number }): { x: number; y: number } => {
      if (reactFlowInstance.getViewport) {
        const viewport = reactFlowInstance.getViewport();
        if (viewport) {
          // Convert flow coordinates to screen coordinates using viewport
          // Formula: screen = (flow * zoom) + viewport offset
          return {
            x: flowPos.x * viewport.zoom + viewport.x,
            y: flowPos.y * viewport.zoom + viewport.y,
          };
        }
      }
      // Fallback: return center of screen
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
        // addMockupNode supports flow coordinates directly via isFlowPosition parameter
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
        // addTextNode supports flow coordinates directly via isFlowPosition parameter
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
    handleDuplicate: handleImageNodeDuplicate,
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
    addToHistory(nodes, edges, drawing.drawings);

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
    addToHistory(nodes, edges, drawing.drawings);

    setEdges((eds: Edge[]) => {
      const edgeToRemove = eds.find(
        e => e.target === nodeId && e.targetHandle === targetHandle
      );

      if (!edgeToRemove) {
        return eds;
      }

      const newEdges = eds.filter(e => e.id !== edgeToRemove.id);

      setTimeout(() => {
        addToHistory(nodes, newEdges, drawing.drawings);
      }, 0);

      return newEdges;
    });
  }, [nodes, edges, setEdges, addToHistory]);

  // Handler to open ChatNode sidebar
  const handleChatOpenSidebar = useCallback((nodeId: string) => {
    setOpenChatNodeId(nodeId);
  }, []);

  // Perform actual node deletion
  const performNodeDeletion = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    addToHistory(nodes, edges);

    // If it's a ChatNode, clear history before deleting
    if (node.type === 'chat') {
      const chatData = node.data as ChatNodeData;
      if (chatData.onClearHistory && chatData.messages && chatData.messages.length > 0) {
        chatData.onClearHistory(nodeId);
      }
    }

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

    // Clear openChatNodeId if the deleted node was the open one
    if (openChatNodeId === nodeId) {
      setOpenChatNodeId(null);
    }

    setNodes(newNodes);
    setEdges(newEdges);

    setTimeout(() => {
      addToHistory(newNodes, newEdges, drawing.drawings);
    }, 0);

    toast.success(t('canvas.nodeDeleted'), { duration: 2000 });
  }, [nodes, edges, setNodes, setEdges, addToHistory, openChatNodeId, setOpenChatNodeId, t]);

  // Handler to delete node by ID (used by NodeContainer delete button)
  const handleDeleteNodeById = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // If it's a ChatNode, show confirmation modal first
    if (node.type === 'chat') {
      setChatNodeToDelete(nodeId);
      setShowDeleteChatNodeModal(true);
      return;
    }

    // For other node types, delete directly
    await performNodeDeletion(nodeId);
  }, [nodes, performNodeDeletion]);

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
        (n.type === 'strategy' && (!(n.data as StrategyNodeData).onOpenProjectModal || !(n.data as StrategyNodeData).onGenerate || !(n.data as StrategyNodeData).onGenerateSection || !(n.data as StrategyNodeData).onGenerateAll || !(n.data as StrategyNodeData).onInitialAnalysis || !(n.data as StrategyNodeData).onCancelGeneration || !(n.data as StrategyNodeData).onGeneratePDF || !(n.data as StrategyNodeData).onSave || !(n.data as StrategyNodeData).onUpdateData || !handlersRef.current?.handleStrategyNodeGenerate || !handlersRef.current?.handleStrategyNodeDataUpdate)) ||
        (n.type === 'brandCore' && (!(n.data as BrandCoreData).onAnalyze || !(n.data as BrandCoreData).onUpdateData || !(n.data as BrandCoreData).onUploadPdfToR2 || !(n.data as BrandCoreData).onCancelAnalyze || !handlersRef.current?.handleBrandCoreAnalyze || !handlersRef.current?.handleBrandCoreDataUpdate || !handlersRef.current?.handleBrandCoreUploadPdfToR2 || !handlersRef.current?.handleBrandCoreCancelAnalyze)) ||
        (n.type === 'chat' && (!(n.data as ChatNodeData).onSendMessage || !(n.data as ChatNodeData).onUpdateData || !(n.data as ChatNodeData).onClearHistory || !(n.data as ChatNodeData).onAddPromptNode || !(n.data as ChatNodeData).onCreateNode || !(n.data as ChatNodeData).onOpenSidebar || !handlersRef.current?.handleChatSendMessage || !handlersRef.current?.handleChatUpdateData))
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

          // Sync connected image using helper (handles all source types)
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
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

          // Sync connected image using helper
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
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

          // Sync connected image using helper
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
          const currentConnectedImage = angleData.connectedImage || undefined;
          const connectedImageChanged = currentConnectedImage !== newConnectedImage;
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
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
          const currentConnectedImage = textureData.connectedImage || undefined;
          const connectedImageChanged = currentConnectedImage !== newConnectedImage;
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
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
          const currentConnectedImage = ambienceData.connectedImage || undefined;
          const connectedImageChanged = currentConnectedImage !== newConnectedImage;
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
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
          const currentConnectedImage = luminanceData.connectedImage || undefined;
          const connectedImageChanged = currentConnectedImage !== newConnectedImage;
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
          // Sync connected image using helper (supports all source types including video)
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
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
          // Sync connected image using helper
          const newConnectedImage = syncConnectedImage(n.id, edges, nds);
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
        if (n.type === 'chat') {
          const chatData = n.data as ChatNodeData;
          const needsUpdate = !chatData.onSendMessage ||
            !chatData.onUpdateData ||
            !chatData.onClearHistory ||
            !chatData.onAddPromptNode ||
            !chatData.onCreateNode ||
            !chatData.onOpenSidebar ||
            !handlersRef.current?.handleChatSendMessage ||
            !handlersRef.current?.handleChatUpdateData;
          if (needsUpdate) {
            hasChanges = true;
            return {
              ...n,
              data: {
                ...chatData,
                // Preserve existing messages and other data
                messages: chatData.messages || [],
                userMessageCount: chatData.userMessageCount || 0,
                model: chatData.model || 'gemini-2.5-flash',
                isLoading: chatData.isLoading || false,
                // Inject callbacks
                onSendMessage: handlersRef.current?.handleChatSendMessage || (() => Promise.resolve()),
                onUpdateData: handlersRef.current?.handleChatUpdateData || (() => { }),
                onClearHistory: handlersRef.current?.handleChatClearHistory || (() => { }),
                onAddPromptNode: handlersRef.current?.handleChatAddPromptNode || (() => { }),
                onCreateNode: handlersRef.current?.handleChatCreateNode || (() => undefined),
                onEditConnectedNode: handlersRef.current?.handleChatEditConnectedNode || (() => { }),
                onAttachMedia: handlersRef.current?.handleChatAttachMedia || (() => undefined),
                onOpenSidebar: handleChatOpenSidebar,
                connectedNodeIds: [],
                onDeleteNode: handleDeleteNodeById,
              } as ChatNodeData,
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
          const needsUpdate = !strategyData.onOpenProjectModal ||
            !strategyData.onGenerate ||
            !strategyData.onGenerateSection ||
            !strategyData.onGenerateAll ||
            !strategyData.onInitialAnalysis ||
            !strategyData.onCancelGeneration ||
            !strategyData.onGeneratePDF ||
            !strategyData.onSave ||
            !strategyData.onUpdateData ||
            !handlersRef.current?.handleStrategyNodeGenerate ||
            !handlersRef.current?.handleStrategyNodeDataUpdate;
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
                onGenerate: handlersRef.current?.handleStrategyNodeGenerate || (() => Promise.resolve()),
                onGenerateSection: handlersRef.current?.handleStrategyNodeGenerateSection || (() => Promise.resolve()),
                onGenerateAll: handlersRef.current?.handleStrategyNodeGenerateAll || (() => Promise.resolve()),
                onInitialAnalysis: handlersRef.current?.handleStrategyNodeInitialAnalysis || (() => Promise.resolve()),
                onCancelGeneration: handlersRef.current?.handleStrategyNodeCancelGeneration || (() => { }),
                onGeneratePDF: handlersRef.current?.handleStrategyNodeGeneratePDF || (() => { }),
                onSave: handlersRef.current?.handleStrategyNodeSave || (() => Promise.resolve(undefined)),
                onUpdateData: handlersRef.current?.handleStrategyNodeDataUpdate || (() => { }),
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
  }, [nodes, edges, setNodes, handleView, handleEdit, handleEditOutput, handleDelete, subscriptionStatus, handlersRef, handleMergeGeneratePrompt, handleMergeNodeDataUpdate, handlePromptNodeDataUpdate, handlePromptRemoveEdge, userMockups, handleBrandKit, handleDeleteNodeById, handleChatOpenSidebar]);

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

          addToHistory(nodes, edges, drawing.drawings);

          const newNode: Node<FlowNodeData> = {
            id: `image-${Date.now()}`,
            type: 'image',
            position,
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

  // Manage openChatNodeId - clear when deleted
  useEffect(() => {
    // Clear openChatNodeId if the node was deleted
    if (openChatNodeId && !nodes.find(n => n.id === openChatNodeId)) {
      setOpenChatNodeId(null);
    }
  }, [nodes, openChatNodeId]);

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

    addToHistory(nodes, edges, drawing.drawings);

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
        addToHistory(newNodes, edges, drawing.drawings);
      }, 0);
      return newNodes;
    });

    toast.success(t('canvas.nodeDuplicatedSingular'), { duration: 2000 });
  }, [nodeContextMenu, nodes, edges, reactFlowInstance, setNodes, addToHistory, t]);


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

        {/* Save Prompt Modal (Moved outside ReactFlow) */}
        <SavePromptModal
          isOpen={savePromptModalState.isOpen}
          onClose={() => setSavePromptModalState(prev => ({ ...prev, isOpen: false }))}
          prompt={savePromptModalState.prompt}
          initialData={savePromptModalState.initialData}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="text-zinc-300 relative overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: backgroundColor, minHeight: '100vh' }}
      >
        <div className="fixed inset-0 z-0" style={{ position: 'relative', opacity: 1, scale: 5 }}>
          <GridDotsBackground />
        </div>

        {/* CanvasHeader is now rendered in Layout component */}

        {/* Main Canvas Container with Sidebar Layout - Starts below header (81px) */}
        <div className="flex relative w-full" style={{ height: 'calc(100vh - 81px)', paddingTop: '0px', justifyContent: 'flex-start' }}>
          {/* Canvas Area - Adjusts width when sidebar is open */}
          <div
            className="flex-1 transition-all duration-300 ease-out relative"
            style={{
              width: '100%',
            }}
          >
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
                  edgeStyle={edgeStyle}
                  edgeStrokeWidth={edgeStrokeWidth}
                  cursorColor={cursorColor}
                  isDrawingMode={drawing.drawingState.isDrawingMode}
                  drawingType={drawing.drawingState.drawingType}
                  onDrawingStart={drawing.startDrawing}
                  onDrawingMove={drawing.draw}
                  onDrawingEnd={handleStopDrawing}
                  currentPathData={drawing.currentPathData}
                  isDrawing={drawing.isDrawing}
                  drawings={drawing.drawings}
                  selectedDrawingIds={drawing.selectedDrawingIds}
                  selectionBox={drawing.selectionBox}
                  activeTool={activeTool}
                  onSelectionBoxStart={drawing.startSelectionBox}
                  onSelectionBoxUpdate={drawing.updateSelectionBox}
                  onSelectionBoxEnd={drawing.endSelectionBox}
                  onDrawingClick={(id: string) => {
                    drawing.setSelectedDrawingId(id);
                  }}
                  editingDrawingId={drawing.editingDrawingId}
                  onStartEditingText={drawing.startEditingText}
                  onUpdateDrawingText={handleUpdateDrawingText}
                  onStopEditingText={drawing.stopEditingText}
                  onCreateTextDrawing={(position) => {
                    addToHistory(nodes, edges, drawing.drawings);
                    drawing.createTextDrawing?.(position);
                  }}
                  onUpdateDrawingBounds={(id, bounds) => {
                    addToHistory(nodes, edges, drawing.drawings);
                    drawing.updateDrawingBounds?.(id, bounds);
                  }}
                  shapePreview={
                    drawing.drawingState.drawingType === 'shape' &&
                      drawing.isDrawing &&
                      drawing.startPosition &&
                      drawing.currentPosition
                      ? {
                        startPosition: drawing.startPosition,
                        currentPosition: drawing.currentPosition,
                        shapeType: drawing.drawingState.shapeType,
                        shapeColor: drawing.drawingState.shapeColor,
                        shapeStrokeColor: drawing.drawingState.shapeStrokeColor,
                        shapeStrokeWidth: drawing.drawingState.shapeStrokeWidth,
                        shapeFill: drawing.drawingState.shapeFill,
                      }
                      : null
                  }
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
                edgeStyle={edgeStyle}
                edgeStrokeWidth={edgeStrokeWidth}
                onAddColorExtractor={addColorExtractorNode}
                isDrawingMode={drawing.drawingState.isDrawingMode}
                drawingType={drawing.drawingState.drawingType}
                onDrawingStart={drawing.startDrawing}
                onDrawingMove={drawing.draw}
                onDrawingEnd={handleStopDrawing}
                currentPathData={drawing.currentPathData}
                isDrawing={drawing.isDrawing}
                drawings={drawing.drawings}
                selectedDrawingIds={drawing.selectedDrawingIds}
                onDrawingClick={(id: string) => {
                  // Handle single click - for now just select single item
                  // Multi-select with Shift/Ctrl can be added later if needed
                  drawing.setSelectedDrawingId(id);
                }}
                selectionBox={drawing.selectionBox}
                activeTool={activeTool}
                onSelectionBoxStart={drawing.startSelectionBox}
                onSelectionBoxUpdate={drawing.updateSelectionBox}
                onSelectionBoxEnd={drawing.endSelectionBox}
                editingDrawingId={drawing.editingDrawingId}
                onStartEditingText={drawing.startEditingText}
                onUpdateDrawingText={handleUpdateDrawingText}
                onStopEditingText={drawing.stopEditingText}
                onCreateTextDrawing={(position) => {
                  addToHistory(nodes, edges, drawing.drawings);
                  drawing.createTextDrawing?.(position);
                }}
                onUpdateDrawingBounds={(id, bounds) => {
                  addToHistory(nodes, edges, drawing.drawings);
                  drawing.updateDrawingBounds?.(id, bounds);
                }}
                shapePreview={
                  drawing.drawingState.drawingType === 'shape' &&
                    drawing.isDrawing &&
                    drawing.startPosition &&
                    drawing.currentPosition
                    ? {
                      startPosition: drawing.startPosition,
                      currentPosition: drawing.currentPosition,
                      shapeType: drawing.drawingState.shapeType,
                      shapeColor: drawing.drawingState.shapeColor,
                      shapeStrokeColor: drawing.drawingState.shapeStrokeColor,
                      shapeStrokeWidth: drawing.drawingState.shapeStrokeWidth,
                      shapeFill: drawing.drawingState.shapeFill,
                    }
                    : null
                }
              />
            )}
          </div>

          {/* Chat Sidebar - Positioned absolutely within flex container */}

        </div>

        {/* Bottom Toolbar */}
        <CanvasBottomToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          onToggleDrawing={() => {
            drawing.setIsDrawingMode(!drawing.drawingState.isDrawingMode);
            if (!drawing.drawingState.isDrawingMode) {
              setActiveTool('draw');
            } else {
              setActiveTool('select');
            }
          }}
          isDrawingMode={drawing.drawingState.isDrawingMode}
          drawingType={drawing.drawingState.drawingType}
          onDrawingTypeChange={handleDrawingTypeChange}
          strokeColor={drawing.drawingState.strokeColor}
          onColorChange={handleColorChange}
          onShapeTypeChange={handleShapeTypeChange}
          shapeType={drawing.drawingState.shapeType}
          fontFamily={drawing.drawingState.fontFamily}
          onFontFamilyChange={(fontFamily) => {
            drawing.setFontFamily(fontFamily);
          }}
          onToggleToolbar={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
          isToolbarCollapsed={isToolbarCollapsed}
        />

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
            nodes={nodes}
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
          const onDuplicate = () => handleDuplicate(imageContextMenu.nodeId);
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
            onDelete={() => nodeContextMenu?.nodeId && handleDeleteNodeById(nodeContextMenu.nodeId)}
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

        {/* Delete ChatNode Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteChatNodeModal}
          onClose={() => {
            setShowDeleteChatNodeModal(false);
            setChatNodeToDelete(null);
          }}
          onConfirm={async () => {
            if (chatNodeToDelete) {
              await performNodeDeletion(chatNodeToDelete);
            }
            setShowDeleteChatNodeModal(false);
            setChatNodeToDelete(null);
          }}
          title={t('canvas.deleteChatNode') || 'Delete Chat Node'}
          message={t('canvas.deleteChatNodeMessage') || 'This will delete the chat node and clear all conversation history. This action cannot be undone.'}
          confirmText={t('canvas.delete') || 'Delete'}
          cancelText={t('canvas.cancel') || 'Cancel'}
          variant="danger"
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

        {/* Workflow Modals */}
        <SaveWorkflowDialog
          isOpen={showSaveWorkflow}
          onClose={() => setShowSaveWorkflow(false)}
          onSave={handleSaveWorkflow}
          nodes={nodes}
          edges={edges}
          t={t}
        />

        <MultiExportModal
          isOpen={showMultiExportModal}
          onClose={() => setShowMultiExportModal(false)}
          nodes={nodes}
          projectName={projectName}
        />
      </div>


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
                  if (isLocalDevelopment()) {
                    console.log(`[CanvasPage] 📂 Loading project from modal`, {
                      projectId,
                      nodeId: projectModalNodeId
                    });
                  }

                  const { brandingApi } = await import('../services/brandingApi');
                  const project = await brandingApi.getById(projectId);

                  if (isLocalDevelopment()) {
                    console.log(`[CanvasPage] 📦 Project loaded from API`, {
                      projectId,
                      projectName: project.name,
                      hasPrompt: !!project.prompt,
                      promptLength: project.prompt?.length || 0,
                      dataKeys: Object.keys(project.data || {}),
                      dataValues: Object.keys(project.data || {}).reduce((acc, key) => {
                        const value = project.data[key];
                        if (Array.isArray(value)) {
                          acc[key] = `Array(${value.length})`;
                        } else if (typeof value === 'object' && value !== null) {
                          acc[key] = `Object(${Object.keys(value).length} keys)`;
                        } else if (typeof value === 'string') {
                          acc[key] = `String(${value.length} chars)`;
                        } else {
                          acc[key] = typeof value;
                        }
                        return acc;
                      }, {} as Record<string, string>),
                      fullData: project.data
                    });
                  }

                  // Convert BrandingData to StrategyNodeData format
                  const convertedStrategyData: any = {};

                  // Handle marketResearch - support multiple formats (same logic as StrategyNode)
                  if (typeof project.data.marketResearch === 'string' && project.data.marketResearch.trim()) {
                    // New format: marketResearch is a string (benchmarking paragraph)
                    convertedStrategyData.marketResearch = project.data.marketResearch;
                    if (isLocalDevelopment()) {
                      console.log(`[CanvasPage] ✅ Converted marketResearch (string)`, {
                        length: project.data.marketResearch.length
                      });
                    }
                  } else if (typeof project.data.marketResearch === 'object' && project.data.marketResearch !== null) {
                    // Object format
                    convertedStrategyData.marketResearch = project.data.marketResearch;
                    if (isLocalDevelopment()) {
                      console.log(`[CanvasPage] ✅ Converted marketResearch (object)`, {
                        keys: Object.keys(project.data.marketResearch)
                      });
                    }
                  } else if (project.data.mercadoNicho || project.data.publicoAlvo || project.data.posicionamento || project.data.insights) {
                    // Old format: separate fields
                    convertedStrategyData.marketResearch = {
                      mercadoNicho: project.data.mercadoNicho || '',
                      publicoAlvo: project.data.publicoAlvo || '',
                      posicionamento: project.data.posicionamento || '',
                      insights: project.data.insights || '',
                    };
                    if (isLocalDevelopment()) {
                      console.log(`[CanvasPage] ✅ Converted marketResearch (old format)`, {
                        hasMercadoNicho: !!project.data.mercadoNicho,
                        hasPublicoAlvo: !!project.data.publicoAlvo,
                        hasPosicionamento: !!project.data.posicionamento,
                        hasInsights: !!project.data.insights
                      });
                    }
                  }

                  // Convert persona
                  if (project.data.persona) {
                    if (typeof project.data.persona === 'object' && project.data.persona !== null) {
                      convertedStrategyData.persona = project.data.persona;
                      if (isLocalDevelopment()) {
                        console.log(`[CanvasPage] ✅ Converted persona`, {
                          hasDemographics: !!project.data.persona.demographics,
                          desiresCount: Array.isArray(project.data.persona.desires) ? project.data.persona.desires.length : 0,
                          painsCount: Array.isArray(project.data.persona.pains) ? project.data.persona.pains.length : 0
                        });
                      }
                    }
                  }

                  // Convert archetypes
                  if (project.data.archetypes) {
                    if (typeof project.data.archetypes === 'object' && project.data.archetypes !== null) {
                      convertedStrategyData.archetypes = project.data.archetypes;
                      if (isLocalDevelopment()) {
                        console.log(`[CanvasPage] ✅ Converted archetypes`, {
                          hasPrimary: !!project.data.archetypes.primary,
                          hasSecondary: !!project.data.archetypes.secondary,
                          hasReasoning: !!project.data.archetypes.reasoning
                        });
                      }
                    }
                  }

                  // Convert array sections
                  const arraySections = ['competitors', 'references', 'colorPalettes', 'visualElements', 'mockupIdeas'] as const;
                  arraySections.forEach(key => {
                    if (project.data[key] !== undefined && project.data[key] !== null) {
                      if (Array.isArray(project.data[key])) {
                        if (project.data[key].length > 0) {
                          convertedStrategyData[key] = project.data[key];
                          if (isLocalDevelopment()) {
                            console.log(`[CanvasPage] ✅ Converted ${key}`, {
                              count: project.data[key].length
                            });
                          }
                        } else if (isLocalDevelopment()) {
                          console.log(`[CanvasPage] ⚠️ Skipped ${key} (empty array)`);
                        }
                      } else if (isLocalDevelopment()) {
                        console.log(`[CanvasPage] ⚠️ Skipped ${key} (not an array)`, {
                          type: typeof project.data[key]
                        });
                      }
                    }
                  });

                  // Convert object sections
                  const objectSections = ['swot', 'moodboard'] as const;
                  objectSections.forEach(key => {
                    if (project.data[key] !== undefined && project.data[key] !== null) {
                      if (typeof project.data[key] === 'object') {
                        convertedStrategyData[key] = project.data[key];
                        if (isLocalDevelopment()) {
                          console.log(`[CanvasPage] ✅ Converted ${key}`, {
                            keys: Object.keys(project.data[key])
                          });
                        }
                      } else if (isLocalDevelopment()) {
                        console.log(`[CanvasPage] ⚠️ Skipped ${key} (not an object)`, {
                          type: typeof project.data[key]
                        });
                      }
                    }
                  });

                  const convertedKeys = Object.keys(convertedStrategyData);
                  if (isLocalDevelopment()) {
                    console.log(`[CanvasPage] 🔄 Converting project data`, {
                      projectId,
                      nodeId: projectModalNodeId,
                      convertedSections: convertedKeys,
                      sectionsCount: convertedKeys.length,
                      convertedData: convertedStrategyData
                    });
                  }

                  if (strategyData.onUpdateData) {
                    if (isLocalDevelopment()) {
                      console.log(`[CanvasPage] 🔄 Calling onUpdateData`, {
                        projectId,
                        nodeId: projectModalNodeId,
                        prompt: project.prompt || '',
                        name: project.name || '',
                        strategyDataKeys: Object.keys(convertedStrategyData),
                        strategyDataCount: Object.keys(convertedStrategyData).length,
                        convertedStrategyData
                      });
                    }

                    strategyData.onUpdateData(projectModalNodeId, {
                      prompt: project.prompt || '',
                      name: project.name || '',
                      strategyData: convertedStrategyData,
                      projectId: project._id || (project as any).id,
                    });

                    if (isLocalDevelopment()) {
                      console.log(`[CanvasPage] ✅ onUpdateData called successfully`, {
                        projectId,
                        nodeId: projectModalNodeId
                      });
                    }
                  } else {
                    if (isLocalDevelopment()) {
                      console.error(`[CanvasPage] ❌ onUpdateData not available`, {
                        projectId,
                        nodeId: projectModalNodeId,
                        hasStrategyData: !!strategyData,
                        strategyDataKeys: strategyData ? Object.keys(strategyData) : []
                      });
                    }
                  }

                  if (isLocalDevelopment()) {
                    console.log(`[CanvasPage] ✅ Project loaded successfully from modal`, {
                      projectId,
                      nodeId: projectModalNodeId,
                      projectName: project.name,
                      sectionsLoaded: convertedKeys.length,
                      hasData: convertedKeys.length > 0,
                      convertedSections: convertedKeys
                    });
                  }

                  toast.success(t('canvas.projectLoadedSuccessfully'));
                } catch (error: any) {
                  if (isLocalDevelopment()) {
                    console.error(`[CanvasPage] ❌ Failed to load project from modal`, {
                      projectId,
                      nodeId: projectModalNodeId,
                      error: error?.message || error,
                      stack: error?.stack
                    });
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

      {/* Universal Side Panel */}
      <UniversalSidePanel
        selectedNodes={nodes.filter(n => n.selected)}
        isOpen={isUniversalPanelOpen}
        onClose={() => {
          setIsUniversalPanelOpen(false);
          setExportPanel(null);
        }}
        onUpdateNode={updateNodeData}
        overridePanel={exportPanel ? {
          type: 'export',
          data: exportPanel,
          onClose: () => {
            setExportPanel(null);
            // If no nodes selected, close panel too. If nodes selected, go back to tabs?
            // For simplified UX, if export was open via override, closing it goes back to default state.
          }
        } : null}
      />

      {/* Save Prompt Modal */}
      <SavePromptModal
        isOpen={savePromptModalState.isOpen}
        onClose={() => setSavePromptModalState(prev => ({ ...prev, isOpen: false }))}
        prompt={savePromptModalState.prompt}
        initialData={savePromptModalState.initialData}
      />

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
          onToggleDrawing={() => {
            drawing.setIsDrawingMode(!drawing.drawingState.isDrawingMode);
          }}
          isDrawingMode={drawing.drawingState.isDrawingMode}
          isCollapsed={isToolbarCollapsed}
          onCollapseChange={setIsToolbarCollapsed}
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
  edgeStyle?: 'solid' | 'dashed';
  edgeStrokeWidth?: 'normal' | 'thin';
  cursorColor?: string;
  isDrawingMode?: boolean;
  drawingType?: 'freehand' | 'text' | 'shape';
  onDrawingStart?: (event: React.MouseEvent | React.TouchEvent) => void;
  onDrawingMove?: (event: React.MouseEvent | React.TouchEvent) => void;
  onDrawingEnd?: () => void;
  currentPathData?: string;
  isDrawing?: boolean;
  drawings?: any[];
  selectedDrawingIds?: Set<string>;
  selectionBox?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null;
  activeTool?: string;
  onSelectionBoxStart?: (position: { x: number; y: number }) => void;
  onSelectionBoxUpdate?: (position: { x: number; y: number }) => void;
  onSelectionBoxEnd?: () => void;
  onDrawingClick?: (id: string) => void;
  editingDrawingId?: string | null;
  onStartEditingText?: (id: string) => void;
  onUpdateDrawingText?: (id: string, text: string) => void;
  onStopEditingText?: () => void;
  onCreateTextDrawing?: (position: { x: number; y: number }) => void;
  onUpdateDrawingBounds?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  shapePreview?: {
    startPosition: { x: number; y: number } | null;
    currentPosition: { x: number; y: number } | null;
    shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
    shapeColor?: string;
    shapeStrokeColor?: string;
    shapeStrokeWidth?: number;
    shapeFill?: boolean;
  } | null;
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
  edgeStyle = 'solid',
  edgeStrokeWidth = 'normal',
  cursorColor = '#FFFFFF',
  isDrawingMode = false,
  drawingType = 'freehand',
  onDrawingStart,
  onDrawingMove,
  onDrawingEnd,
  currentPathData = '',
  isDrawing = false,
  drawings = [],
  selectedDrawingIds = new Set(),
  selectionBox = null,
  activeTool = 'select',
  onSelectionBoxStart,
  onSelectionBoxUpdate,
  onSelectionBoxEnd,
  onDrawingClick,
  editingDrawingId = null,
  onStartEditingText,
  onUpdateDrawingText,
  onStopEditingText,
  onCreateTextDrawing,
  onUpdateDrawingBounds,
  shapePreview = null,
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
          edgeStyle={edgeStyle}
          edgeStrokeWidth={edgeStrokeWidth}
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
          cursorColor={cursorColor}
          isDrawingMode={isDrawingMode}
          drawingType={drawingType}
          onDrawingStart={onDrawingStart}
          onDrawingMove={onDrawingMove}
          onDrawingEnd={onDrawingEnd}
          currentPathData={currentPathData}
          isDrawing={isDrawing}
          drawings={drawings}
          selectedDrawingIds={selectedDrawingIds}
          selectionBox={selectionBox}
          activeTool={activeTool}
          onSelectionBoxStart={onSelectionBoxStart}
          onSelectionBoxUpdate={onSelectionBoxUpdate}
          onSelectionBoxEnd={onSelectionBoxEnd}
          onDrawingClick={onDrawingClick}
          editingDrawingId={editingDrawingId}
          onStartEditingText={onStartEditingText}
          onUpdateDrawingText={onUpdateDrawingText}
          onStopEditingText={onStopEditingText}
          onCreateTextDrawing={onCreateTextDrawing}
          onUpdateDrawingBounds={onUpdateDrawingBounds}
          shapePreview={shapePreview}
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
