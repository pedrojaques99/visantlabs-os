import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { analyzeSvg, type Point, type Segment } from '@/components/grid-machine/SvgAnalyzer';
import {
  MousePointer2, Eraser, Lasso, Undo2, Trash2,
  ZoomIn, ZoomOut, RotateCcw, Spline, Circle,
} from 'lucide-react';

type Tool = 'select' | 'eraser' | 'lasso';

interface SvgElementInfo {
  index: number;
  tagName: string;
  element: Element;
  anchors: Point[];
  handles: Point[];
  segments: Segment[];
  bbox: { x: number; y: number; w: number; h: number };
}

interface Props {
  svgString: string;
  onSvgChange: (newSvg: string) => void;
  className?: string;
}

const SHAPE_SELECTOR = 'path, rect, circle, ellipse, line, polygon, polyline';

function parseSvgElements(svgString: string): {
  elements: SvgElementInfo[];
  viewBox: { x: number; y: number; width: number; height: number };
  doc: Document;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return { elements: [], viewBox: { x: 0, y: 0, width: 100, height: 100 }, doc };

  const vbAttr = svgEl.getAttribute('viewBox');
  let viewBox = { x: 0, y: 0, width: 100, height: 100 };
  if (vbAttr) {
    const p = vbAttr.split(/[\s,]+/).map(Number);
    viewBox = { x: p[0], y: p[1], width: p[2], height: p[3] };
  } else {
    viewBox = {
      x: 0, y: 0,
      width: parseFloat(svgEl.getAttribute('width') || '100'),
      height: parseFloat(svgEl.getAttribute('height') || '100'),
    };
  }

  const shapeEls = svgEl.querySelectorAll(SHAPE_SELECTOR);
  const elements: SvgElementInfo[] = [];

  shapeEls.forEach((el, index) => {
    const info = extractElementInfo(el as SVGElement, index);
    if (info) elements.push(info);
  });

  return { elements, viewBox, doc };
}

function extractElementInfo(el: SVGElement, index: number): SvgElementInfo | null {
  const tagName = el.tagName.toLowerCase();
  const wrapper = `<svg xmlns="http://www.w3.org/2000/svg">${el.outerHTML}</svg>`;
  const result = analyzeSvg(wrapper);
  if (result.points.length === 0 && result.segments.length === 0) return null;

  const anchors = result.points.filter(p => p.type === 'anchor');
  const handles = result.points.filter(p => p.type === 'handle');

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of anchors) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!isFinite(minX)) return null;

  return {
    index,
    tagName,
    element: el,
    anchors,
    handles,
    segments: result.segments,
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

function reconstructSvg(doc: Document, allElements: SvgElementInfo[], deletedIndices: Set<number>): string {
  const clone = doc.cloneNode(true) as Document;
  const svgEl = clone.querySelector('svg');
  if (!svgEl) return '';

  const shapes = svgEl.querySelectorAll(SHAPE_SELECTOR);
  const toRemove: Element[] = [];
  shapes.forEach((el, i) => {
    if (deletedIndices.has(i)) toRemove.push(el);
  });
  for (const el of toRemove) {
    el.parentNode?.removeChild(el);
  }

  // Clean empty groups left behind
  let changed = true;
  while (changed) {
    changed = false;
    const groups = svgEl.querySelectorAll('g');
    groups.forEach(g => {
      if (g.children.length === 0 && g.textContent?.trim() === '') {
        g.parentNode?.removeChild(g);
        changed = true;
      }
    });
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgEl);
}

function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointToSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export const SvgVectorEditor: React.FC<Props> = ({ svgString, onSvgChange, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('select');
  const [showAnchors, setShowAnchors] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [showOutline, setShowOutline] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const [undoStack, setUndoStack] = useState<Set<number>[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Reset editor state when svgString changes (user switches item or re-traces)
  const prevSvgRef = useRef(svgString);
  if (svgString !== prevSvgRef.current) {
    prevSvgRef.current = svgString;
    setDeletedIndices(new Set());
    setUndoStack([]);
    setSelectedIndices(new Set());
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }

  const { elements, viewBox, doc } = useMemo(() => parseSvgElements(svgString), [svgString]);

  const visibleElements = useMemo(
    () => elements.filter(el => !deletedIndices.has(el.index)),
    [elements, deletedIndices],
  );

  const totalAnchors = useMemo(
    () => visibleElements.reduce((sum, el) => sum + el.anchors.length, 0),
    [visibleElements],
  );

  const totalSegments = useMemo(
    () => visibleElements.reduce((sum, el) => sum + el.segments.length, 0),
    [visibleElements],
  );

  const getTransform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return { offsetX: 0, offsetY: 0, totalScale: 1 };

    const rect = container.getBoundingClientRect();
    const padding = 40;
    const availW = rect.width - padding * 2;
    const availH = rect.height - padding * 2;
    const fitScale = Math.min(availW / viewBox.width, availH / viewBox.height);
    const totalScale = fitScale * zoom;
    const offsetX = rect.width / 2 - (viewBox.x + viewBox.width / 2) * totalScale + panX;
    const offsetY = rect.height / 2 - (viewBox.y + viewBox.height / 2) * totalScale + panY;
    return { offsetX, offsetY, totalScale };
  }, [viewBox, zoom, panX, panY]);

  const screenToSvg = useCallback((sx: number, sy: number) => {
    const { offsetX, offsetY, totalScale } = getTransform();
    return { x: (sx - offsetX) / totalScale, y: (sy - offsetY) / totalScale };
  }, [getTransform]);

  // --- Drawing ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const { offsetX, offsetY, totalScale } = getTransform();
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(totalScale, totalScale);

    // Checkerboard
    const checkSize = 8 / totalScale;
    const cols = Math.ceil(viewBox.width / checkSize);
    const rows = Math.ceil(viewBox.height / checkSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#1a1a1a' : '#141414';
        ctx.fillRect(viewBox.x + c * checkSize, viewBox.y + r * checkSize, checkSize, checkSize);
      }
    }

    for (const el of visibleElements) {
      const isSelected = selectedIndices.has(el.index);

      if (showOutline) {
        ctx.strokeStyle = isSelected ? '#00d4ff' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = (isSelected ? 1.5 : 0.8) / totalScale;
        ctx.setLineDash([]);

        for (const seg of el.segments) {
          ctx.beginPath();
          ctx.moveTo(seg.from.x, seg.from.y);
          if (seg.type === 'curve' && seg.handles) {
            if (seg.handles.length === 2) {
              ctx.bezierCurveTo(seg.handles[0].x, seg.handles[0].y, seg.handles[1].x, seg.handles[1].y, seg.to.x, seg.to.y);
            } else if (seg.handles.length === 1) {
              ctx.quadraticCurveTo(seg.handles[0].x, seg.handles[0].y, seg.to.x, seg.to.y);
            }
          } else {
            ctx.lineTo(seg.to.x, seg.to.y);
          }
          ctx.stroke();
        }
      }

      if (showHandles) {
        ctx.strokeStyle = isSelected ? '#ff6b00' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 0.5 / totalScale;

        for (const seg of el.segments) {
          if (seg.handles) {
            ctx.globalAlpha = 0.4;
            for (const h of seg.handles) {
              ctx.beginPath();
              ctx.moveTo(seg.from.x, seg.from.y);
              ctx.lineTo(h.x, h.y);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
        }

        const hr = 2.5 / totalScale;
        for (const h of el.handles) {
          ctx.beginPath();
          ctx.arc(h.x, h.y, hr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (showAnchors) {
        const half = 2.5 / totalScale;
        ctx.fillStyle = '#00d4ff';
        ctx.globalAlpha = isSelected ? 1 : 0.7;
        for (const p of el.anchors) {
          ctx.fillRect(p.x - half, p.y - half, half * 2, half * 2);
        }
        ctx.globalAlpha = 1;
      }

      if (isSelected) {
        ctx.strokeStyle = 'rgba(0,212,255,0.3)';
        ctx.lineWidth = 1 / totalScale;
        ctx.setLineDash([4 / totalScale, 4 / totalScale]);
        ctx.strokeRect(el.bbox.x - 2 / totalScale, el.bbox.y - 2 / totalScale, el.bbox.w + 4 / totalScale, el.bbox.h + 4 / totalScale);
        ctx.setLineDash([]);
      }
    }

    // Lasso
    if (lassoPoints.length > 1) {
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 1 / totalScale;
      ctx.setLineDash([3 / totalScale, 3 / totalScale]);
      ctx.fillStyle = 'rgba(0,212,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      for (let i = 1; i < lassoPoints.length; i++) {
        ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
      }
      if (!isDrawingLasso) ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Eraser cursor
    if (tool === 'eraser') {
      const mp = screenToSvg(lastMouse.current.x, lastMouse.current.y);
      const er = 12 / totalScale;
      ctx.strokeStyle = isErasing ? 'rgba(255,100,100,0.6)' : 'rgba(255,100,100,0.25)';
      ctx.lineWidth = 1 / totalScale;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, er, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(
      `${visibleElements.length} elements · ${totalAnchors} anchors · ${totalSegments} segments · ${Math.round(zoom * 100)}%`,
      8, rect.height - 8,
    );
  }, [visibleElements, selectedIndices, showAnchors, showHandles, showOutline, viewBox, zoom, panX, panY, lassoPoints, isDrawingLasso, tool, isErasing, getTransform, screenToSvg, totalAnchors, totalSegments]);

  useEffect(() => {
    draw();
    const handle = () => draw();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [draw]);

  // --- Hit testing ---
  const hitTestElement = useCallback((svgX: number, svgY: number, radius: number): SvgElementInfo | null => {
    const rSq = radius * radius;
    for (let i = visibleElements.length - 1; i >= 0; i--) {
      const el = visibleElements[i];
      for (const p of el.anchors) {
        if ((p.x - svgX) ** 2 + (p.y - svgY) ** 2 < rSq) return el;
      }
      for (const seg of el.segments) {
        const dist = pointToSegDist(svgX, svgY, seg.from.x, seg.from.y, seg.to.x, seg.to.y);
        if (dist < radius) return el;
      }
    }
    return null;
  }, [visibleElements]);

  // --- Deletion ---
  const deleteElements = useCallback((indices: Set<number>) => {
    if (indices.size === 0) return;
    setUndoStack(prev => [...prev, new Set(deletedIndices)]);
    setDeletedIndices(prev => {
      const next = new Set(prev);
      indices.forEach(i => next.add(i));
      return next;
    });
    setSelectedIndices(new Set());
  }, [deletedIndices]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const stack = [...prev];
      const last = stack.pop()!;
      setDeletedIndices(last);
      return stack;
    });
    setSelectedIndices(new Set());
  }, []);

  const applyChanges = useCallback(() => {
    if (deletedIndices.size === 0) return;
    const newSvg = reconstructSvg(doc, elements, deletedIndices);
    onSvgChange(newSvg);
  }, [deletedIndices, elements, doc, onSvgChange]);

  // --- Mouse handlers ---
  const getMousePos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);
    lastMouse.current = pos;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    const { totalScale } = getTransform();
    const svgPos = screenToSvg(pos.x, pos.y);
    const hitRadius = 8 / totalScale;

    if (tool === 'select') {
      const hit = hitTestElement(svgPos.x, svgPos.y, hitRadius);
      if (hit) {
        setSelectedIndices(prev => {
          const next = new Set(e.shiftKey ? prev : new Set<number>());
          if (next.has(hit.index)) next.delete(hit.index);
          else next.add(hit.index);
          return next;
        });
      } else if (!e.shiftKey) {
        setSelectedIndices(new Set());
      }
    } else if (tool === 'eraser') {
      setIsErasing(true);
      const hit = hitTestElement(svgPos.x, svgPos.y, 12 / totalScale);
      if (hit) deleteElements(new Set([hit.index]));
    } else if (tool === 'lasso') {
      setIsDrawingLasso(true);
      setLassoPoints([svgPos]);
    }
  }, [tool, getMousePos, getTransform, screenToSvg, hitTestElement, deleteElements]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);

    if (isPanning.current) {
      const dx = pos.x - lastMouse.current.x;
      const dy = pos.y - lastMouse.current.y;
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
      lastMouse.current = pos;
      return;
    }

    lastMouse.current = pos;

    if (tool === 'eraser' && isErasing) {
      const { totalScale } = getTransform();
      const svgPos = screenToSvg(pos.x, pos.y);
      const hit = hitTestElement(svgPos.x, svgPos.y, 12 / totalScale);
      if (hit) deleteElements(new Set([hit.index]));
    }

    if (tool === 'lasso' && isDrawingLasso) {
      const svgPos = screenToSvg(pos.x, pos.y);
      setLassoPoints(prev => [...prev, svgPos]);
    }
  }, [tool, isErasing, isDrawingLasso, getMousePos, getTransform, screenToSvg, hitTestElement, deleteElements]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setIsErasing(false);

    if (tool === 'lasso' && isDrawingLasso && lassoPoints.length > 2) {
      const inside = new Set<number>();
      for (const el of visibleElements) {
        const centerX = el.bbox.x + el.bbox.w / 2;
        const centerY = el.bbox.y + el.bbox.h / 2;
        if (pointInPolygon(centerX, centerY, lassoPoints)) {
          inside.add(el.index);
        }
        for (const a of el.anchors) {
          if (pointInPolygon(a.x, a.y, lassoPoints)) {
            inside.add(el.index);
            break;
          }
        }
      }
      if (inside.size > 0) {
        setSelectedIndices(inside);
      }
    }
    setIsDrawingLasso(false);
    setLassoPoints([]);
  }, [tool, isDrawingLasso, lassoPoints, visibleElements]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(20, prev * factor)));
  }, []);

  // Keyboard — only when editor container is focused
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIndices.size > 0) {
          e.preventDefault();
          deleteElements(selectedIndices);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIndices(new Set(visibleElements.map(el => el.index)));
      }
      if (e.key === 'Escape') {
        setSelectedIndices(new Set());
        setLassoPoints([]);
        setIsDrawingLasso(false);
      }
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'v' || e.key === 'V') setTool('select');
        if (e.key === 'e' || e.key === 'E') setTool('eraser');
        if (e.key === 'l' || e.key === 'L') setTool('lasso');
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [selectedIndices, visibleElements, deleteElements, undo]);

  const cursorClass = tool === 'eraser' ? 'cursor-crosshair' : tool === 'lasso' ? 'cursor-crosshair' : 'cursor-default';

  return (
    <div ref={editorRef} tabIndex={0} className={cn('flex flex-col h-full outline-none', className)} onFocus={() => {}}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-neutral-800 flex-wrap">
        <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} title="Select (V)">
          <MousePointer2 size={12} />
        </ToolBtn>
        <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser (E)">
          <Eraser size={12} />
        </ToolBtn>
        <ToolBtn active={tool === 'lasso'} onClick={() => setTool('lasso')} title="Lasso (L)">
          <Lasso size={12} />
        </ToolBtn>

        <div className="w-px h-4 bg-neutral-800 mx-1" />

        <ToolBtn active={showOutline} onClick={() => setShowOutline(!showOutline)} title="Outlines">
          <Spline size={12} />
        </ToolBtn>
        <ToolBtn active={showAnchors} onClick={() => setShowAnchors(!showAnchors)} title="Anchors">
          <span className="text-[8px] font-mono font-bold">A</span>
        </ToolBtn>
        <ToolBtn active={showHandles} onClick={() => setShowHandles(!showHandles)} title="Handles">
          <Circle size={10} />
        </ToolBtn>

        <div className="w-px h-4 bg-neutral-800 mx-1" />

        <ToolBtn onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
          <Undo2 size={12} />
        </ToolBtn>
        <ToolBtn
          onClick={() => deleteElements(selectedIndices)}
          disabled={selectedIndices.size === 0}
          title="Delete selected (Del)"
          danger
        >
          <Trash2 size={12} />
        </ToolBtn>

        <div className="w-px h-4 bg-neutral-800 mx-1" />

        <ToolBtn onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} title="Zoom out">
          <ZoomOut size={12} />
        </ToolBtn>
        <span className="text-[9px] font-mono text-neutral-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
        <ToolBtn onClick={() => setZoom(z => Math.min(20, z * 1.25))} title="Zoom in">
          <ZoomIn size={12} />
        </ToolBtn>
        <ToolBtn onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} title="Reset view">
          <RotateCcw size={10} />
        </ToolBtn>

        <div className="flex-1" />
        {selectedIndices.size > 0 && (
          <span className="text-[9px] font-mono text-brand-cyan">
            {selectedIndices.size} selected
          </span>
        )}
        {deletedIndices.size > 0 && (
          <span className="text-[9px] font-mono text-amber-400 ml-2">
            {deletedIndices.size} removed
          </span>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn('flex-1 overflow-hidden relative', cursorClass)}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={e => { e.preventDefault(); undo(); }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Apply bar */}
      {deletedIndices.size > 0 && (
        <div className="flex items-center gap-2 p-2 border-t border-neutral-800 bg-neutral-950/80">
          <span className="text-[10px] font-mono text-neutral-400">
            {deletedIndices.size} element{deletedIndices.size > 1 ? 's' : ''} removed
          </span>
          <div className="flex-1" />
          <button
            onClick={() => { setDeletedIndices(new Set()); setUndoStack([]); }}
            className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 uppercase tracking-wider px-2 py-1"
          >
            Discard
          </button>
          <button
            onClick={applyChanges}
            className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 uppercase tracking-widest px-3 py-1 rounded"
          >
            Apply cleanup
          </button>
        </div>
      )}
    </div>
  );
};

const ToolBtn: React.FC<{
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ active, onClick, disabled, title, danger, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'flex items-center justify-center w-6 h-6 rounded transition-all text-neutral-500',
      active && !danger && 'bg-brand-cyan/20 text-brand-cyan',
      danger && 'hover:text-red-400',
      !active && !danger && 'hover:bg-neutral-800 hover:text-neutral-300',
      disabled && 'opacity-30 pointer-events-none',
    )}
  >
    {children}
  </button>
);
