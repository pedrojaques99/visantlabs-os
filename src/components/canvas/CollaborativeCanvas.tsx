import React, { useEffect, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import type { ReactFlowInstance } from '@/types/reactflow-instance';
import type { UploadedImage } from '@/types/types';
import { useCanvasCollaboration } from '@/hooks/canvas/useCanvasCollaboration';
import { useCanvasHeader } from './CanvasHeaderContext';
import { useTranslation } from '@/hooks/useTranslation';
import { CanvasFlow } from './CanvasFlow';
import { CollaborativeCursors } from './CollaborativeCursors';
import { SEO } from '../SEO';

export interface CollaborativeCanvasProps {
  // Core React Flow state
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;

  // Event handlers
  handleNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: any) => void;
  onConnectStart: (event: any, params: any) => void;
  onConnectEnd: (event: any) => void;
  onNodeDragStart: () => void;
  onNodeDragStop: () => void;
  onPaneContextMenu: (event: any) => void;
  onNodeContextMenu: (event: any, node: any) => void;
  onEdgeClick: (event: any, edge: any) => void;
  onEdgeContextMenu: (event: any, edge: any) => void;

  // Node types and instance
  nodeTypes: any;
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;

  // Collaboration
  projectId: string;
  isCollaborative: boolean;
  saveImmediately: () => Promise<void>;
  onOthersCountChange?: (count: number) => void;

  // Drop handlers
  onDropImage?: (image: UploadedImage, position: { x: number; y: number }) => void;
  onDropNode?: (nodeType: string, position: { x: number; y: number }) => void;
  onAddColorExtractor?: (position?: { x: number; y: number }) => void;

  // Drawing props
  isDrawingMode?: boolean;
  drawingType?: 'freehand' | 'text' | 'shape';
  onDrawingStart?: (event: React.MouseEvent | React.TouchEvent) => void;
  onDrawingMove?: (event: React.MouseEvent | React.TouchEvent) => void;
  onDrawingEnd?: () => void;
  currentPathData?: string;
  isDrawing?: boolean;
  drawings?: any[];
  selectedDrawingIds?: Set<string>;
  selectionBox?: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
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
}

export const CollaborativeCanvas: React.FC<CollaborativeCanvasProps> = ({
  nodes,
  edges,
  setNodes,
  setEdges,
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
  saveImmediately,
  onOthersCountChange,
  onDropImage,
  onDropNode,
  onAddColorExtractor,
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

  // Get settings from context instead of props
  const {
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
  } = useCanvasHeader();

  // Use collaboration hook with presence tracking
  const {
    others,
    createPresenceEnhancedHandlers,
  } = useCanvasCollaboration({
    projectId,
    isCollaborative,
    nodes,
    edges,
    setNodes,
    setEdges,
    onSave: saveImmediately,
  });

  // Create presence-enhanced handlers
  const presenceHandlers = useMemo(
    () => createPresenceEnhancedHandlers(
      nodes,
      handleNodesChange,
      onNodeDragStart,
      onNodeDragStop,
      t
    ),
    [nodes, handleNodesChange, onNodeDragStart, onNodeDragStop, t, createPresenceEnhancedHandlers]
  );

  // Update others count
  useEffect(() => {
    if (onOthersCountChange) {
      onOthersCountChange(others?.length || 0);
    }
  }, [others, onOthersCountChange]);

  const handleInit = (instance: ReactFlowInstance) => {
    setReactFlowInstanceLocal(instance);
    setReactFlowInstance(instance);
  };

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
        onNodesChange={presenceHandlers.handleNodesChangeWithPresence}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={presenceHandlers.handleNodeDragStart}
        onNodeDragStop={presenceHandlers.handleNodeDragStop}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={(e, node) => onNodeContextMenu(e, node)}
        onEdgeClick={onEdgeClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onAddColorExtractor={onAddColorExtractor}
        experimentalMode={experimentalMode}
        edgeStyle={edgeStyle}
        edgeStrokeWidth={edgeStrokeWidth}
        nodeTypes={nodeTypes}
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
        brandCyan={brandCyan || undefined}
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

export default CollaborativeCanvas;
