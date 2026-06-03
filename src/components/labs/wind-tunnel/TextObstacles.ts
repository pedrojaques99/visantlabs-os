export interface RasterizeParams {
  text: string;
  fontFamily: string;
  fontSize: number;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
  bold?: boolean;
  offsetX?: number;
  offsetY?: number;
}

function IX(i: number, j: number, N: number): number {
  return i + (N + 2) * j;
}

function createTextCanvas(
  text: string,
  font: string,
  w: number,
  h: number,
  ox = 0,
  oy = 0
): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2 + ox * w, h / 2 + oy * h);
  return ctx;
}

export function rasterizeTextToObstacles(p: RasterizeParams): boolean[] {
  const N = p.gridSize;
  const size = (N + 2) * (N + 2);
  const obs = new Array<boolean>(size).fill(false);
  const weight = p.bold ? 'bold ' : '';
  const font = `${weight}${p.fontSize}px ${p.fontFamily}`;
  const ctx = createTextCanvas(
    p.text,
    font,
    p.canvasWidth,
    p.canvasHeight,
    p.offsetX ?? 0,
    p.offsetY ?? 0
  );
  const img = ctx.getImageData(0, 0, p.canvasWidth, p.canvasHeight);
  const d = img.data;
  const cw = p.canvasWidth,
    ch = p.canvasHeight;

  for (let j = 1; j <= N; j++) {
    for (let i = 1; i <= N; i++) {
      const x0 = Math.floor(((i - 1) / N) * cw);
      const x1 = Math.floor((i / N) * cw);
      const y0 = Math.floor(((j - 1) / N) * ch);
      const y1 = Math.floor((j / N) * ch);
      let hit = false;
      for (let y = y0; y < y1 && !hit; y++)
        for (let x = x0; x < x1 && !hit; x++) if (d[(y * cw + x) * 4] > 128) hit = true;
      obs[IX(i, j, N)] = hit;
    }
  }

  // Dilate by 1 cell
  const dilated = [...obs];
  for (let j = 1; j <= N; j++)
    for (let i = 1; i <= N; i++)
      if (obs[IX(i, j, N)])
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ni = i + di,
              nj = j + dj;
            if (ni >= 1 && ni <= N && nj >= 1 && nj <= N) dilated[IX(ni, nj, N)] = true;
          }
  return dilated;
}

export function autoFontSize(
  text: string,
  canvasWidth: number,
  canvasHeight: number,
  fontFamily: string,
  scale = 1
): number {
  const c = document.createElement('canvas');
  c.width = canvasWidth;
  c.height = canvasHeight;
  const ctx = c.getContext('2d')!;
  const target = canvasWidth * 0.6 * scale;
  let size = Math.floor((target / text.length) * 1.5);
  ctx.font = `${size}px ${fontFamily}`;
  const measured = ctx.measureText(text).width;
  size = Math.floor(size * (target / measured));
  return Math.min(size, Math.floor(canvasHeight * 0.8 * scale));
}
