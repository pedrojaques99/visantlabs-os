/** Procedural paper: base tone, sepia wash, pulp grain and edge burn, drawn to a 2D canvas. */
import type { PaperSettings, PaperType } from './types';

export const PAPER_STOCKS: { type: PaperType; color: string }[] = [
  { type: 'newspaper-vintage', color: '#e5e1d5' },
  { type: 'aged-parchment', color: '#ebdcb9' },
  { type: 'kraft', color: '#d8c5a8' },
  { type: 'cotton-fine-art', color: '#f6f4ef' },
  { type: 'photostat-dark', color: '#141416' },
  { type: 'transparent', color: '' },
];

/** Relative luminance (0-1) of a #rrggbb color. */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  if (Number.isNaN(n)) return 1;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

const TILE = 256;

function createGrainTile(intensity: number, seed: number, dark: boolean): HTMLCanvasElement | null {
  const tile = document.createElement('canvas');
  tile.width = TILE;
  tile.height = TILE;
  const ctx = tile.getContext('2d');
  if (!ctx) return null;

  const image = ctx.createImageData(TILE, TILE);
  const data = image.data;
  let s = seed || 77;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const maxAlpha = intensity * 255;
  const threshold = dark ? 0.88 : 0.85;
  const [r, g, b] = dark ? [255, 255, 255] : [30, 20, 15];
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = rand() > threshold ? Math.floor(rand() * maxAlpha) : 0;
  }
  ctx.putImageData(image, 0, 0);
  return tile;
}

function seededRandom(seed: number): () => number {
  let s = (seed * 7919 + 13) % 233280 || 77;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export interface PatchRect {
  x: number;
  y: number;
  w: number;
  h: number;
  light: boolean;
  strength: number;
}

/**
 * Pasted paper panels, in fractions of the artwork so they land in the same place at
 * any export size. Snapped to a loose grid: cut paper lines up, it does not scatter.
 */
export function patchRects(amount: number, seed: number): PatchRect[] {
  if (amount <= 0) return [];
  const rand = seededRandom(seed);
  const count = 2 + Math.round((amount / 100) * 8);
  const snap = (v: number) => Math.round(v * 12) / 12;
  return Array.from({ length: count }, () => {
    const x = snap(rand() * 0.85);
    const y = snap(rand() * 0.85);
    const w = Math.max(1 / 12, snap(0.15 + rand() * 0.55));
    const h = Math.max(1 / 12, snap(0.1 + rand() * 0.5));
    return {
      x,
      y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y),
      light: rand() > 0.35,
      strength: 0.35 + rand() * 0.65,
    };
  });
}

function drawPatches(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paper: PaperSettings,
  scale: number,
  seed: number
): void {
  const amount = paper.patches / 100;
  for (const rect of patchRects(paper.patches, seed)) {
    const alpha = rect.strength * (0.25 + amount * 0.45);
    if (paper.patchColor) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = paper.patchColor;
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = rect.light
        ? `rgba(255, 255, 255, ${alpha * 0.55})`
        : `rgba(0, 0, 0, ${alpha * 0.12})`;
    }
    const [x, y, w, h] = [rect.x * width, rect.y * height, rect.w * width, rect.h * height];
    ctx.fillRect(x, y, w, h);
    // The thin shadow of a paper edge is what makes it read as pasted, not as a tint.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.09)';
    ctx.lineWidth = Math.max(0.5, scale);
    ctx.strokeRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
}

function drawScanLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paper: PaperSettings,
  scale: number,
  seed: number,
  dark: boolean
): void {
  const rand = seededRandom(seed + 11);
  const count = Math.round((paper.scanLines / 100) * 16);
  for (let i = 0; i < count; i++) {
    const inverse = rand() > 0.75;
    const ink = dark !== inverse ? '255, 255, 255' : '0, 0, 0';
    ctx.fillStyle = `rgba(${ink}, ${0.06 + rand() * 0.3})`;
    const y = rand() * height;
    const start = rand() > 0.5 ? 0 : rand() * width * 0.6;
    const length = width * (0.25 + rand() * 0.75);
    ctx.fillRect(start, y, length, (1 + rand() * 2) * scale);
  }
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paper: PaperSettings,
  scale: number,
  seed: number,
  dark: boolean
): void {
  const rand = seededRandom(seed + 23);
  const color = dark ? '255, 255, 255' : '0, 0, 0';
  const specks = Math.round((paper.dust / 100) * 320);
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = `rgba(${color}, ${0.15 + rand() * 0.55})`;
    ctx.beginPath();
    ctx.arc(
      rand() * width,
      rand() * height,
      (0.3 + rand() * rand() * rand() * 2.2) * scale,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  const hairs = Math.round((paper.dust / 100) * 4);
  ctx.lineWidth = 0.5 * scale;
  for (let i = 0; i < hairs; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const reach = (90 + rand() * 220) * scale;
    ctx.strokeStyle = `rgba(${color}, ${0.06 + rand() * 0.14})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + (rand() - 0.5) * reach,
      y + (rand() - 0.5) * reach,
      x + (rand() - 0.5) * reach,
      y + (rand() - 0.5) * reach
    );
    ctx.stroke();
  }
}

/**
 * The part of the collage that sits OVER the ink: every other panel covers it
 * partially, so the type disappears behind a clean paper edge. Drawn on top of the art.
 */
export function drawVeil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paper: PaperSettings,
  seed = 42
): void {
  if (paper.paperType === 'transparent' || paper.veil <= 0) return;
  ctx.save();
  ctx.fillStyle = paper.patchColor || paper.baseColor;
  ctx.globalAlpha = (paper.veil / 100) * 0.8;
  patchRects(paper.patches, seed).forEach((rect, i) => {
    if (i % 2 === 0) {
      ctx.fillRect(rect.x * width, rect.y * height, rect.w * width, rect.h * height);
    }
  });
  ctx.restore();
}

/** `scale` keeps the grain the same physical size in the preview and in a 4x export. */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paper: PaperSettings,
  scale = 1,
  seed = 42
): void {
  ctx.clearRect(0, 0, width, height);
  if (paper.paperType === 'transparent') return;

  ctx.save();
  ctx.fillStyle = paper.baseColor;
  ctx.fillRect(0, 0, width, height);

  const dark = luminance(paper.baseColor) < 0.2;

  if (paper.agingSepia > 0 && !dark) {
    const alpha = (paper.agingSepia / 100) * 0.22;
    const wash = ctx.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, `rgba(180, 130, 70, ${alpha * 0.6})`);
    wash.addColorStop(0.5, `rgba(140, 95, 45, ${alpha})`);
    wash.addColorStop(1, `rgba(195, 145, 80, ${alpha * 0.7})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
  }

  drawPatches(ctx, width, height, paper, scale, seed);
  if (paper.fiberGrain > 0) {
    const tile = createGrainTile((paper.fiberGrain / 100) * 0.14, seed, dark);
    const pattern = tile && ctx.createPattern(tile, 'repeat');
    if (pattern) {
      pattern.setTransform(new DOMMatrix().scale(scale));
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }

  if (paper.scanLines > 0) drawScanLines(ctx, width, height, paper, scale, seed, dark);
  if (paper.dust > 0) drawDust(ctx, width, height, paper, scale, seed, dark);

  if (paper.vignette > 0) {
    const strength = (paper.vignette / 100) * 0.4;
    const radius = Math.max(width, height) * 0.75;
    const burn = ctx.createRadialGradient(
      width / 2,
      height / 2,
      radius * 0.45,
      width / 2,
      height / 2,
      radius
    );
    if (dark) {
      burn.addColorStop(0, 'rgba(0, 0, 0, 0)');
      burn.addColorStop(1, `rgba(0, 0, 0, ${strength * 0.7})`);
    } else {
      burn.addColorStop(0, 'rgba(60, 40, 20, 0)');
      burn.addColorStop(0.75, `rgba(70, 45, 20, ${strength * 0.3})`);
      burn.addColorStop(1, `rgba(45, 25, 10, ${strength})`);
    }
    ctx.fillStyle = burn;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}
