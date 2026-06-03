const CACHE = new Map<string, string>();

function getOrCreate(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): string {
  if (CACHE.has(key)) return CACHE.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const url = canvas.toDataURL('image/png');
  CACHE.set(key, url);
  return url;
}

function filmGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function paperFiber(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#e8e0d4';
  ctx.fillRect(0, 0, w, h);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const base = 210 + Math.random() * 30;
    img.data[i] = base;
    img.data[i + 1] = base - 8;
    img.data[i + 2] = base - 20;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(180,170,155,0.15)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
}

function canvasWeave(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#d4c8b0';
  ctx.fillRect(0, 0, w, h);
  const gap = 4;
  ctx.strokeStyle = 'rgba(160,140,110,0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 15;
    img.data[i] += noise;
    img.data[i + 1] += noise;
    img.data[i + 2] += noise;
  }
  ctx.putImageData(img, 0, 0);
}

function dustScratches(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * w;
    const y1 = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x + (Math.random() - 0.5) * 8, y1 + Math.random() * h * 0.3);
    ctx.stroke();
  }
}

function concrete(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const base = 140 + Math.random() * 40;
    img.data[i] = base;
    img.data[i + 1] = base - 2;
    img.data[i + 2] = base - 5;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(100,95,90,0.08)';
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * w,
      Math.random() * h,
      Math.random() * 20 + 5,
      Math.random() * 10 + 3,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function diagonalLines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  const gap = 6;
  for (let i = -h; i < w + h; i += gap) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - h, h);
    ctx.stroke();
  }
}

function crosshatch(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.8;
  const gap = 8;
  for (let i = -h; i < w + h; i += gap) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - h, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h, h);
    ctx.stroke();
  }
}

function softNoise(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 60;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function halftonePattern(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  const gap = 6;
  for (let y = 0; y < h; y += gap) {
    for (let x = 0; x < w; x += gap) {
      const r = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x + gap / 2, y + gap / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const GENERATORS: Record<string, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  'Film Grain': filmGrain,
  Paper: paperFiber,
  'Canvas Weave': canvasWeave,
  'Dust & Scratches': dustScratches,
  Concrete: concrete,
  'Diagonal Lines': diagonalLines,
  Crosshatch: crosshatch,
  'Soft Noise': softNoise,
  'Halftone Dots': halftonePattern,
};

export function getProceduralTexture(name: string, size = 256): string | null {
  const gen = GENERATORS[name];
  if (!gen) return null;
  return getOrCreate(name, size, size, (ctx) => gen(ctx, size, size));
}

export const PROCEDURAL_TEXTURE_NAMES = Object.keys(GENERATORS);
