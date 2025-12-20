import { useState, useRef, useCallback, useEffect } from 'react';

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export interface ImagePosition {
  x: number;
  y: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const DEFAULT_ZOOM = 1;
const ZOOM_STEP = 0.1;

export const useCanvasViewport = () => {
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: DEFAULT_ZOOM });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (screenX - rect.left - viewport.x) / viewport.scale;
    const y = (screenY - rect.top - viewport.y) / viewport.scale;
    return { x, y };
  }, [viewport]);

  // Zoom handler
  const handleZoom = useCallback((delta: number, centerX: number, centerY: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = centerX - rect.left;
    const mouseY = centerY - rect.top;
    
    const zoomFactor = delta > 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.scale * zoomFactor));
    
    if (newScale === viewport.scale) return;
    
    const scaleChange = newScale / viewport.scale;
    const newX = mouseX - (mouseX - viewport.x) * scaleChange;
    const newY = mouseY - (mouseY - viewport.y) * scaleChange;
    
    setViewport({ x: newX, y: newY, scale: newScale });
  }, [viewport]);

  // Pan handlers
  const handlePanStart = useCallback((clientX: number, clientY: number) => {
    if (draggingId) return;
    setIsPanning(true);
    setPanStart({ x: clientX - viewport.x, y: clientY - viewport.y });
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, [draggingId, viewport]);

  const handlePanMove = useCallback((clientX: number, clientY: number) => {
    if (!isPanning) return;
    setViewport(prev => ({
      ...prev,
      x: clientX - panStart.x,
      y: clientY - panStart.y,
    }));
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    if (containerRef.current) {
      containerRef.current.style.cursor = isSpacePressed ? 'grab' : 'default';
    }
  }, [isSpacePressed]);

  // Image drag handlers
  const handleImageMouseDown = useCallback((e: React.MouseEvent, mockupId: string, imagePositions: Record<string, ImagePosition>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current || !mockupId) return;
    
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const imagePos = imagePositions[mockupId] || { x: 0, y: 0 };
    
    const offset = {
      x: canvasPos.x - imagePos.x,
      y: canvasPos.y - imagePos.y,
    };
    setDragOffset(offset);
    setDraggingId(mockupId);
    setHasDragged(false);
  }, [screenToCanvas]);

  const handleImageDragMove = useCallback((clientX: number, clientY: number) => {
    if (!draggingId || !containerRef.current) return null;
    
    const canvasPos = screenToCanvas(clientX, clientY);
    setHasDragged(true);
    return {
      x: canvasPos.x - dragOffset.x,
      y: canvasPos.y - dragOffset.y,
    };
  }, [draggingId, dragOffset, screenToCanvas]);

  const handleImageDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
    setTimeout(() => setHasDragged(false), 0);
  }, []);

  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    handleZoom(1, centerX, centerY);
  }, [handleZoom]);

  const handleZoomOut = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    handleZoom(-1, centerX, centerY);
  }, [handleZoom]);

  const handleZoomSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const scaleChange = newScale / viewport.scale;
    const mouseX = centerX - rect.left;
    const mouseY = centerY - rect.top;
    
    const newX = mouseX - (mouseX - viewport.x) * scaleChange;
    const newY = mouseY - (mouseY - viewport.y) * scaleChange;
    
    setViewport({ x: newX, y: newY, scale: newScale });
  }, [viewport]);

  // Space key detection for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isPanning) {
        e.preventDefault();
        e.stopPropagation();
        setIsSpacePressed(true);
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        if (containerRef.current && !isPanning) {
          containerRef.current.style.cursor = 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPanning]);

  return {
    viewport,
    setViewport,
    isPanning,
    isSpacePressed,
    draggingId,
    setDraggingId,
    hasDragged,
    containerRef,
    canvasRef,
    screenToCanvas,
    handleZoom,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleImageMouseDown,
    handleImageDragMove,
    handleImageDragEnd,
    handleZoomIn,
    handleZoomOut,
    handleZoomSliderChange,
    MIN_ZOOM,
    MAX_ZOOM,
  };
};

