import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Download, Trash2, RotateCcw, Copy,
  ChevronLeft, Maximize2, ZoomIn, ZoomOut, Shuffle, Dices,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel } from '@/components/ui/AppShell';

// ─── Types ────────────────────────────────────────────────────────────────────

function ligKey(r1: number, c1: number, r2: number, c2: number): string {
  if (r1 < r2 || (r1 === r2 && c1 < c2)) return `${r1},${c1}-${r2},${c2}`;
  return `${r2},${c2}-${r1},${c1}`;
}

interface GridState {
  cols: number;
  rows: number;
  cells: number[][];
  ligaments: Set<string>;
  blocked: Set<string>;
}

interface VisualConfig {
  dotColor: string;
  bgColor: string;
  dotRadius: number;
  spacing: number;
  blobFactor: number;
  curveTension: number;
  strokeOnly: boolean;
  strokeWidth: number;
  connectDiagonals: boolean;
  glow: number;
  frameW: number;
  frameH: number;
}

// ─── Defaults matching ref screenshot ─────────────────────────────────────────

const DEFAULT_CONFIG: VisualConfig = {
  dotColor: '#f0ead6',
  bgColor: '#0a0a0a',
  dotRadius: 28,
  spacing: 90,
  blobFactor: 0.85,
  curveTension: 0.45,
  strokeOnly: false,
  strokeWidth: 2,
  connectDiagonals: false,
  glow: 4,
  frameW: 800,
  frameH: 800,
};

const FRAME_PRESETS: Record<string, [number, number]> = {
  '800×800': [800, 800],
  '1080×1080': [1080, 1080],
  '1920×1080': [1920, 1080],
  '1080×1920': [1080, 1920],
  '4000×4000': [4000, 4000],
};

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: Record<string, Partial<VisualConfig>> = {
  'Molecular': { dotColor: '#f0ead6', bgColor: '#0a0a0a', blobFactor: 0.85, dotRadius: 28, spacing: 90, strokeOnly: false, connectDiagonals: false, curveTension: 0.45, glow: 4 },
  'Neon': { dotColor: '#00ffd5', bgColor: '#080818', blobFactor: 0.5, dotRadius: 16, spacing: 60, strokeOnly: false, connectDiagonals: false, curveTension: 0.4, glow: 18 },
  'Blueprint': { dotColor: '#4a9eff', bgColor: '#0c1929', blobFactor: 0.35, dotRadius: 10, spacing: 50, strokeOnly: true, strokeWidth: 1.5, connectDiagonals: false, curveTension: 0.3, glow: 0 },
  'Brutalist': { dotColor: '#ffffff', bgColor: '#000000', blobFactor: 0.9, dotRadius: 24, spacing: 80, strokeOnly: false, connectDiagonals: true, curveTension: 0.7, glow: 0 },
  'Warm': { dotColor: '#ff6b35', bgColor: '#1a0a00', blobFactor: 0.6, dotRadius: 18, spacing: 65, strokeOnly: false, connectDiagonals: true, curveTension: 0.5, glow: 12 },
  'Mono': { dotColor: '#666666', bgColor: '#111111', blobFactor: 0.25, dotRadius: 6, spacing: 40, strokeOnly: true, strokeWidth: 0.8, connectDiagonals: false, curveTension: 0.2, glow: 0 },
};

// ─── Seed patterns ────────────────────────────────────────────────────────────

function calcGridSize(config: VisualConfig): { cols: number; rows: number } {
  const cols = Math.max(2, Math.floor(config.frameW / config.spacing) + 1) + 4;
  const rows = Math.max(2, Math.floor(config.frameH / config.spacing) + 1) + 4;
  return { cols, rows };
}

type SeedFn = (cols: number, rows: number) => number[][];

const SEEDS: Record<string, SeedFn> = {
  'Cross': (cols, rows) => {
    const g = createGrid(cols, rows);
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    for (let i = 0; i < rows; i++) g[i][cx] = 1;
    for (let j = 0; j < cols; j++) g[cy][j] = 1;
    return g;
  },
  'Diamond': (cols, rows) => {
    const g = createGrid(cols, rows);
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    const rad = Math.min(cx, cy) - 1;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (Math.abs(r - cy) + Math.abs(c - cx) <= rad) g[r][c] = 1;
    return g;
  },
  'Ring': (cols, rows) => {
    const g = createGrid(cols, rows);
    const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
    const rad = Math.min(cx, cy) - 0.5;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const d = Math.hypot(r - cy, c - cx);
        if (d >= rad - 1.5 && d <= rad + 0.5) g[r][c] = 1;
      }
    return g;
  },
  'Grid': (cols, rows) => {
    const g = createGrid(cols, rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (r % 2 === 0 && c % 2 === 0) g[r][c] = 1;
    return g;
  },
  'Diagonal': (cols, rows) => {
    const g = createGrid(cols, rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if ((r + c) % 3 === 0) g[r][c] = 1;
    return g;
  },
  'Random': (cols, rows) => {
    const g = createGrid(cols, rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        g[r][c] = Math.random() > 0.55 ? 1 : 0;
    return g;
  },
  'Molecule': (cols, rows) => {
    const g = createGrid(cols, rows);
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    // Central cluster matching ref Frame 4570
    const offsets = [[0,0],[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1],[2,0],[-2,0],[0,2],[0,-2]];
    for (const [dr, dc] of offsets) {
      const r = cy + dr, c = cx + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) g[r][c] = 1;
    }
    return g;
  },
};

// ─── Rendering engine ─────────────────────────────────────────────────────────

function createGrid(cols: number, rows: number, old?: number[][]): number[][] {
  const maxR = old ? Math.max(rows, old.length) : rows;
  const maxC = old ? Math.max(cols, old[0]?.length ?? 0) : cols;
  const cells: number[][] = [];
  for (let r = 0; r < maxR; r++) {
    cells[r] = [];
    for (let c = 0; c < maxC; c++)
      cells[r][c] = old && r < old.length && c < (old[r]?.length ?? 0) ? old[r][c] : 0;
  }
  return cells;
}

function getDotPos(r: number, c: number, sp: number, cols: number, rows: number, frameX: number, frameY: number, fw: number, fh: number) {
  const ox = frameX + (fw - (cols - 1) * sp) / 2;
  const oy = frameY + (fh - (rows - 1) * sp) / 2;
  return { x: ox + c * sp, y: oy + r * sp };
}

function drawMetaball(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number,
  handleSize: number, tension: number, strokeOnly: boolean,
) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d === 0 || d > (r1 + r2) * 5) return;

  const u1 = Math.atan2(y2 - y1, x2 - x1);
  const u2 = Math.acos(Math.min((r1 + r2) / d, 1));
  const a1a = u1 + u2, a1b = u1 - u2;
  const a2a = u1 + Math.PI - u2, a2b = u1 - Math.PI + u2;

  const p1a = { x: x1 + r1 * Math.cos(a1a), y: y1 + r1 * Math.sin(a1a) };
  const p1b = { x: x1 + r1 * Math.cos(a1b), y: y1 + r1 * Math.sin(a1b) };
  const p2a = { x: x2 + r2 * Math.cos(a2a), y: y2 + r2 * Math.sin(a2a) };
  const p2b = { x: x2 + r2 * Math.cos(a2b), y: y2 + r2 * Math.sin(a2b) };

  const d2 = Math.min(handleSize * d * tension * 2, (d - r1 - r2) / 2);
  const vec = (cx: number, cy: number, angle: number, len: number) => ({
    x: cx + Math.cos(angle) * len, y: cy + Math.sin(angle) * len,
  });

  const h1a = vec(p1a.x, p1a.y, a1a - Math.PI / 2, d2);
  const h1b = vec(p1b.x, p1b.y, a1b + Math.PI / 2, d2);
  const h2a = vec(p2a.x, p2a.y, a2a + Math.PI / 2, d2);
  const h2b = vec(p2b.x, p2b.y, a2b - Math.PI / 2, d2);

  ctx.beginPath();
  ctx.moveTo(p1a.x, p1a.y);
  ctx.bezierCurveTo(h1a.x, h1a.y, h2a.x, h2a.y, p2a.x, p2a.y);
  ctx.arc(x2, y2, r2, a2a, a2b, false);
  ctx.bezierCurveTo(h2b.x, h2b.y, h1b.x, h1b.y, p1b.x, p1b.y);
  ctx.arc(x1, y1, r1, a1b, a1a, false);
  ctx.closePath();
  if (strokeOnly) ctx.stroke(); else ctx.fill();
}

function renderCanvas(canvas: HTMLCanvasElement, state: GridState, config: VisualConfig, zoom: number, eraseHover?: EraseTarget) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { cols, rows, cells } = state;
  const sp = config.spacing * zoom;
  const r = config.dotRadius * zoom;
  const fw = config.frameW * zoom, fh = config.frameH * zoom;

  // Viewport bg
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(0, 0, w, h);

  // Frame bg (centered)
  const fx = (w - fw) / 2, fy = (h - fh) / 2;
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(fx, fy, fw, fh);

  // Subtle frame border
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  ctx.strokeRect(fx, fy, fw, fh);

  // Ghost grid
  ctx.fillStyle = config.dotColor + '08';
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (cells[row][col]) continue;
      const p = getDotPos(row, col, sp, cols, rows, fx, fy, fw, fh);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, r * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }

  if (config.glow > 0) { ctx.shadowColor = config.dotColor; ctx.shadowBlur = config.glow * zoom; }

  ctx.fillStyle = config.dotColor;
  ctx.strokeStyle = config.dotColor;
  ctx.lineWidth = config.strokeWidth * zoom;

  const ortho: [number, number][] = [[0, 1], [1, 0]];
  const diag: [number, number][] = [[1, 1], [1, -1]];
  const neighbors = config.connectDiagonals ? [...ortho, ...diag] : ortho;

  const drawnPairs = new Set<string>();

  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (!cells[row][col]) continue;
      const p1 = getDotPos(row, col, sp, cols, rows, fx, fy, fw, fh);
      for (const [dr, dc] of neighbors) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr]?.[nc]) {
          const key = ligKey(row, col, nr, nc);
          if (state.blocked.has(key)) continue;
          drawnPairs.add(key);
          const p2 = getDotPos(nr, nc, sp, cols, rows, fx, fy, fw, fh);
          const f = (Math.abs(dr) + Math.abs(dc)) > 1 ? 0.65 : 1;
          drawMetaball(ctx, p1.x, p1.y, r, p2.x, p2.y, r, config.blobFactor * f, config.curveTension, config.strokeOnly);
        }
      }
    }

  for (const lig of state.ligaments) {
    if (drawnPairs.has(lig)) continue;
    const [a, b] = lig.split('-');
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    if (!cells[r1]?.[c1] || !cells[r2]?.[c2]) continue;
    const p1 = getDotPos(r1, c1, sp, cols, rows, fx, fy, fw, fh);
    const p2 = getDotPos(r2, c2, sp, cols, rows, fx, fy, fw, fh);
    const dist = Math.abs(r2 - r1) + Math.abs(c2 - c1);
    const f = dist > 1 ? 0.65 : 1;
    drawMetaball(ctx, p1.x, p1.y, r, p2.x, p2.y, r, config.blobFactor * f, config.curveTension, config.strokeOnly);
  }

  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (!cells[row][col]) continue;
      const p = getDotPos(row, col, sp, cols, rows, fx, fy, fw, fh);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (config.strokeOnly) ctx.stroke(); else ctx.fill();
    }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Erase hover preview
  if (eraseHover) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    if (eraseHover.type === 'dot') {
      const p = getDotPos(eraseHover.r, eraseHover.c, sp, cols, rows, fx, fy, fw, fh);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const [a, b] = eraseHover.key.split('-');
      const [r1, c1] = a.split(',').map(Number);
      const [r2, c2] = b.split(',').map(Number);
      const p1 = getDotPos(r1, c1, sp, cols, rows, fx, fy, fw, fh);
      const p2 = getDotPos(r2, c2, sp, cols, rows, fx, fy, fw, fh);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const nx = -dy / len * (r * 0.4), ny = dx / len * (r * 0.4);
        ctx.beginPath();
        ctx.moveTo(p1.x + nx, p1.y + ny);
        ctx.lineTo(p2.x + nx, p2.y + ny);
        ctx.lineTo(p2.x - nx, p2.y - ny);
        ctx.lineTo(p1.x - nx, p1.y - ny);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function hitTest(mx: number, my: number, state: GridState, config: VisualConfig, zoom: number, w: number, h: number) {
  const sp = config.spacing * zoom;
  const fw = config.frameW * zoom, fh = config.frameH * zoom;
  const fx = (w - fw) / 2, fy = (h - fh) / 2;
  let best = sp * 0.45, br = -1, bc = -1;
  for (let r = 0; r < state.rows; r++)
    for (let c = 0; c < state.cols; c++) {
      const p = getDotPos(r, c, sp, state.cols, state.rows, fx, fy, fw, fh);
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < best) { best = d; br = r; bc = c; }
    }
  return br >= 0 ? { r: br, c: bc } : null;
}

type EraseTarget = { type: 'dot'; r: number; c: number } | { type: 'ligament'; key: string } | null;

function pointToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function hitTestErase(mx: number, my: number, state: GridState, config: VisualConfig, zoom: number, w: number, h: number): EraseTarget {
  const sp = config.spacing * zoom;
  const r = config.dotRadius * zoom;
  const fw = config.frameW * zoom, fh = config.frameH * zoom;
  const fx = (w - fw) / 2, fy = (h - fh) / 2;

  // Check dots first (active cells within dot radius)
  for (let row = 0; row < state.rows; row++)
    for (let col = 0; col < state.cols; col++) {
      if (!state.cells[row][col]) continue;
      const p = getDotPos(row, col, sp, state.cols, state.rows, fx, fy, fw, fh);
      if (Math.hypot(mx - p.x, my - p.y) <= r * 1.2) return { type: 'dot', r: row, c: col };
    }

  // Check ligaments (all connection pairs)
  const threshold = r * 1.5;
  let bestDist = threshold;
  let bestKey: string | null = null;

  const allPairs = new Set<string>();
  const ortho: [number, number][] = [[0, 1], [1, 0]];
  const diag: [number, number][] = [[1, 1], [1, -1]];
  const neighbors = config.connectDiagonals ? [...ortho, ...diag] : ortho;
  for (let row = 0; row < state.rows; row++)
    for (let col = 0; col < state.cols; col++) {
      if (!state.cells[row][col]) continue;
      for (const [dr, dc] of neighbors) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols && state.cells[nr]?.[nc]) {
          const k = ligKey(row, col, nr, nc);
          if (!state.blocked.has(k)) allPairs.add(k);
        }
      }
    }
  for (const lig of state.ligaments) allPairs.add(lig);

  for (const key of allPairs) {
    const [a, b] = key.split('-');
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    if (!state.cells[r1]?.[c1] || !state.cells[r2]?.[c2]) continue;
    const p1 = getDotPos(r1, c1, sp, state.cols, state.rows, fx, fy, fw, fh);
    const p2 = getDotPos(r2, c2, sp, state.cols, state.rows, fx, fy, fw, fh);
    const d = pointToSegDist(mx, my, p1.x, p1.y, p2.x, p2.y);
    if (d < bestDist) { bestDist = d; bestKey = key; }
  }

  return bestKey ? { type: 'ligament', key: bestKey } : null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const GridPaintPage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const pencilLastCell = useRef<{ r: number; c: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const [eraseHover, setEraseHover] = useState<EraseTarget>(null);
  const [history, setHistory] = useState<{ cells: number[][]; ligaments: Set<string>; blocked: Set<string> }[]>([]);
  const [zoom, setZoom] = useState(1);
  const [showPanel, setShowPanel] = useState(true);
  const [activeCount, setActiveCount] = useState(0);

  const [config, setConfig] = useState<VisualConfig>(DEFAULT_CONFIG);
  const [grid, setGrid] = useState<GridState>(() => {
    const { cols, rows } = calcGridSize(DEFAULT_CONFIG);
    return { cols, rows, cells: createGrid(cols, rows), ligaments: new Set<string>(), blocked: new Set<string>() };
  });

  const updateConfig = useCallback((partial: Partial<VisualConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  }, []);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Render
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCanvas(canvas, grid, config, zoom, eraseHover);
    let count = 0;
    for (const row of grid.cells) for (const c of row) if (c) count++;
    setActiveCount(count);
  }, [grid, config, zoom, eraseHover]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const { cols, rows } = calcGridSize(config);
    setGrid(prev => ({
      cols, rows,
      cells: createGrid(cols, rows, prev.cells),
      ligaments: prev.ligaments, blocked: prev.blocked,
    }));
  }, [config.frameW, config.frameH, config.spacing]);

  // Auto-expand frame to hug content
  useEffect(() => {
    const { cells } = grid;
    let maxR = -1, maxC = -1;
    for (let r = 0; r < cells.length; r++)
      for (let c = 0; c < (cells[r]?.length ?? 0); c++)
        if (cells[r][c]) { if (r > maxR) maxR = r; if (c > maxC) maxC = c; }
    if (maxR < 0) return;
    const frameCols = Math.floor(config.frameW / config.spacing) + 1;
    const frameRows = Math.floor(config.frameH / config.spacing) + 1;
    let changed = false;
    let fw = config.frameW, fh = config.frameH;
    if (maxC >= frameCols - 1) { fw = (maxC + 2) * config.spacing; changed = true; }
    if (maxR >= frameRows - 1) { fh = (maxR + 2) * config.spacing; changed = true; }
    if (changed) setConfig(prev => ({ ...prev, frameW: fw, frameH: fh }));
  }, [grid.cells, config.frameW, config.frameH, config.spacing]);

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-30), { cells: grid.cells.map(r => [...r]), ligaments: new Set(grid.ligaments), blocked: new Set(grid.blocked) }]);
  }, [grid.cells, grid.ligaments, grid.blocked]);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (!prev.length) return prev;
      const snap = prev[prev.length - 1];
      setGrid(g => ({ ...g, cells: snap.cells, ligaments: snap.ligaments, blocked: snap.blocked }));
      return prev.slice(0, -1);
    });
  }, []);

  const applySeed = useCallback((name: string) => {
    const seedFn = SEEDS[name];
    if (!seedFn) return;
    pushHistory();
    setGrid(prev => ({ ...prev, cells: seedFn(prev.cols, prev.rows), ligaments: new Set<string>(), blocked: new Set<string>() }));
  }, [pushHistory]);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const applyPaint = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    const hit = hitTest(x, y, grid, config, zoom, w, h);
    if (!hit) return;

    const last = pencilLastCell.current;
    pencilLastCell.current = hit;
    setGrid(prev => {
      const next = prev.cells.map(row => [...row]);
      next[hit.r][hit.c] = 1;
      const nextLig = new Set(prev.ligaments);
      if (last && (last.r !== hit.r || last.c !== hit.c)) {
        let r0 = last.r, c0 = last.c;
        const r1 = hit.r, c1 = hit.c;
        const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
        const sr = r0 < r1 ? 1 : -1;
        const sc = c0 < c1 ? 1 : -1;
        let err = dc - dr;
        while (true) {
          const pr = r0, pc = c0;
          if (r0 === r1 && c0 === c1) break;
          const e2 = 2 * err;
          if (e2 > -dr) { err -= dr; c0 += sc; }
          if (e2 < dc) { err += dc; r0 += sr; }
          if (r0 >= 0 && r0 < prev.rows && c0 >= 0 && c0 < prev.cols) {
            next[r0][c0] = 1;
            nextLig.add(ligKey(pr, pc, r0, c0));
          }
        }
      }
      return { ...prev, cells: next, ligaments: nextLig };
    });
  }, [grid, config, zoom]);

  const applyErase = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    const target = hitTestErase(x, y, grid, config, zoom, w, h);
    if (!target) return;
    pushHistory();
    if (target.type === 'dot') {
      setGrid(prev => {
        const next = prev.cells.map(row => [...row]);
        next[target.r][target.c] = 0;
        const prefix = `${target.r},${target.c}-`;
        const suffix = `-${target.r},${target.c}`;
        const nextLig = new Set<string>();
        for (const lig of prev.ligaments) {
          if (!lig.startsWith(prefix) && !lig.endsWith(suffix)) nextLig.add(lig);
        }
        const nextBlocked = new Set<string>();
        for (const b of prev.blocked) {
          if (!b.startsWith(prefix) && !b.endsWith(suffix)) nextBlocked.add(b);
        }
        return { ...prev, cells: next, ligaments: nextLig, blocked: nextBlocked };
      });
    } else {
      setGrid(prev => {
        const nextLig = new Set(prev.ligaments);
        const nextBlocked = new Set(prev.blocked);
        if (nextLig.has(target.key)) {
          nextLig.delete(target.key);
        } else {
          nextBlocked.add(target.key);
        }
        return { ...prev, ligaments: nextLig, blocked: nextBlocked };
      });
    }
    setEraseHover(null);
  }, [grid, config, zoom, pushHistory]);

  const computeEraseHover = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    setEraseHover(hitTestErase(x, y, grid, config, zoom, w, h));
  }, [grid, config, zoom]);

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (e.button === 2) {
      applyErase(coords.x, coords.y);
      return;
    }

    pushHistory();
    isDrawing.current = true;
    pencilLastCell.current = null;
    applyPaint(coords.x, coords.y);
  }, [pushHistory, getCanvasCoords, applyPaint, applyErase]);

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Delayed erase hover: only shows after cursor is idle 300ms
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    lastMousePos.current = coords;
    if (!isDrawing.current) {
      setEraseHover(null);
      hoverTimer.current = setTimeout(() => {
        if (lastMousePos.current) computeEraseHover(lastMousePos.current.x, lastMousePos.current.y);
      }, 300);
    }

    if (!isDrawing.current) return;
    applyPaint(coords.x, coords.y);
  }, [getCanvasCoords, applyPaint, computeEraseHover]);

  const onPointerUp = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    pushHistory();
    isDrawing.current = true;
    pencilLastCell.current = null;
    const t = e.touches[0];
    const coords = getCanvasCoords(t.clientX, t.clientY);
    if (coords) applyPaint(coords.x, coords.y);
  }, [pushHistory, getCanvasCoords, applyPaint]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const t = e.touches[0];
    const coords = getCanvasCoords(t.clientX, t.clientY);
    if (coords) applyPaint(coords.x, coords.y);
  }, [getCanvasCoords, applyPaint]);

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'grid-paint.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportSVG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    const { cols, rows, cells } = grid;
    const sp = config.spacing;
    const r = config.dotRadius;
    const fw = config.frameW, fh = config.frameH;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}">`;
    svg += `<rect width="100%" height="100%" fill="${config.bgColor}"/>`;
    svg += `<g fill="${config.dotColor}">`;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        if (!cells[row][col]) continue;
        const p = getDotPos(row, col, sp, cols, rows, 0, 0, fw, fh);
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}"/>`;
      }
    svg += '</g></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'grid-paint.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'Tab') { e.preventDefault(); setShowPanel(p => !p); }
      if (e.key === '=' || e.key === '+') setZoom(z => Math.min(z + 0.1, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.1, 0.3));
      if (e.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  // Ctrl+Scroll zoom
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(z => Math.min(3, Math.max(0.3, z - e.deltaY * 0.002)));
      }
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => window.removeEventListener('wheel', handler);
  }, []);

  return (
    <AppShell>
      {/* Full-screen canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onContextMenu={e => e.preventDefault()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onPointerUp}
      />

      {/* Top bar */}
      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to Apps" position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={() => navigate('/apps')}>
                <ChevronLeft size={14} />
              </Button>
            </Tooltip>
            <div className="w-px h-4 bg-white/[0.06] mx-1" />
            <MicroTitle className="text-neutral-400 tracking-tight">Grid Paint</MicroTitle>
            <MicroTitle className="text-neutral-600 ml-2">{activeCount} dots</MicroTitle>
          </>
        }
        right={
          <>
            <Tooltip content="Export SVG" position="bottom">
              <Button variant="surface" size="xs" className="gap-1.5" onClick={exportSVG}>
                <Download size={10} /> SVG
              </Button>
            </Tooltip>
            <Tooltip content="Export PNG" position="bottom">
              <Button variant="surface" size="xs" className="gap-1.5" onClick={exportPNG}>
                <Download size={10} /> PNG
              </Button>
            </Tooltip>
            <Tooltip content="Copy state to clipboard" position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={() => navigator.clipboard.writeText(JSON.stringify({ grid: grid.cells, config }))}>
                <Copy size={12} />
              </Button>
            </Tooltip>
          </>
        }
      />

      {/* Bottom toolbar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-0.5 backdrop-blur-xl border border-neutral-800/50 rounded-xl px-1.5 py-1 shadow-lg" style={{ backgroundColor: '#0a0a0add' }}>

          <Tooltip content="Zoom Out" position="top">
            <Button variant="ghost" className="w-9 h-9 flex items-center justify-center rounded-md" onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}>
              <ZoomOut size={16} strokeWidth={2} />
            </Button>
          </Tooltip>
          <span className="text-[10px] font-mono text-neutral-400 w-[34px] text-center tabular-nums select-none">{(zoom * 100).toFixed(0)}%</span>
          <Tooltip content="Zoom In" position="top">
            <Button variant="ghost" className="w-9 h-9 flex items-center justify-center rounded-md" onClick={() => setZoom(z => Math.min(3, z + 0.15))}>
              <ZoomIn size={16} strokeWidth={2} />
            </Button>
          </Tooltip>
          <Tooltip content="Reset zoom" position="top">
            <Button variant="ghost" className="w-9 h-9 flex items-center justify-center rounded-md" onClick={() => setZoom(1)}>
              <Maximize2 size={16} strokeWidth={2} />
            </Button>
          </Tooltip>

          <div className="w-px h-5 bg-neutral-800/50 mx-0.5" />

          <Tooltip content="Undo (Ctrl+Z)" position="top">
            <Button variant="ghost" className="w-9 h-9 flex items-center justify-center rounded-md" onClick={undo}>
              <RotateCcw size={16} strokeWidth={2} />
            </Button>
          </Tooltip>
          <Tooltip content="Clear canvas" position="top">
            <Button variant="ghost" className="w-9 h-9 flex items-center justify-center rounded-md" onClick={() => { pushHistory(); setGrid(prev => ({ ...prev, cells: createGrid(prev.cols, prev.rows), ligaments: new Set<string>(), blocked: new Set<string>() })); }}>
              <Trash2 size={16} strokeWidth={2} />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Right panel */}
      <AppShellPanel visible={showPanel} width={232}>
        <GlassPanel className="h-full overflow-y-auto backdrop-blur-xl bg-neutral-950/80 scrollbar-none rounded-xl">
          {/* Presets */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Presets</MicroTitle>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(PRESETS).map(([name, preset]) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="xs"
                  onClick={() => updateConfig(preset)}
                  className="text-[9px] text-neutral-500 hover:text-white font-medium"
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>

          {/* Seeds */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Seeds</MicroTitle>
            <div className="grid grid-cols-3 gap-1">
              {Object.keys(SEEDS).map(name => (
                <Button
                  key={name}
                  variant="ghost"
                  size="xs"
                  onClick={() => applySeed(name)}
                  className="text-[9px] text-neutral-500 hover:text-white font-medium"
                >
                  {name === 'Random' ? <><Dices size={10} className="mr-0.5" /> Rand</> : name}
                </Button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="p-3 space-y-2.5 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Color</MicroTitle>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative w-7 h-7 rounded-lg border border-white/10 overflow-hidden shadow-inner">
                  <input type="color" value={config.dotColor} onChange={e => updateConfig({ dotColor: e.target.value })}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                  <div className="w-full h-full rounded-lg" style={{ background: config.dotColor }} />
                </div>
                <MicroTitle className="text-neutral-500 group-hover:text-neutral-300 text-[10px]">Dot</MicroTitle>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative w-7 h-7 rounded-lg border border-white/10 overflow-hidden shadow-inner">
                  <input type="color" value={config.bgColor} onChange={e => updateConfig({ bgColor: e.target.value })}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                  <div className="w-full h-full rounded-lg" style={{ background: config.bgColor }} />
                </div>
                <MicroTitle className="text-neutral-500 group-hover:text-neutral-300 text-[10px]">BG</MicroTitle>
              </label>
            </div>
          </div>

          {/* Frame */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Frame</MicroTitle>
              <MicroTitle className="text-neutral-700 text-[9px]">{grid.cols}×{grid.rows} dots</MicroTitle>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(FRAME_PRESETS).map(([label, [w, h]]) => (
                <Button key={label} variant="ghost" size="xs"
                  onClick={() => updateConfig({ frameW: w, frameH: h })}
                  className={cn('text-[9px] font-medium', config.frameW === w && config.frameH === h ? 'text-white bg-white/10' : 'text-neutral-600')}
                >
                  {label}
                </Button>
              ))}
            </div>
            <NodeSlider label="Width" value={config.frameW} min={200} max={4000} step={10}
              onChange={v => updateConfig({ frameW: v })} formatValue={v => `${v}px`} />
            <NodeSlider label="Height" value={config.frameH} min={200} max={4000} step={10}
              onChange={v => updateConfig({ frameH: v })} formatValue={v => `${v}px`} />
            <NodeSlider label="Spacing" value={config.spacing} min={20} max={200} step={1}
              onChange={v => updateConfig({ spacing: v })} formatValue={v => `${v}px`} />
          </div>

          {/* Shape */}
          <div className="p-3 space-y-1 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Shape</MicroTitle>
            <NodeSlider label="Dot Radius" value={config.dotRadius} min={2} max={40} step={1}
              onChange={v => updateConfig({ dotRadius: v })} formatValue={v => `${v}px`} />
            <NodeSlider label="Blob" value={config.blobFactor} min={0.05} max={1} step={0.05}
              onChange={v => updateConfig({ blobFactor: v })} />
            <NodeSlider label="Tension" value={config.curveTension} min={0.05} max={1} step={0.05}
              onChange={v => updateConfig({ curveTension: v })} />
            <NodeSlider label="Glow" value={config.glow} min={0} max={30} step={1}
              onChange={v => updateConfig({ glow: v })} formatValue={v => `${v}px`} />
          </div>

          {/* Stroke */}
          <div className="p-3 space-y-2.5 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Stroke</MicroTitle>
            <div className="flex items-center justify-between">
              <MicroTitle className="text-neutral-500 text-[10px]">Outline mode</MicroTitle>
              <Switch checked={config.strokeOnly} onCheckedChange={v => updateConfig({ strokeOnly: v })} />
            </div>
            {config.strokeOnly && (
              <NodeSlider label="Width" value={config.strokeWidth} min={0.5} max={5} step={0.25}
                onChange={v => updateConfig({ strokeWidth: v })} formatValue={v => `${v}px`} />
            )}
          </div>

          {/* Connections */}
          <div className="p-3 space-y-2.5">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Connections</MicroTitle>
            <div className="flex items-center justify-between">
              <MicroTitle className="text-neutral-500 text-[10px]">Diagonals</MicroTitle>
              <Switch checked={config.connectDiagonals} onCheckedChange={v => updateConfig({ connectDiagonals: v })} />
            </div>
          </div>
        </GlassPanel>
      </AppShellPanel>

    </AppShell>
  );
};
