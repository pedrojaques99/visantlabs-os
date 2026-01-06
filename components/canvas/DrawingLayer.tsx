import React from 'react';
import type { DrawingStroke } from '../../hooks/canvas/useCanvasDrawing';
import { cn } from '../../lib/utils';
import { DrawingTextRenderer } from '../reactflow/shared/DrawingTextRenderer';

interface DrawingLayerProps {
  drawings: DrawingStroke[];
  currentPathData: string;
  isDrawing: boolean;
  selectedDrawingIds: Set<string>;
  onDrawingClick: (id: string) => void;
  viewport: { x: number; y: number; zoom: number };
  strokeColor: string;
  strokeSize: number;
  selectionBox?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null;
  editingDrawingId?: string | null;
  onStartEditingText?: (id: string) => void;
  onUpdateDrawingText?: (id: string, text: string) => void;
  onStopEditingText?: () => void;
  onUpdateDrawingBounds?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  reactFlowInstance?: any;
  // Shape preview props
  drawingType?: 'freehand' | 'text' | 'shape';
  shapePreview?: {
    startPosition: { x: number; y: number };
    currentPosition: { x: number; y: number };
    shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
    shapeColor?: string;
    shapeStrokeColor?: string;
    shapeStrokeWidth?: number;
    shapeFill?: boolean;
  } | null;
}

export const DrawingLayer: React.FC<DrawingLayerProps> = ({
  drawings,
  currentPathData,
  isDrawing,
  selectedDrawingIds,
  onDrawingClick,
  viewport,
  strokeColor,
  strokeSize,
  selectionBox,
  editingDrawingId = null,
  onStartEditingText,
  onUpdateDrawingText,
  onStopEditingText,
  onUpdateDrawingBounds,
  reactFlowInstance,
  drawingType = 'freehand',
  shapePreview = null,
}) => {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState<{ x: number; y: number } | null>(null);
  const [resizingId, setResizingId] = React.useState<string | null>(null);
  const [resizeStart, setResizeStart] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [resizeHandle, setResizeHandle] = React.useState<string | null>(null);

  // Drag handlers for text
  const handleTextMouseDown = React.useCallback((e: React.MouseEvent, drawing: DrawingStroke) => {
    if (editingDrawingId === drawing.id) return; // Don't drag while editing
    
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest('.resize-handle')) return; // Don't start drag on resize handle
    
    const startX = (e.clientX - viewport.x) / viewport.zoom;
    const startY = (e.clientY - viewport.y) / viewport.zoom;
    
    setDraggingId(drawing.id);
    setDragOffset({
      x: startX - drawing.bounds.x,
      y: startY - drawing.bounds.y,
    });
  }, [editingDrawingId, viewport]);

  // Resize handlers
  const handleResizeMouseDown = React.useCallback((e: React.MouseEvent, drawing: DrawingStroke, handle: string) => {
    e.stopPropagation();
    setResizingId(drawing.id);
    setResizeHandle(handle);
    setResizeStart({
      x: drawing.bounds.x,
      y: drawing.bounds.y,
      width: drawing.bounds.width,
      height: drawing.bounds.height,
    });
  }, []);

  // Global mouse move handler
  React.useEffect(() => {
    if (!draggingId && !resizingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!reactFlowInstance || !onUpdateDrawingBounds) return;

      const flowPos = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      if (draggingId && dragOffset) {
        const newBounds = {
          x: flowPos.x - dragOffset.x,
          y: flowPos.y - dragOffset.y,
          width: drawings.find(d => d.id === draggingId)?.bounds.width || 200,
          height: drawings.find(d => d.id === draggingId)?.bounds.height || 60,
        };
        onUpdateDrawingBounds(draggingId, newBounds);
      } else if (resizingId && resizeStart && resizeHandle) {
        const drawing = drawings.find(d => d.id === resizingId);
        if (!drawing) return;

        let newBounds = { ...resizeStart };

        switch (resizeHandle) {
          case 'se': // southeast
            newBounds.width = Math.max(50, flowPos.x - resizeStart.x);
            newBounds.height = Math.max(30, flowPos.y - resizeStart.y);
            break;
          case 'sw': // southwest
            newBounds.x = Math.min(flowPos.x, resizeStart.x + resizeStart.width - 50);
            newBounds.width = Math.max(50, resizeStart.x + resizeStart.width - flowPos.x);
            newBounds.height = Math.max(30, flowPos.y - resizeStart.y);
            break;
          case 'ne': // northeast
            newBounds.y = Math.min(flowPos.y, resizeStart.y + resizeStart.height - 30);
            newBounds.width = Math.max(50, flowPos.x - resizeStart.x);
            newBounds.height = Math.max(30, resizeStart.y + resizeStart.height - flowPos.y);
            break;
          case 'nw': // northwest
            newBounds.x = Math.min(flowPos.x, resizeStart.x + resizeStart.width - 50);
            newBounds.y = Math.min(flowPos.y, resizeStart.y + resizeStart.height - 30);
            newBounds.width = Math.max(50, resizeStart.x + resizeStart.width - flowPos.x);
            newBounds.height = Math.max(30, resizeStart.y + resizeStart.height - flowPos.y);
            break;
        }

        onUpdateDrawingBounds(resizingId, newBounds);
      }
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setDragOffset(null);
      setResizingId(null);
      setResizeStart(null);
      setResizeHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, dragOffset, resizingId, resizeStart, resizeHandle, drawings, reactFlowInstance, onUpdateDrawingBounds]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-[9998]"
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <g
        transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
      >
        {/* Saved drawings */}
        {drawings.map((drawing) => {
          if (drawing.type === 'freehand' && drawing.pathData) {
            return (
              <g key={drawing.id}>
                <path
                  d={drawing.pathData}
                  fill={drawing.color}
                  stroke={drawing.color}
                  strokeWidth={drawing.size}
                  className={cn(
                    'pointer-events-auto cursor-pointer transition-opacity',
                    selectedDrawingIds.has(drawing.id) ? 'opacity-80' : 'opacity-100'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDrawingClick(drawing.id);
                  }}
                  style={{
                    filter: selectedDrawingIds.has(drawing.id) 
                      ? 'drop-shadow(0 0 4px rgba(82, 221, 235, 0.8))' 
                      : 'none',
                  }}
                />
                {/* Selection indicator */}
                {selectedDrawingIds.has(drawing.id) && (
                  <rect
                    x={drawing.bounds.x - 5}
                    y={drawing.bounds.y - 5}
                    width={drawing.bounds.width + 10}
                    height={drawing.bounds.height + 10}
                    fill="transparent"
                    stroke="rgba(82, 221, 235, 0.5)"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          } else if (drawing.type === 'text') {
            const isEditing = editingDrawingId === drawing.id;
            const isSelected = selectedDrawingIds.has(drawing.id);
            const isDragging = draggingId === drawing.id;
            const isResizing = resizingId === drawing.id;
            
            return (
              <g key={drawing.id}>
                <foreignObject
                  x={drawing.bounds.x}
                  y={drawing.bounds.y}
                  width={Math.max(drawing.bounds.width, 200)}
                  height={Math.max(drawing.bounds.height, 40)}
                  className="pointer-events-auto"
                  style={{ cursor: isEditing ? 'text' : isDragging ? 'grabbing' : 'grab' }}
                  onMouseDown={(e) => {
                    if (!isEditing) {
                      handleTextMouseDown(e, drawing);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isEditing && !isDragging && !isResizing) {
                      onStartEditingText?.(drawing.id);
                    }
                  }}
                >
                  <div className="drawing-text-editor">
                    <DrawingTextRenderer
                      text={drawing.text || ''}
                      textColor={drawing.textColor || drawing.color}
                      fontSize={drawing.fontSize || 16}
                      fontFamily={drawing.fontFamily || 'Manrope'}
                      isEditing={isEditing}
                      onTextChange={(newText) => {
                        onUpdateDrawingText?.(drawing.id, newText);
                      }}
                      onEditStart={() => {
                        onStartEditingText?.(drawing.id);
                      }}
                      onEditEnd={() => {
                        onStopEditingText?.();
                      }}
                      placeholder="Click to edit text..."
                      className={cn(
                        'transition-opacity',
                        isSelected ? 'opacity-80' : 'opacity-100'
                      )}
                    />
                  </div>
                </foreignObject>
                {isSelected && !isEditing && (
                  <>
                    <rect
                      x={drawing.bounds.x - 5}
                      y={drawing.bounds.y - 5}
                      width={drawing.bounds.width + 10}
                      height={drawing.bounds.height + 10}
                      fill="transparent"
                      stroke="rgba(82, 221, 235, 0.5)"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                      className="pointer-events-none"
                    />
                    {/* Resize handles */}
                    {['nw', 'ne', 'sw', 'se'].map((handle) => {
                      const x = handle.includes('e') 
                        ? drawing.bounds.x + drawing.bounds.width + 5 
                        : drawing.bounds.x - 5;
                      const y = handle.includes('s') 
                        ? drawing.bounds.y + drawing.bounds.height + 5 
                        : drawing.bounds.y - 5;
                      
                      return (
                        <circle
                          key={handle}
                          cx={x}
                          cy={y}
                          r={4}
                          fill="rgba(82, 221, 235, 0.9)"
                          stroke="rgba(82, 221, 235, 1)"
                          strokeWidth={1.5}
                          className="resize-handle pointer-events-auto cursor-nwse-resize"
                          style={{
                            cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeMouseDown(e, drawing, handle);
                          }}
                        />
                      );
                    })}
                  </>
                )}
              </g>
            );
          } else if (drawing.type === 'shape' && drawing.shapeType) {
            const width = drawing.shapeWidth || drawing.bounds.width;
            const height = drawing.shapeHeight || drawing.bounds.height;
            const fillColor = drawing.shapeColor || drawing.color;
            const shapeStrokeColor = drawing.shapeStrokeColor || drawing.color;
            const shapeStrokeWidth = drawing.shapeStrokeWidth || drawing.size;
            const fill = drawing.shapeFill !== false;

            return (
              <g key={drawing.id}>
                {drawing.shapeType === 'rectangle' && (
                  <rect
                    x={drawing.bounds.x}
                    y={drawing.bounds.y}
                    width={width}
                    height={height}
                    fill={fill ? fillColor : 'none'}
                    stroke={shapeStrokeColor}
                    strokeWidth={shapeStrokeWidth}
                    rx={4}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrawingClick(drawing.id);
                    }}
                  />
                )}
                {drawing.shapeType === 'circle' && (
                  <circle
                    cx={drawing.bounds.x + width / 2}
                    cy={drawing.bounds.y + height / 2}
                    r={Math.min(width, height) / 2}
                    fill={fill ? fillColor : 'none'}
                    stroke={shapeStrokeColor}
                    strokeWidth={shapeStrokeWidth}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrawingClick(drawing.id);
                    }}
                  />
                )}
                {drawing.shapeType === 'line' && (
                  <line
                    x1={drawing.bounds.x}
                    y1={drawing.bounds.y + height / 2}
                    x2={drawing.bounds.x + width}
                    y2={drawing.bounds.y + height / 2}
                    stroke={shapeStrokeColor}
                    strokeWidth={shapeStrokeWidth}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrawingClick(drawing.id);
                    }}
                  />
                )}
                {drawing.shapeType === 'arrow' && (() => {
                  // Use exact coordinates if available, otherwise fallback to bounds
                  const startX = drawing.arrowStartX !== undefined ? drawing.arrowStartX : drawing.bounds.x;
                  const startY = drawing.arrowStartY !== undefined ? drawing.arrowStartY : drawing.bounds.y + height / 2;
                  const endX = drawing.arrowEndX !== undefined ? drawing.arrowEndX : drawing.bounds.x + width - 10;
                  const endY = drawing.arrowEndY !== undefined ? drawing.arrowEndY : drawing.bounds.y + height / 2;
                  
                  // Calculate arrow length and adjust end point to account for arrowhead
                  const dx = endX - startX;
                  const dy = endY - startY;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const arrowHeadSize = 10;
                  
                  // Adjust end point to account for arrowhead size
                  const adjustedEndX = length > arrowHeadSize 
                    ? startX + (dx / length) * (length - arrowHeadSize)
                    : startX;
                  const adjustedEndY = length > arrowHeadSize
                    ? startY + (dy / length) * (length - arrowHeadSize)
                    : startY;

                  return (
                    <g>
                      <defs>
                        <marker
                          id={`arrowhead-layer-${drawing.id}`}
                          markerWidth="10"
                          markerHeight="10"
                          refX="9"
                          refY="3"
                          orient="auto"
                        >
                          <polygon
                            points="0 0, 10 3, 0 6"
                            fill={shapeStrokeColor}
                          />
                        </marker>
                      </defs>
                      <line
                        x1={startX}
                        y1={startY}
                        x2={adjustedEndX}
                        y2={adjustedEndY}
                        stroke={shapeStrokeColor}
                        strokeWidth={shapeStrokeWidth}
                        markerEnd={`url(#arrowhead-layer-${drawing.id})`}
                        className="pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDrawingClick(drawing.id);
                        }}
                      />
                    </g>
                  );
                })()}
                {selectedDrawingIds.has(drawing.id) && (
                  <rect
                    x={drawing.bounds.x - 5}
                    y={drawing.bounds.y - 5}
                    width={width + 10}
                    height={height + 10}
                    fill="transparent"
                    stroke="rgba(82, 221, 235, 0.5)"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          }
          return null;
        })}

        {/* Current stroke being drawn (freehand) */}
        {isDrawing && drawingType === 'freehand' && currentPathData && (
          <path
            d={currentPathData}
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth={strokeSize}
            className="pointer-events-none"
            opacity={0.8}
            style={{ willChange: 'd' }} // Hint to browser for optimization
          />
        )}

        {/* Shape preview during creation */}
        {isDrawing && drawingType === 'shape' && shapePreview && shapePreview.startPosition && shapePreview.currentPosition && (
          <g>
            {(() => {
              const startX = shapePreview.startPosition.x;
              const startY = shapePreview.startPosition.y;
              const currentX = shapePreview.currentPosition.x;
              const currentY = shapePreview.currentPosition.y;
              
              const width = Math.abs(currentX - startX);
              const height = Math.abs(currentY - startY);
              const minSize = 20;
              
              // Only show preview if size is meaningful
              if (width < minSize && height < minSize) return null;
              
              const shapeX = Math.min(startX, currentX);
              const shapeY = Math.min(startY, currentY);
              const finalWidth = Math.max(width, minSize);
              const finalHeight = Math.max(height, minSize);
              
              const fillColor = shapePreview.shapeColor || strokeColor;
              const shapeStrokeColor = shapePreview.shapeStrokeColor || strokeColor;
              const shapeStrokeWidth = shapePreview.shapeStrokeWidth || strokeSize;
              const fill = shapePreview.shapeFill !== false;
              const shapeType = shapePreview.shapeType || 'rectangle';
              
              return (
                <>
                  {/* Render shape preview */}
                  {shapeType === 'rectangle' && (
                    <rect
                      x={shapeX}
                      y={shapeY}
                      width={finalWidth}
                      height={finalHeight}
                      fill={fill ? fillColor : 'none'}
                      stroke={shapeStrokeColor}
                      strokeWidth={shapeStrokeWidth}
                      rx={4}
                      className="pointer-events-none"
                      opacity={0.7}
                      style={{ willChange: 'x, y, width, height' }}
                    />
                  )}
                  {shapeType === 'circle' && (
                    <circle
                      cx={shapeX + finalWidth / 2}
                      cy={shapeY + finalHeight / 2}
                      r={Math.min(finalWidth, finalHeight) / 2}
                      fill={fill ? fillColor : 'none'}
                      stroke={shapeStrokeColor}
                      strokeWidth={shapeStrokeWidth}
                      className="pointer-events-none"
                      opacity={0.7}
                      style={{ willChange: 'cx, cy, r' }}
                    />
                  )}
                  {shapeType === 'line' && (
                    <line
                      x1={shapeX}
                      y1={shapeY + finalHeight / 2}
                      x2={shapeX + finalWidth}
                      y2={shapeY + finalHeight / 2}
                      stroke={shapeStrokeColor}
                      strokeWidth={shapeStrokeWidth}
                      className="pointer-events-none"
                      opacity={0.7}
                      style={{ willChange: 'x1, y1, x2, y2' }}
                    />
                  )}
                  {shapeType === 'arrow' && (() => {
                    // Use exact coordinates for arrow preview
                    const arrowStartX = startX;
                    const arrowStartY = startY;
                    const arrowEndX = currentX;
                    const arrowEndY = currentY;
                    
                    // Calculate arrow length and adjust end point to account for arrowhead
                    const dx = arrowEndX - arrowStartX;
                    const dy = arrowEndY - arrowStartY;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const arrowHeadSize = 10;
                    
                    // Adjust end point to account for arrowhead size
                    const adjustedEndX = length > arrowHeadSize 
                      ? arrowStartX + (dx / length) * (length - arrowHeadSize)
                      : arrowStartX;
                    const adjustedEndY = length > arrowHeadSize
                      ? arrowStartY + (dy / length) * (length - arrowHeadSize)
                      : arrowStartY;

                    return (
                      <g>
                        <defs>
                          <marker
                            id="arrowhead-preview"
                            markerWidth="10"
                            markerHeight="10"
                            refX="9"
                            refY="3"
                            orient="auto"
                          >
                            <polygon
                              points="0 0, 10 3, 0 6"
                              fill={shapeStrokeColor}
                            />
                          </marker>
                        </defs>
                        <line
                          x1={arrowStartX}
                          y1={arrowStartY}
                          x2={adjustedEndX}
                          y2={adjustedEndY}
                          stroke={shapeStrokeColor}
                          strokeWidth={shapeStrokeWidth}
                          markerEnd="url(#arrowhead-preview)"
                          className="pointer-events-none"
                          opacity={0.7}
                          style={{ willChange: 'x1, y1, x2, y2' }}
                        />
                      </g>
                    );
                  })()}
                  
                  {/* Dimensions label - only for non-arrow shapes to reduce lag */}
                  {shapeType !== 'arrow' && (
                    <g>
                      <rect
                        x={shapeX + finalWidth / 2 - 30}
                        y={shapeY - 25}
                        width={60}
                        height={20}
                        fill="rgba(0, 0, 0, 0.7)"
                        rx={4}
                        className="pointer-events-none"
                      />
                      <text
                        x={shapeX + finalWidth / 2}
                        y={shapeY - 12}
                        textAnchor="middle"
                        fill="rgba(82, 221, 235, 0.9)"
                        fontSize="11"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="600"
                        className="pointer-events-none"
                      >
                        {Math.round(finalWidth)} × {Math.round(finalHeight)}
                      </text>
                    </g>
                  )}
                </>
              );
            })()}
          </g>
        )}

        {/* Selection box */}
        {selectionBox && (
          <rect
            x={Math.min(selectionBox.start.x, selectionBox.end.x)}
            y={Math.min(selectionBox.start.y, selectionBox.end.y)}
            width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
            height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
            fill="rgba(82, 221, 235, 0.1)"
            stroke="rgba(82, 221, 235, 0.5)"
            strokeWidth={2}
            strokeDasharray="5,5"
            className="pointer-events-none"
          />
        )}
      </g>
    </svg>
  );
};

