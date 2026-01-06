import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FlowNodeData, ShaderNodeData } from '../../types/reactFlow';
import type { ReactFlowInstance } from '../../types/reactflow-instance';
import { cn } from '../../lib/utils';
import { fileToBase64 } from '../../utils/fileUtils';
import { toast } from 'sonner';
import type { UploadedImage } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import {
  isValidDroppableNodeType,
  MAX_IMAGE_FILE_SIZE,
  MAX_IMAGE_FILE_SIZE_MB,
  formatFileSize,
  isValidMediaFile,
  getMediaType
} from '../../utils/canvasConstants';
import { DrawingLayer } from './DrawingLayer';


interface CanvasFlowProps {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (params: any) => void;
  onConnectStart?: (event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId?: string | null }) => void;
  onConnectEnd?: (event: MouseEvent | TouchEvent) => void;
  onNodeDragStart?: () => void;
  onNodeDragStop: () => void;
  onPaneContextMenu: (event: React.MouseEvent) => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: Node<FlowNodeData>) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  nodeTypes: any;
  onInit: (instance: ReactFlowInstance) => void;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  backgroundColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  showMinimap?: boolean;
  showControls?: boolean;
  onDropImage?: (image: UploadedImage, position: { x: number; y: number }) => void;
  onDropNode?: (nodeType: string, position: { x: number; y: number }) => void;
  reactFlowInstance?: ReactFlowInstance | null;
  cursorColor?: string;
  onAddColorExtractor?: (position?: { x: number; y: number }) => void;
  experimentalMode?: boolean;
  isDrawingMode?: boolean;
  drawingType?: 'freehand' | 'text' | 'shape';
  onDrawingStart?: (event: React.MouseEvent | React.TouchEvent) => void;
  onDrawingMove?: (event: React.MouseEvent | React.TouchEvent) => void;
  onDrawingEnd?: () => void;
  currentPathData?: string;
  isDrawing?: boolean;
  drawings?: any[];
  selectedDrawingIds?: Set<string>;
  onDrawingClick?: (id: string) => void;
  selectionBox?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null;
  activeTool?: string;
  onSelectionBoxStart?: (position: { x: number; y: number }) => void;
  onSelectionBoxUpdate?: (position: { x: number; y: number }) => void;
  onSelectionBoxEnd?: () => void;
  editingDrawingId?: string | null;
  onStartEditingText?: (id: string) => void;
  onUpdateDrawingText?: (id: string, text: string) => void;
  onStopEditingText?: () => void;
  onCreateTextDrawing?: (position: { x: number; y: number }) => void;
  onUpdateDrawingBounds?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  // Shape preview props
  shapePreview?: {
    startPosition: { x: number; y: number } | null;
    currentPosition: { x: number; y: number } | null;
    shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
    shapeColor?: string;
    shapeStrokeColor?: string;
    shapeStrokeWidth?: number;
    shapeFill?: boolean;
  } | null;
}

export const CanvasFlow: React.FC<CanvasFlowProps> = ({
  nodes,
  edges,
  onNodesChange,
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
  onInit,
  reactFlowWrapper,
  backgroundColor = '#121212',
  gridColor = 'rgba(255, 255, 255, 0.1)',
  showGrid = true,
  showMinimap = true,
  showControls = true,
  onDropImage,
  onDropNode,
  reactFlowInstance,
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
  onDrawingClick,
  selectionBox = null,
  activeTool = 'select',
  onSelectionBoxStart,
  onSelectionBoxUpdate,
  onSelectionBoxEnd,
  editingDrawingId = null,
  onStartEditingText,
  onUpdateDrawingText,
  onStopEditingText,
  onCreateTextDrawing,
  onUpdateDrawingBounds,
  shapePreview = null,
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isShaderSidebarCollapsed, setIsShaderSidebarCollapsed] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0, fileName: '' });
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showCreateIndicator, setShowCreateIndicator] = useState(false);
  const [createIndicatorPos, setCreateIndicatorPos] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isConnecting, setIsConnecting] = useState(false);

  // Panning logic:
  // - Space pressed OR hand tool active: Enable panning with Left Click (0) and Middle Click (1)
  // - Always: Enable panning with Middle (1)
  // - Right Click (2) is reserved for Context Menu ONLY
  const [spacePressed, setSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Only set if not focusing an input (optional but good practice)
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          setSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const panOnDrag = useMemo(() => {
    // Enable pan with left click if space is pressed OR hand tool is active
    if (spacePressed || activeTool === 'hand') return [0, 1];
    return [1];
  }, [spacePressed, activeTool]);

  // Selection only works when select tool is active
  // When space is pressed OR hand tool is active, we want left click to pan, so we disable selection
  // Disable ReactFlow's native node selection - we use custom selection box for drawings only
  const isPanMode = spacePressed || activeTool === 'hand';
  const selectionOnDrag = false; // Disabled - using custom selection box for drawings
  // Also disable panOnScroll when space is not pressed if we want to be strict, but usually panOnScroll is distinct.
  // The user asked for "pan only with space pressed OR with right/middle mouse click".
  // This usually refers to DRAG panning. Scroll wheel panning is often acceptable/separate, but standard behavior usually leaves it enabled.
  // We will stick to drag behaviors as requested.

  const handleNodeDragStart = () => {
    setIsDragging(true);
    onNodeDragStart?.();
  };

  const handleNodeDragStop = () => {
    setIsDragging(false);
    onNodeDragStop();
  };

  // Store reactFlowInstance in ref for use in drop handler
  useEffect(() => {
    if (reactFlowInstance) {
      reactFlowInstanceRef.current = reactFlowInstance;
    }
  }, [reactFlowInstance]);

  // Monitor zoom changes to keep handles and edges at fixed size
  useEffect(() => {
    if (!reactFlowInstance) return;

    const updateZoom = () => {
      try {
        const viewport = reactFlowInstance.getViewport?.();
        if (viewport && typeof viewport.zoom === 'number') {
          setZoom(viewport.zoom);
        }
      } catch (error) {
        // Ignore errors
      }
    };

    // Set initial zoom
    updateZoom();
  }, [reactFlowInstance]);

  // Handler for viewport changes (zoom/pan) - more efficient than interval
  const handleMove = useCallback(() => {
    if (!reactFlowInstanceRef.current) return;
    try {
      const viewportData = reactFlowInstanceRef.current.getViewport?.();
      if (viewportData && typeof viewportData.zoom === 'number') {
        setZoom(viewportData.zoom);
        setViewport({
          x: viewportData.x || 0,
          y: viewportData.y || 0,
          zoom: viewportData.zoom,
        });
      }
    } catch (error) {
      // Ignore errors
    }
  }, []);

  // Handle drag and drop of images and toolbar nodes
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't show drop feedback if user is actively interacting (dragging nodes, drawing, or selecting)
    if (isDragging || isDrawing || selectionBox) {
      return;
    }
    
    const hasToolbarNode = e.dataTransfer.types.includes('application/vsn-toolbar-node') ||
      e.dataTransfer.types.includes('text/plain');

    if (hasToolbarNode) {
      setIsDraggingOver(true);
      e.dataTransfer.dropEffect = 'copy';
      return;
    }

    // Check if files are valid media files before showing feedback
    const hasFiles = e.dataTransfer.types.includes('Files');
    if (hasFiles && e.dataTransfer.items) {
      // Check if at least one file is valid media
      const items = Array.from(e.dataTransfer.items);
      const hasValidMedia = items.some(item => {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          return file && isValidMediaFile(file);
        }
        return false;
      });

      if (hasValidMedia) {
        setIsDraggingOver(true);
        e.dataTransfer.dropEffect = 'copy';
      }
    }
  }, [isDragging, isDrawing, selectionBox]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging over to false if we're leaving the main container
    if (e.currentTarget === reactFlowWrapper.current) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    // Don't process drop if user is actively interacting (dragging nodes, drawing, or selecting)
    if (isDragging || isDrawing || selectionBox) {
      return;
    }

    if (!reactFlowInstanceRef.current) return;

    const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
    if (!pane) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    // Convert screen position to flow position
    let position;
    try {
      position = reactFlowInstanceRef.current.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });
      if (!position || isNaN(position.x) || isNaN(position.y)) {
        position = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error('Error converting screen position to flow position:', error);
      position = { x: 0, y: 0 };
    }

    // Check if this is a toolbar node drop
    const toolbarNodeType = e.dataTransfer.getData('application/vsn-toolbar-node') ||
      e.dataTransfer.getData('text/plain');

    if (toolbarNodeType && onDropNode) {
      // Validate it's a known node type using the shared helper
      if (isValidDroppableNodeType(toolbarNodeType)) {
        onDropNode(toolbarNodeType, position);
        return;
      } else {
        // Show error for invalid node type
        toast.error(t('canvas.invalidNodeType', { nodeType: toolbarNodeType }), { duration: 3000 });
        return;
      }
    }

    // Otherwise, handle as media file drop (image, video, or PDF)
    if (!onDropImage) return;

    // Filter files to only include valid media files
    const files = Array.from(e.dataTransfer.files).filter(file => isValidMediaFile(file));

    if (files.length === 0) {
      return;
    }

    // Show loading state
    setIsProcessingFiles(true);
    setProcessingProgress({ current: 0, total: files.length, fileName: '' });

    // Process each dropped media file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mediaType = getMediaType(file);
      
      // Update progress with file name
      setProcessingProgress({ current: i + 1, total: files.length, fileName: file.name });

      try {
        // Validate file size using shared constant
        if (file.size > MAX_IMAGE_FILE_SIZE) {
          toast.error(
            t('canvas.imageTooLargeDetailed', {
              fileName: file.name,
              size: formatFileSize(file.size),
              limit: formatFileSize(MAX_IMAGE_FILE_SIZE)
            }),
            { duration: 5000 }
          );
          continue;
        }

        // Only process images for now (video and PDF support can be added later)
        if (mediaType === 'image') {
          // Convert to base64
          const imageData = await fileToBase64(file);

          // Call the callback to create image node
          onDropImage(imageData, position);

          // Offset position slightly for multiple files
          position = {
            x: position.x + 50,
            y: position.y + 50,
          };
        } else if (mediaType === 'video' || mediaType === 'pdf') {
          // TODO: Add support for video and PDF nodes
          toast.info(t('canvas.mediaTypeNotSupported', { mediaType, fileName: file.name }), { duration: 3000 });
        }
      } catch (error: any) {
        console.error('Error processing dropped media:', error);
        const errorMessage = error?.message || t('common.error');
        toast.error(t('canvas.failedToProcessImageWithName', { fileName: file.name, errorMessage }), { duration: 5000 });
      }
    }

    // Hide loading state
    setIsProcessingFiles(false);
    setProcessingProgress({ current: 0, total: 0, fileName: '' });
  }, [onDropImage, onDropNode, reactFlowWrapper, isDragging, isDrawing, selectionBox, t]);

  // Find selected ShaderNode (but not UpscaleBicubicNode - it has its own type)
  const selectedShaderNode = useMemo(() => {
    return nodes.find(
      (node) => node.type === 'shader' && node.selected === true
    ) as Node<ShaderNodeData> | undefined;
  }, [nodes]);

  // Add event listener for right-click on edges (ReactFlow doesn't have onEdgeContextMenu)
  useEffect(() => {
    if (!onEdgeContextMenu) return;

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if the click is on an edge element
      const edgeElement = target.closest('.react-flow__edge');
      if (edgeElement) {
        event.preventDefault();
        event.stopPropagation();

        // Try different ways to find the edge ID
        let edgeId = edgeElement.getAttribute('data-id') ||
          edgeElement.getAttribute('id') ||
          edgeElement.getAttribute('data-edge-id');

        // If no direct ID, try to extract from class name or other attributes
        if (!edgeId) {
          // ReactFlow may use id format like "react-flow__edge-{edgeId}"
          const idAttr = edgeElement.id;
          if (idAttr && idAttr.includes('react-flow__edge-')) {
            edgeId = idAttr.replace('react-flow__edge-', '');
          }
        }

        // Also try to find by checking the path element inside the edge
        if (!edgeId) {
          const pathElement = edgeElement.querySelector('path');
          if (pathElement) {
            edgeId = pathElement.getAttribute('data-id') ||
              pathElement.getAttribute('id');
          }
        }

        if (edgeId) {
          const edge = edges.find(e => e.id === edgeId);
          if (edge) {
            onEdgeContextMenu(event as any, edge);
          }
        }
      }
    };

    const wrapper = reactFlowWrapper.current;
    if (wrapper) {
      wrapper.addEventListener('contextmenu', handleContextMenu);
      return () => {
        wrapper.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [onEdgeContextMenu, edges, reactFlowWrapper]);

  const sidebarWidth = selectedShaderNode ? (isShaderSidebarCollapsed ? 48 : 320) : 0;
  // Account for floating sidebar: width + right margin (16px) + spacing (16px)
  const sidebarSpace = sidebarWidth > 0 ? sidebarWidth + 32 : 0;

  // Enhanced onConnectStart to show indicator
  const handleConnectStart = useCallback((event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId?: string | null }) => {
    if (params.nodeId) {
      setIsConnecting(true);
      setShowCreateIndicator(true);
      const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
      if (pane) {
        const rect = pane.getBoundingClientRect();
        const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
        const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;
        setCreateIndicatorPos({
          x: clientX - rect.left,
          y: clientY - rect.top,
        });
      }
    }
    onConnectStart?.(event, params);
  }, [onConnectStart, reactFlowWrapper]);

  // Enhanced onConnectEnd to hide indicator
  const handleConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    setIsConnecting(false);
    setShowCreateIndicator(false);
    onConnectEnd?.(event);
  }, [onConnectEnd]);

  // Update indicator position during mouse move
  useEffect(() => {
    if (!showCreateIndicator) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
      if (!pane) return;
      
      const rect = pane.getBoundingClientRect();
      setCreateIndicatorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [showCreateIndicator, reactFlowWrapper]);

  // Selection box handlers (when not in drawing mode and tool is select)
  const [isSelecting, setIsSelecting] = useState(false);
  
  const handleSelectionMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start selection box if connecting or if clicking on a handle
    if (isConnecting) return;
    
    if (!isDrawingMode && activeTool === 'select' && reactFlowInstance && e.button === 0) {
      const target = e.target as HTMLElement;
      // Check if we're clicking on a handle - if so, don't start selection box
      if (target.closest('.react-flow__handle')) {
        return; // Let ReactFlow handle the connection
      }
      // Check if we're clicking on a drawing - if so, don't start selection box
      if (target.closest('path, rect, circle, line, foreignObject')) {
        return; // Let the drawing handle the click
      }
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      if (position && !isNaN(position.x) && !isNaN(position.y)) {
        setIsSelecting(true);
        onSelectionBoxStart?.(position);
      }
    }
  }, [isDrawingMode, activeTool, reactFlowInstance, onSelectionBoxStart, isConnecting]);

  const handleSelectionMouseMove = useCallback((e: React.MouseEvent) => {
    // Don't update selection box if connecting
    if (isConnecting) {
      if (isSelecting) {
        setIsSelecting(false);
        onSelectionBoxEnd?.();
      }
      return;
    }
    
    if (isSelecting && !isDrawingMode && activeTool === 'select' && reactFlowInstance) {
      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      if (position && !isNaN(position.x) && !isNaN(position.y)) {
        onSelectionBoxUpdate?.(position);
      }
    }
  }, [isSelecting, isDrawingMode, activeTool, reactFlowInstance, onSelectionBoxUpdate, isConnecting, onSelectionBoxEnd]);

  const handleSelectionMouseUp = useCallback(() => {
    if (isSelecting) {
      setIsSelecting(false);
      onSelectionBoxEnd?.();
    }
  }, [isSelecting, onSelectionBoxEnd]);

  // Drawing handlers
  const handleDrawingMouseDown = useCallback((e: React.MouseEvent) => {
    // Simplified type tool: click to create text directly
    if (activeTool === 'type' && onCreateTextDrawing && reactFlowInstance && e.button === 0) {
      const target = e.target as HTMLElement;
      // Don't create text if clicking on existing drawings or nodes
      if (target.closest('path, rect, circle, line, foreignObject, .react-flow__node')) {
        return;
      }
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      if (position && !isNaN(position.x) && !isNaN(position.y)) {
        onCreateTextDrawing(position);
      }
      return;
    }

    if (isDrawingMode && onDrawingStart) {
      onDrawingStart(e);
    } else if (activeTool !== 'draw' && activeTool !== 'type') {
      handleSelectionMouseDown(e);
    }
  }, [isDrawingMode, activeTool, onDrawingStart, handleSelectionMouseDown, onCreateTextDrawing, reactFlowInstance]);

  const handleDrawingMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDrawingMode && isDrawing && onDrawingMove) {
      onDrawingMove(e);
    } else {
      handleSelectionMouseMove(e);
    }
  }, [isDrawingMode, isDrawing, onDrawingMove, handleSelectionMouseMove]);

  const handleDrawingMouseUp = useCallback(() => {
    if (isDrawingMode && isDrawing && onDrawingEnd) {
      onDrawingEnd();
    } else {
      handleSelectionMouseUp();
    }
  }, [isDrawingMode, isDrawing, onDrawingEnd, handleSelectionMouseUp]);

  const handleDrawingMouseLeave = useCallback(() => {
    if (isDrawingMode && isDrawing && onDrawingEnd) {
      onDrawingEnd();
    }
  }, [isDrawingMode, isDrawing, onDrawingEnd]);

  // Touch handlers for drawing
  const handleDrawingTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDrawingMode && onDrawingStart) {
      onDrawingStart(e);
    }
  }, [isDrawingMode, onDrawingStart]);

  const handleDrawingTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDrawingMode && isDrawing && onDrawingMove) {
      onDrawingMove(e);
    }
  }, [isDrawingMode, isDrawing, onDrawingMove]);

  const handleDrawingTouchEnd = useCallback(() => {
    if (isDrawingMode && isDrawing && onDrawingEnd) {
      onDrawingEnd();
    }
  }, [isDrawingMode, isDrawing, onDrawingEnd]);

  // Memoized custom cursor SVG - only recalculate when cursorColor changes
  // Hotspot at tip of arrow: approximately (5.5, 3.2) based on SVG path starting point
  const customCursorSvg = useMemo(() => {
    const encodedColor = encodeURIComponent(cursorColor);
    return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${encodedColor}" stroke="%23000" stroke-width="1.5" d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"></path></svg>') 5.5 3.2, auto`;
  }, [cursorColor]);

  // Memoized pencil cursor SVG for drawing/shapes
  const pencilCursorSvg = useMemo(() => {
    const encodedColor = encodeURIComponent(cursorColor);
    return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${encodedColor}" stroke="%23000" stroke-width="0.5" d="M18.37 2.29a1 1 0 0 0-1.41 0L15.54 3.71l2.83 2.83 1.42-1.42a1 1 0 0 0 0-1.41l-2.12-2.12a1 1 0 0 0-.3-.2zm-15.71 15.7l11.31-11.3 2.83 2.83L5.49 20.82a1 1 0 0 1-1.41 0l-2.12-2.12a1 1 0 0 1 0-1.41z"></path></svg>') 2 20, auto`;
  }, [cursorColor]);

  // Check if we're in drawing mode (freehand or shapes)
  const isDrawingOrShapes = isDrawingMode && (drawingType === 'freehand' || drawingType === 'shape');
  
  // Check if type tool is active
  const isTypeTool = activeTool === 'type' || drawingType === 'text';

  // Memoize cursor CSS to avoid recalculating on every render
  const cursorCss = useMemo(() => {
    if (isTypeTool) {
      return 'text';
    }
    if (isDrawingOrShapes) {
      return pencilCursorSvg;
    }
    return spacePressed || activeTool === 'hand' ? 'grab' : customCursorSvg;
  }, [spacePressed, activeTool, customCursorSvg, pencilCursorSvg, isDrawingOrShapes, isTypeTool]);

  const cursorActiveCss = useMemo(() => {
    if (isTypeTool) {
      return 'text';
    }
    if (isDrawingOrShapes) {
      return pencilCursorSvg;
    }
    return spacePressed || activeTool === 'hand' ? 'grabbing' : customCursorSvg;
  }, [spacePressed, activeTool, customCursorSvg, pencilCursorSvg, isDrawingOrShapes, isTypeTool]);

  return (
    <div
      ref={reactFlowWrapper}
      className={cn(
        "w-full h-full transition-all duration-300 ease-in-out relative",
        isDragging && "is-dragging",
      )}
      style={{
        marginRight: `${sidebarSpace}px`,
        backgroundColor: backgroundColor,
        // Maintain custom cursor during selection box
        cursor: isSelecting && !isDrawingMode && activeTool === 'select' && !spacePressed
          ? customCursorSvg
          : isTypeTool
          ? 'text'
          : isDrawingOrShapes
          ? pencilCursorSvg
          : undefined,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseDown={handleDrawingMouseDown}
      onMouseMove={handleDrawingMouseMove}
      onMouseUp={handleDrawingMouseUp}
      onMouseLeave={handleDrawingMouseLeave}
      onTouchStart={handleDrawingTouchStart}
      onTouchMove={handleDrawingTouchMove}
      onTouchEnd={handleDrawingTouchEnd}
    >
      {/* Drag-over overlay with clear visual feedback */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-[9999] pointer-events-none flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center animate-pulse">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center bg-gradient-to-br from-brand-cyan to-blue-500 shadow-[0_0_40px_color-mix(in_srgb,var(--brand-cyan)_60%,transparent)]">
              <svg
                className="w-16 h-16 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2 text-brand-cyan">
              {t('canvas.dropHere')}
            </h3>
            <p className="text-white/80">
              {t('canvas.dropHint')}
            </p>
          </div>
          {/* Animated border */}
          <div className="absolute inset-4 rounded-lg pointer-events-none border-[3px] border-dashed border-brand-cyan animate-[dash_20s_linear_infinite]" />
        </div>
      )}

      {/* File processing overlay */}
      {isProcessingFiles && (
        <div className="absolute inset-0 z-[9999] pointer-events-none flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full border-4 border-t-brand-cyan border-r-brand-cyan border-b-transparent border-l-transparent animate-spin" />
            <h3 className="text-xl font-bold mb-2 text-brand-cyan">
              {t('canvas.processingFiles')}
            </h3>
            <p className="text-white/80">
              {t('canvas.processingProgress', {
                current: processingProgress.current,
                total: processingProgress.total
              })}
            </p>
            {processingProgress.fileName && (
              <p className="text-sm text-white/60 mt-1 truncate max-w-[200px] mx-auto">
                {processingProgress.fileName}
              </p>
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
      `}</style>
      <style key={`cursor-${cursorColor}-${spacePressed}-${activeTool}-${isDrawingOrShapes}-${isTypeTool}`}>{`
        .react-flow__node {
          overflow: visible !important;
        }
        .react-flow__node-image {
          overflow: visible !important;
        }
        .react-flow__node > div {
          overflow: visible !important;
        }
        .react-flow__node button,
        .react-flow__node select,
        .react-flow__node textarea,
        .react-flow__node input,
        .react-flow__node [role="button"],
        .react-flow__node .relative {
          pointer-events: auto !important;
          z-index: 10 !important;
          position: relative !important;
        }
        .react-flow__node select {
          z-index: 20 !important;
        }
        .react-flow__node.dragging button,
        .react-flow__node.dragging select,
        .react-flow__node.dragging textarea,
        .react-flow__node.dragging input,
        .react-flow__node.dragging [role="button"] {
          pointer-events: none !important;
        }
        /* Garantir que elementos interativos sempre recebam eventos (exceto handles que têm regra própria) */
        .react-flow__node > *:not(.react-flow__handle) {
          pointer-events: auto;
        }
        .react-flow__node {
          pointer-events: auto;
        }
        /* Exceção: durante drag, desabilitar pointer events no container mas manter nos elementos interativos */
        .react-flow__node.dragging {
          pointer-events: auto;
        }
        .react-flow__node.dragging > div {
          pointer-events: none;
        }
        .react-flow__node.dragging > div button,
        .react-flow__node.dragging > div select,
        .react-flow__node.dragging > div textarea,
        .react-flow__node.dragging > div input {
          pointer-events: auto !important;
        }
        /* ============================================
           HANDLES - Eventos
           ============================================ */
        .react-flow__handle {
          pointer-events: auto !important;
          z-index: 1000 !important;
        }
        /* Ajusta stroke-width dos edges baseado no zoom - mais grosso ao dar zoom out */
        .react-flow__edge-path {
          stroke-width: ${Math.max(1.5, Math.min(3, 1.5 / Math.max(zoom, 0.25)))} !important;
        }
        .react-flow__edge:hover .react-flow__edge-path {
          stroke-width: ${Math.max(2, Math.min(4, 2 / Math.max(zoom, 0.25)))} !important;
        }
        /* Grid color customization */
        .react-flow__background circle {
          fill: ${gridColor} !important;
        }
        .react-flow__background path {
          stroke: ${gridColor} !important;
        }
        .react-flow__background line {
          stroke: ${gridColor} !important;
        }
        
        /* Cursor logic */
        /* If space is NOT pressed AND hand tool is NOT active, force default cursor on pane (overriding grab from panOnScroll) */
        /* If space IS pressed OR hand tool IS active, we let React Flow handle it (grabbing) or force grab */
        /* Always maintain custom cursor during selection box */
        /* Hotspot positioned at tip of arrow (5.5, 3.2) for pixel-perfect alignment */
        /* Using memoized cursor CSS to avoid lag */
        .react-flow__pane {
          cursor: ${cursorCss} !important;
        }
        .react-flow__pane:active {
           cursor: ${cursorActiveCss} !important;
        }
        
        /* ReactFlow native selection disabled - using custom selection box for drawings */
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onMove={(_, viewport) => {
          setViewport(viewport);
          handleMove();
        }}
        onMoveEnd={(_, viewport) => {
          setViewport(viewport);
          handleMove();
        }}
        nodeTypes={nodeTypes}
        fitView={false}
        attributionPosition="bottom-left"
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
          const initialViewport = instance.getViewport();
          if (initialViewport) {
            setViewport({
              x: initialViewport.x || 0,
              y: initialViewport.y || 0,
              zoom: initialViewport.zoom || 1,
            });
          }
          onInit(instance);
        }}
        deleteKeyCode="Delete"
        nodesDraggable={true}
        nodesConnectable={true}
        nodesFocusable={true}
        multiSelectionKeyCode={['Shift', 'Control']}
        selectNodesOnDrag={false}
        onlyRenderVisibleElements={false}
        minZoom={0.01}
        maxZoom={100}
        style={{ backgroundColor: backgroundColor }}
        // Interactive props
        panOnDrag={panOnDrag}
        selectionOnDrag={selectionOnDrag}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
      >
        {showGrid && <Background gap={16} />}
        {showControls && <Controls />}
        {showMinimap && (
          <MiniMap
            nodeColor="var(--brand-cyan)"
            maskColor="rgba(0, 0, 0, 0.8)"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
            className={cn(
              "transition-opacity duration-300",
              isDragging ? '!opacity-100' : '!opacity-40 hover:!opacity-100'
            )}
          />
        )}
      </ReactFlow>
      
      {/* Drawing layer - persistent SVG drawings */}
      <DrawingLayer
        drawings={drawings}
        currentPathData={currentPathData}
        isDrawing={isDrawing}
        selectedDrawingIds={selectedDrawingIds}
        onDrawingClick={onDrawingClick || (() => {})}
        viewport={viewport}
        strokeColor="var(--brand-cyan)"
        strokeSize={2}
        selectionBox={selectionBox}
        editingDrawingId={editingDrawingId}
        onStartEditingText={onStartEditingText}
        onUpdateDrawingText={onUpdateDrawingText}
        onStopEditingText={onStopEditingText}
        onUpdateDrawingBounds={onUpdateDrawingBounds}
        reactFlowInstance={reactFlowInstance}
        drawingType={drawingType}
        shapePreview={shapePreview}
      />
      
      {/* Create node indicator */}
      {showCreateIndicator && (
        <div
          className="absolute pointer-events-none z-[10000] transition-opacity duration-200 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${createIndicatorPos.x}px`,
            top: `${createIndicatorPos.y}px`,
          }}
        >
          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-brand-cyan/20 border-[1.5px] border-brand-cyan/60 animate-pulse">
            <span className="text-xs font-bold text-brand-cyan leading-none">
              +
            </span>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
      `}</style>
    </div>
  );
};



