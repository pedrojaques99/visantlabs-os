import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useGridMachineStore } from '@/stores/gridMachineStore';
import { generateGridLines, type GridLine, type Point, type Segment } from './SvgAnalyzer';
import { loadImage } from '@/utils/imageUtils';

export interface GridCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  exportSvg: () => string;
}

export const GridCanvas = forwardRef<GridCanvasHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const allGridLinesRef = useRef<{ lines: GridLine[]; offsetX: number; offsetY: number; totalScale: number }>({ lines: [], offsetX: 0, offsetY: 0, totalScale: 1 });

  const analysis = useGridMachineStore((s) => s.analysis);
  const svgContent = useGridMachineStore((s) => s.svgContent);
  const zoom = useGridMachineStore((s) => s.zoom);
  const panX = useGridMachineStore((s) => s.panX);
  const panY = useGridMachineStore((s) => s.panY);
  const setZoom = useGridMachineStore((s) => s.setZoom);
  const setPan = useGridMachineStore((s) => s.setPan);

  const showAnchors = useGridMachineStore((s) => s.showAnchors);
  const showHandles = useGridMachineStore((s) => s.showHandles);
  const showHLines = useGridMachineStore((s) => s.showHLines);
  const showVLines = useGridMachineStore((s) => s.showVLines);
  const showDiagonals = useGridMachineStore((s) => s.showDiagonals);
  const showBaseGrid = useGridMachineStore((s) => s.showBaseGrid);
  const showOutline = useGridMachineStore((s) => s.showOutline);
  const hLineSpacing = useGridMachineStore((s) => s.hLineSpacing);
  const vLineSpacing = useGridMachineStore((s) => s.vLineSpacing);
  const diagonalSpacing = useGridMachineStore((s) => s.diagonalSpacing);
  const hiddenLines = useGridMachineStore((s) => s.hiddenLines);
  const toggleHiddenLine = useGridMachineStore((s) => s.toggleHiddenLine);
  const undoHideLine = useGridMachineStore((s) => s.undoHideLine);
  const lineOpacity = useGridMachineStore((s) => s.lineOpacity);
  const pointSize = useGridMachineStore((s) => s.pointSize);
  const logoOpacity = useGridMachineStore((s) => s.logoOpacity);
  const lineColor = useGridMachineStore((s) => s.lineColor);
  const anchorColor = useGridMachineStore((s) => s.anchorColor);
  const handleColor = useGridMachineStore((s) => s.handleColor);
  const bgMode = useGridMachineStore((s) => s.bgMode);
  const baseGridSpacing = useGridMachineStore((s) => s.baseGridSpacing);

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

    ctx.fillStyle = bgMode === 'dark' ? '#0a0a0a' : '#f5f5f5';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (!analysis) return;

    const vb = analysis.viewBox;
    const padding = 60;
    const availW = rect.width - padding * 2;
    const availH = rect.height - padding * 2;
    const fitScale = Math.min(availW / vb.width, availH / vb.height);
    const totalScale = fitScale * zoom;
    const offsetX = rect.width / 2 - (vb.x + vb.width / 2) * totalScale + panX;
    const offsetY = rect.height / 2 - (vb.y + vb.height / 2) * totalScale + panY;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(totalScale, totalScale);

    if (showBaseGrid) {
      ctx.strokeStyle = bgMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5 / totalScale;
      const step = baseGridSpacing;
      const startX = Math.floor(vb.x / step) * step;
      const endX = vb.x + vb.width;
      const startY = Math.floor(vb.y / step) * step;
      const endY = vb.y + vb.height;
      for (let x = startX; x <= endX; x += step) {
        ctx.beginPath(); ctx.moveTo(x, vb.y); ctx.lineTo(x, endY); ctx.stroke();
      }
      for (let y = startY; y <= endY; y += step) {
        ctx.beginPath(); ctx.moveTo(vb.x, y); ctx.lineTo(endX, y); ctx.stroke();
      }
    }

    if (svgContent && logoOpacity > 0) {
      drawSvgLogo(ctx, svgContent, vb, logoOpacity, totalScale);
    }

    if (showOutline) {
      drawOutline(ctx, analysis.segments, totalScale, bgMode);
    }

    const allGridLines = generateGridLines(analysis.points, vb, {
      horizontal: showHLines,
      vertical: showVLines,
      diagonal: showDiagonals,
      hLineSpacing,
      vLineSpacing,
      diagonalSpacing,
    });
    allGridLinesRef.current = { lines: allGridLines, offsetX, offsetY, totalScale };
    const visibleLines = allGridLines.filter((_, i) => !hiddenLines.has(i));
    drawGridLines(ctx, visibleLines, lineColor, lineOpacity, totalScale);

    if (showHandles) {
      drawHandles(ctx, analysis.points, analysis.segments, handleColor, pointSize, totalScale);
    }

    if (showAnchors) {
      drawAnchors(ctx, analysis.points, anchorColor, pointSize, totalScale);
    }

    ctx.restore();
  }, [analysis, svgContent, zoom, panX, panY, showAnchors, showHandles, showHLines, showVLines, showDiagonals, showBaseGrid, showOutline, lineOpacity, pointSize, logoOpacity, lineColor, anchorColor, handleColor, bgMode, baseGridSpacing, hLineSpacing, vLineSpacing, diagonalSpacing, hiddenLines]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  }, [zoom, setZoom]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.altKey || e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { lines, offsetX, offsetY, totalScale } = allGridLinesRef.current;
    const hitRadius = 6;

    for (let i = 0; i < lines.length; i++) {
      if (hiddenLines.has(i)) continue;
      const l = lines[i];
      const sx1 = l.x1 * totalScale + offsetX;
      const sy1 = l.y1 * totalScale + offsetY;
      const sx2 = l.x2 * totalScale + offsetX;
      const sy2 = l.y2 * totalScale + offsetY;
      const dist = pointToSegmentDist(mx, my, sx1, sy1, sx2, sy2);
      if (dist < hitRadius) {
        toggleHiddenLine(i);
        return;
      }
    }
  }, [hiddenLines, toggleHiddenLine]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanningRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setPan(panX + dx, panY + dy);
  }, [panX, panY, setPan]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    undoHideLine();
  }, [undoHideLine]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoHideLine();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoHideLine]);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    exportSvg: () => buildExportSvg(),
  }));

  function buildExportSvg(): string {
    if (!analysis) return '';
    const vb = analysis.viewBox;
    const margin = Math.max(vb.width, vb.height) * 0.1;
    const svgW = vb.width + margin * 2;
    const svgH = vb.height + margin * 2;
    const ox = vb.x - margin;
    const oy = vb.y - margin;

    const bgFill = bgMode === 'dark' ? '#0a0a0a' : '#f5f5f5';
    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${svgW} ${svgH}" width="${Math.round(svgW)}" height="${Math.round(svgH)}">`);
    parts.push(`<rect x="${ox}" y="${oy}" width="${svgW}" height="${svgH}" fill="${bgFill}"/>`);

    if (svgContent && logoOpacity > 0) {
      parts.push(`<g opacity="${logoOpacity}">${extractSvgInner(svgContent)}</g>`);
    }

    if (showOutline) {
      const strokeColor = bgMode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
      for (const seg of analysis.segments) {
        if (seg.type === 'line') {
          parts.push(`<line x1="${seg.from.x}" y1="${seg.from.y}" x2="${seg.to.x}" y2="${seg.to.y}" stroke="${strokeColor}" stroke-width="1" fill="none"/>`);
        }
      }
    }

    const gridLines = generateGridLines(analysis.points, vb, { horizontal: showHLines, vertical: showVLines, diagonal: showDiagonals });
    for (const l of gridLines) {
      parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${lineColor}" stroke-opacity="${lineOpacity}" stroke-width="0.5" stroke-dasharray="4 4"/>`);
    }

    const anchors = analysis.points.filter(p => p.type === 'anchor');
    if (showAnchors) {
      const half = pointSize * 0.5;
      for (const p of anchors) {
        parts.push(`<rect x="${p.x - half}" y="${p.y - half}" width="${pointSize}" height="${pointSize}" fill="${anchorColor}"/>`);
      }
    }

    if (showHandles) {
      const handlesArr = analysis.points.filter(p => p.type === 'handle');
      const r = pointSize * 0.4;
      for (const p of handlesArr) {
        parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="${handleColor}" stroke-width="0.5"/>`);
      }
      for (const seg of analysis.segments) {
        if (seg.handles) {
          for (const h of seg.handles) {
            parts.push(`<line x1="${seg.from.x}" y1="${seg.from.y}" x2="${h.x}" y2="${h.y}" stroke="${handleColor}" stroke-opacity="0.3" stroke-width="0.5"/>`);
          }
        }
      }
    }

    parts.push('</svg>');
    return parts.join('\n');
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-crosshair"
      onWheel={handleWheel}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
});

GridCanvas.displayName = 'GridCanvas';

function extractSvgInner(svgString: string): string {
  const match = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return match ? match[1] : '';
}

const svgImageCache = new Map<string, HTMLImageElement>();

function drawSvgLogo(ctx: CanvasRenderingContext2D, svgStr: string, vb: { x: number; y: number; width: number; height: number }, opacity: number, _scale: number) {
  let img = svgImageCache.get(svgStr);
  if (!img) {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);
    const placeholder = new Image();
    svgImageCache.set(svgStr, placeholder);
    loadImage(blobUrl, null).then((loaded) => {
      svgImageCache.set(svgStr, loaded);
      const canvas = document.querySelector('.grid-machine-canvas') as HTMLCanvasElement;
      if (canvas) canvas.dispatchEvent(new Event('svgloaded'));
    });
    return;
  }
  if (!img.complete || !img.naturalWidth) return;
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, vb.x, vb.y, vb.width, vb.height);
  ctx.globalAlpha = 1;
}

function drawOutline(ctx: CanvasRenderingContext2D, segments: Segment[], totalScale: number, bgMode: string) {
  ctx.strokeStyle = bgMode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1 / totalScale;
  ctx.setLineDash([]);

  for (const seg of segments) {
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

function drawGridLines(ctx: CanvasRenderingContext2D, lines: GridLine[], color: string, opacity: number, totalScale: number) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = 0.5 / totalScale;
  ctx.setLineDash([4 / totalScale, 4 / totalScale]);

  for (const l of lines) {
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

function drawAnchors(ctx: CanvasRenderingContext2D, points: Point[], color: string, size: number, totalScale: number) {
  const anchors = points.filter(p => p.type === 'anchor');
  const half = (size / 2) / totalScale;
  ctx.fillStyle = color;

  for (const p of anchors) {
    ctx.fillRect(p.x - half, p.y - half, half * 2, half * 2);
  }
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function drawHandles(ctx: CanvasRenderingContext2D, points: Point[], segments: Segment[], color: string, size: number, totalScale: number) {
  const handlesArr = points.filter(p => p.type === 'handle');
  const r = (size * 0.4) / totalScale;

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5 / totalScale;
  ctx.setLineDash([]);

  for (const seg of segments) {
    if (seg.handles) {
      ctx.globalAlpha = 0.3;
      for (const h of seg.handles) {
        ctx.beginPath();
        ctx.moveTo(seg.from.x, seg.from.y);
        ctx.lineTo(h.x, h.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.fillStyle = 'transparent';
  for (const p of handlesArr) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
