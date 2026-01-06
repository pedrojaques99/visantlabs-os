import { useState, useCallback, useMemo, useRef } from 'react';
import type { ReactFlowInstance } from '../../types/reactflow-instance';
import { getSvgPathFromStroke, calculateBounds } from '../../utils/drawingUtils';
import type { DrawingType, ShapeType, DrawingBounds } from '../../types/drawing';

export interface DrawingStroke {
  id: string;
  points: number[][];
  pathData: string;
  bounds: DrawingBounds;
  color: string;
  size: number;
  type: DrawingType;
  // For text
  text?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  // For shapes
  shapeType?: ShapeType;
  shapeWidth?: number;
  shapeHeight?: number;
  shapeColor?: string;
  shapeStrokeColor?: string;
  shapeStrokeWidth?: number;
  shapeFill?: boolean;
  // For arrow - exact coordinates
  arrowStartX?: number;
  arrowStartY?: number;
  arrowEndX?: number;
  arrowEndY?: number;
}

export interface DrawingState {
  isDrawingMode: boolean;
  drawingType: DrawingType;
  strokeColor: string;
  strokeSize: number;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  shapeType: ShapeType;
  shapeColor: string;
  shapeStrokeColor: string;
  shapeStrokeWidth: number;
  shapeFill: boolean;
}

const DEFAULT_STATE: DrawingState = {
  isDrawingMode: false,
  drawingType: 'freehand',
  strokeColor: '#52ddeb',
  strokeSize: 2,
  textColor: '#52ddeb',
  fontSize: 16,
  fontFamily: 'Manrope',
  shapeType: 'rectangle',
  shapeColor: '#52ddeb',
  shapeStrokeColor: '#52ddeb',
  shapeStrokeWidth: 2,
  shapeFill: false,
};

export const useCanvasDrawing = (
  reactFlowInstance: ReactFlowInstance | null
) => {
  const [drawingState, setDrawingState] = useState<DrawingState>(DEFAULT_STATE);
  const [drawings, setDrawings] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<number[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPosition, setStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<Set<string>>(new Set());
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);
  
  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);

  // Performance optimization: use refs to accumulate points during drawing
  const strokePointsRef = useRef<number[][]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastPathDataUpdateRef = useRef<number>(0);
  const PATH_DATA_UPDATE_INTERVAL = 16; // ~60fps

  // Store last calculated pathData to avoid recalculation
  const lastPathDataRef = useRef<string>('');

  // Calculate pathData for current stroke to avoid recalculation
  // Only update periodically during drawing to reduce lag
  const currentPathData = useMemo(() => {
    if (currentStroke.length === 0 || drawingState.drawingType !== 'freehand') {
      lastPathDataRef.current = '';
      return '';
    }
    
    // Throttle pathData calculation during active drawing
    if (isDrawing) {
      const now = Date.now();
      if (now - lastPathDataUpdateRef.current < PATH_DATA_UPDATE_INTERVAL) {
        // Return previous pathData if update interval hasn't passed
        return lastPathDataRef.current;
      }
      lastPathDataUpdateRef.current = now;
    }
    
    const pathData = getSvgPathFromStroke(currentStroke, drawingState.strokeSize);
    lastPathDataRef.current = pathData;
    return pathData;
  }, [currentStroke, drawingState.drawingType, drawingState.strokeSize, isDrawing]);

  const setIsDrawingMode = useCallback((enabled: boolean) => {
    setDrawingState((prev) => ({ ...prev, isDrawingMode: enabled }));
    if (!enabled) {
      // Reset drawing state when disabling
      setCurrentStroke([]);
      setIsDrawing(false);
      setStartPosition(null);
      setCurrentPosition(null);
    }
  }, []);

  const setDrawingType = useCallback((type: DrawingType) => {
    setDrawingState((prev) => ({ ...prev, drawingType: type }));
  }, []);

  const setStrokeColor = useCallback((color: string) => {
    setDrawingState((prev) => ({ ...prev, strokeColor: color }));
  }, []);

  const setStrokeSize = useCallback((size: number) => {
    setDrawingState((prev) => ({ ...prev, strokeSize: size }));
  }, []);

  const setTextColor = useCallback((color: string) => {
    setDrawingState((prev) => ({ ...prev, textColor: color }));
  }, []);

  const setFontSize = useCallback((size: number) => {
    setDrawingState((prev) => ({ ...prev, fontSize: size }));
  }, []);

  const setFontFamily = useCallback((fontFamily: string) => {
    setDrawingState((prev) => ({ ...prev, fontFamily }));
  }, []);

  const setShapeType = useCallback((type: ShapeType) => {
    setDrawingState((prev) => ({ ...prev, shapeType: type }));
  }, []);

  const setShapeColor = useCallback((color: string) => {
    setDrawingState((prev) => ({ ...prev, shapeColor: color }));
  }, []);

  const setShapeFill = useCallback((fill: boolean) => {
    setDrawingState((prev) => ({ ...prev, shapeFill: fill }));
  }, []);

  const setShapeStrokeColor = useCallback((color: string) => {
    setDrawingState((prev) => ({ ...prev, shapeStrokeColor: color }));
  }, []);

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!drawingState.isDrawingMode || !reactFlowInstance) return;

    event.preventDefault();
    event.stopPropagation();

    const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

    const position = reactFlowInstance.screenToFlowPosition({
      x: clientX,
      y: clientY,
    });

    if (!position || isNaN(position.x) || isNaN(position.y)) {
      return;
    }

    // Reset refs and state
    strokePointsRef.current = [[position.x, position.y]];
    lastPathDataUpdateRef.current = Date.now();
    
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    setIsDrawing(true);
    setStartPosition(position);
    setCurrentPosition(position);

    if (drawingState.drawingType === 'freehand') {
      setCurrentStroke([[position.x, position.y]]);
    }
  }, [drawingState.isDrawingMode, drawingState.drawingType, reactFlowInstance]);

  // Optimized draw function with requestAnimationFrame throttling
  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !reactFlowInstance || !drawingState.isDrawingMode) return;

    event.preventDefault();
    event.stopPropagation();

    const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

    const position = reactFlowInstance.screenToFlowPosition({
      x: clientX,
      y: clientY,
    });

    if (!position || isNaN(position.x) || isNaN(position.y)) {
      return;
    }

    // Always update current position for shape preview
    setCurrentPosition(position);

    if (drawingState.drawingType === 'freehand') {
      // Accumulate points in ref for better performance
      strokePointsRef.current.push([position.x, position.y]);

      // Throttle state updates using requestAnimationFrame
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          // Update state with accumulated points
          setCurrentStroke([...strokePointsRef.current]);
          rafIdRef.current = null;
        });
      }
    }
  }, [isDrawing, reactFlowInstance, drawingState.isDrawingMode, drawingState.drawingType]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !reactFlowInstance || !drawingState.isDrawingMode) return;

    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Flush any remaining points from ref
    const finalStroke = drawingState.drawingType === 'freehand' 
      ? strokePointsRef.current.length > 0 
        ? strokePointsRef.current 
        : currentStroke
      : currentStroke;

    setIsDrawing(false);

    if (drawingState.drawingType === 'freehand' && finalStroke.length > 0) {
      // Create freehand drawing stroke (not a node)
      const pathData = getSvgPathFromStroke(finalStroke, drawingState.strokeSize);
      const bounds = calculateBounds(finalStroke);

      if (pathData && bounds.width > 0 && bounds.height > 0) {
        const newDrawing: DrawingStroke = {
          id: `drawing-${Date.now()}-${Math.random()}`,
          points: finalStroke,
          pathData,
          bounds,
          color: drawingState.strokeColor,
          size: drawingState.strokeSize,
          type: 'freehand',
        };

        setDrawings((prev) => [...prev, newDrawing]);
      }
    } else if (drawingState.drawingType === 'shape' && startPosition && currentPosition) {
      // For arrow, use exact coordinates to preserve direction
      if (drawingState.shapeType === 'arrow') {
        const distance = Math.sqrt(
          Math.pow(currentPosition.x - startPosition.x, 2) +
          Math.pow(currentPosition.y - startPosition.y, 2)
        );
        const minSize = 20;

        if (distance >= minSize) {
          // Calculate bounds for arrow (for selection and rendering)
          const minX = Math.min(startPosition.x, currentPosition.x);
          const minY = Math.min(startPosition.y, currentPosition.y);
          const maxX = Math.max(startPosition.x, currentPosition.x);
          const maxY = Math.max(startPosition.y, currentPosition.y);
          const padding = 10; // Padding for arrow head

          const newDrawing: DrawingStroke = {
            id: `drawing-${Date.now()}-${Math.random()}`,
            points: [],
            pathData: '',
            bounds: {
              x: minX - padding,
              y: minY - padding,
              width: maxX - minX + padding * 2,
              height: maxY - minY + padding * 2,
            },
            color: drawingState.shapeColor,
            size: drawingState.shapeStrokeWidth,
            type: 'shape',
            shapeType: 'arrow',
            shapeWidth: maxX - minX + padding * 2,
            shapeHeight: maxY - minY + padding * 2,
            shapeColor: drawingState.shapeColor,
            shapeStrokeColor: drawingState.shapeStrokeColor,
            shapeStrokeWidth: drawingState.shapeStrokeWidth,
            shapeFill: drawingState.shapeFill,
            // Store exact arrow coordinates
            arrowStartX: startPosition.x,
            arrowStartY: startPosition.y,
            arrowEndX: currentPosition.x,
            arrowEndY: currentPosition.y,
          };

          setDrawings((prev) => [...prev, newDrawing]);
        }
      } else {
        // For other shapes, use rectangular bounds
        const shapeWidth = Math.abs(currentPosition.x - startPosition.x);
        const shapeHeight = Math.abs(currentPosition.y - startPosition.y);
        const minSize = 20;

        if (shapeWidth >= minSize || shapeHeight >= minSize) {
          const shapeX = Math.min(startPosition.x, currentPosition.x);
          const shapeY = Math.min(startPosition.y, currentPosition.y);

          const newDrawing: DrawingStroke = {
            id: `drawing-${Date.now()}-${Math.random()}`,
            points: [],
            pathData: '',
            bounds: {
              x: shapeX,
              y: shapeY,
              width: Math.max(shapeWidth, minSize),
              height: Math.max(shapeHeight, minSize),
            },
            color: drawingState.shapeColor,
            size: drawingState.shapeStrokeWidth,
            type: 'shape',
            shapeType: drawingState.shapeType,
            shapeWidth: Math.max(shapeWidth, minSize),
            shapeHeight: Math.max(shapeHeight, minSize),
            shapeColor: drawingState.shapeColor,
            shapeStrokeColor: drawingState.shapeStrokeColor,
            shapeStrokeWidth: drawingState.shapeStrokeWidth,
            shapeFill: drawingState.shapeFill,
          };

          setDrawings((prev) => [...prev, newDrawing]);
        }
      }
    }

    // Reset state and refs
    setCurrentStroke([]);
    strokePointsRef.current = [];
    setStartPosition(null);
    setCurrentPosition(null);
    lastPathDataUpdateRef.current = 0;
  }, [
    isDrawing,
    reactFlowInstance,
    drawingState,
    currentStroke,
    startPosition,
    currentPosition,
  ]);

  const deleteDrawing = useCallback((id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    setSelectedDrawingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Update drawing bounds (for move and resize)
  const updateDrawingBounds = useCallback((id: string, bounds: DrawingBounds) => {
    setDrawings((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, bounds }
          : d
      )
    );
  }, []);

  const deleteSelectedDrawings = useCallback(() => {
    if (selectedDrawingIds.size > 0) {
      setDrawings((prev) => prev.filter((d) => !selectedDrawingIds.has(d.id)));
      setSelectedDrawingIds(new Set());
    }
  }, [selectedDrawingIds]);

  const clearAllDrawings = useCallback(() => {
    setDrawings([]);
    setSelectedDrawingIds(new Set());
    setEditingDrawingId(null);
  }, []);

  // Simple text creation (simplified type tool)
  const createTextDrawing = useCallback((position: { x: number; y: number }) => {
    if (!reactFlowInstance) return null;

    const newDrawing: DrawingStroke = {
      id: `drawing-${Date.now()}-${Math.random()}`,
      points: [],
      pathData: '',
      bounds: { x: position.x, y: position.y, width: 200, height: 60 },
      color: drawingState.textColor,
      size: drawingState.fontSize,
      type: 'text',
      text: '',
      textColor: drawingState.textColor,
      fontSize: drawingState.fontSize,
      fontFamily: drawingState.fontFamily,
    };

    setDrawings((prev) => [...prev, newDrawing]);
    setEditingDrawingId(newDrawing.id);
    setSelectedDrawingIds(new Set([newDrawing.id]));
    
    return newDrawing.id;
  }, [reactFlowInstance, drawingState]);

  // Text editing handlers
  const startEditingText = useCallback((id: string) => {
    setEditingDrawingId(id);
    setSelectedDrawingIds(new Set([id]));
  }, []);

  const updateDrawingText = useCallback((id: string, newText: string) => {
    setDrawings((prev) =>
      prev.map((d) =>
        d.id === id && d.type === 'text'
          ? { ...d, text: newText }
          : d
      )
    );
  }, []);

  const stopEditingText = useCallback(() => {
    setEditingDrawingId(null);
  }, []);

  // Selection box handlers
  const startSelectionBox = useCallback((position: { x: number; y: number }) => {
    setSelectionBox({ start: position, end: position });
  }, []);

  const updateSelectionBox = useCallback((position: { x: number; y: number }) => {
    setSelectionBox((prev) => {
      if (!prev) return null;
      return { ...prev, end: position };
    });
  }, []);

  const endSelectionBox = useCallback(() => {
    if (!selectionBox || !reactFlowInstance) {
      setSelectionBox(null);
      return;
    }

    // Calculate selection box bounds
    const minX = Math.min(selectionBox.start.x, selectionBox.end.x);
    const maxX = Math.max(selectionBox.start.x, selectionBox.end.x);
    const minY = Math.min(selectionBox.start.y, selectionBox.end.y);
    const maxY = Math.max(selectionBox.start.y, selectionBox.end.y);

    // Find drawings that intersect with selection box
    const selectedIds = new Set<string>();
    drawings.forEach((drawing) => {
      const bounds = drawing.bounds;
      // Check if drawing bounds intersect with selection box
      if (
        bounds.x < maxX &&
        bounds.x + bounds.width > minX &&
        bounds.y < maxY &&
        bounds.y + bounds.height > minY
      ) {
        selectedIds.add(drawing.id);
      }
    });

    setSelectedDrawingIds(selectedIds);
    setSelectionBox(null);
  }, [selectionBox, drawings, reactFlowInstance]);

  const setSelectedDrawingId = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedDrawingIds(new Set());
    } else {
      setSelectedDrawingIds(new Set([id]));
    }
  }, []);

  return {
    drawingState,
    setIsDrawingMode,
    setDrawingType,
    setStrokeColor,
    setStrokeSize,
    setTextColor,
    setFontSize,
    setFontFamily,
    setShapeType,
    setShapeColor,
    setShapeFill,
    setShapeStrokeColor,
    startDrawing,
    draw,
    stopDrawing,
    currentStroke,
    currentPathData,
    isDrawing,
    startPosition,
    currentPosition,
    drawings,
    setDrawings, // Expose setDrawings for history integration
    selectedDrawingIds,
    setSelectedDrawingId,
    deleteDrawing,
    deleteSelectedDrawings,
    clearAllDrawings,
    updateDrawingBounds,
    selectionBox,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    editingDrawingId,
    startEditingText,
    updateDrawingText,
    stopEditingText,
    createTextDrawing,
  };
};

