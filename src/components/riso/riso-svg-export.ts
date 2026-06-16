import type { RisoSettings, InkLayer, DitherMode, HalftoneShape } from './RisoRenderer';

interface DotData {
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
}

function hash(x: number, y: number): number {
  let px = 50 * ((x * 0.3183099 + 0.71) % 1);
  let py = 50 * ((y * 0.3183099 + 0.113) % 1);
  if (px < 0) px += 50;
  if (py < 0) py += 50;
  return (px * py * (px + py)) % 1;
}

function samplePixel(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  u: number,
  v: number,
  contrast: number,
  lightness: number
): [number, number, number] {
  const x = Math.min(Math.max(Math.round(u * (w - 1)), 0), w - 1);
  const y = Math.min(Math.max(Math.round(v * (h - 1)), 0), h - 1);
  const i = (y * w + x) * 4;
  let r = pixels[i] / 255;
  let g = pixels[i + 1] / 255;
  let b = pixels[i + 2] / 255;
  r = Math.min(Math.max((r - 0.5) * contrast + 0.5 + lightness, 0), 1);
  g = Math.min(Math.max((g - 0.5) * contrast + 0.5 + lightness, 0), 1);
  b = Math.min(Math.max((b - 0.5) * contrast + 0.5 + lightness, 0), 1);
  return [r, g, b];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function getLayerIntensity(
  pixel: [number, number, number],
  inkColor: [number, number, number],
  paperRgb: [number, number, number],
  _allDists: number[],
  _myDist: number
): number {
  // Subtractive model: pixel = paper * (1 - opacity * (1 - ink))
  // Solve for opacity per channel, weight by absorption strength
  let totalW = 0;
  let totalOp = 0;
  for (let c = 0; c < 3; c++) {
    const paper = Math.max(paperRgb[c], 0.001);
    const ratio = pixel[c] / paper;
    const absorption = Math.max(1 - inkColor[c], 0.001);
    const op = Math.min(Math.max((1 - ratio) / absorption, 0), 1);
    const w = absorption * absorption;
    totalOp += op * w;
    totalW += w;
  }
  if (totalW < 0.001) return 0;
  return Math.min(Math.max(totalOp / totalW, 0), 1);
}

// Bayer 4x4 matrix
const BAYER_4X4 = [
  0 / 16,
  8 / 16,
  2 / 16,
  10 / 16,
  12 / 16,
  4 / 16,
  14 / 16,
  6 / 16,
  3 / 16,
  11 / 16,
  1 / 16,
  9 / 16,
  15 / 16,
  7 / 16,
  13 / 16,
  5 / 16,
];

function shouldDither(
  intensity: number,
  col: number,
  row: number,
  layerSeed: number,
  mode: DitherMode,
  _shape: HalftoneShape
): { draw: boolean; radiusScale: number } {
  if (intensity < 0.005) return { draw: false, radiusScale: 0 };
  if (intensity > 0.995) return { draw: true, radiusScale: 1 };

  switch (mode) {
    case 'stochastic': {
      const n = hash(col + layerSeed, row);
      const medN = hash(Math.floor(col * 0.2) + layerSeed + 43, Math.floor(row * 0.2));
      const local = intensity * (0.85 + 0.3 * medN);
      return { draw: n < local, radiusScale: 1 };
    }
    case 'atkinson': {
      const n = hash(col + layerSeed, row);
      const att = intensity * 0.75;
      return { draw: n < att, radiusScale: 1 };
    }
    case 'floydsteinberg': {
      const n = hash(col + layerSeed, row);
      const spread = (n - 0.5) * 0.45;
      return { draw: intensity + spread > 0.5, radiusScale: 1 };
    }
    case 'bayer': {
      const bx = ((col % 4) + 4) % 4;
      const by = ((row % 4) + 4) % 4;
      const threshold = BAYER_4X4[bx + by * 4];
      return { draw: intensity > threshold, radiusScale: 1 };
    }
    case 'halftone': {
      return { draw: true, radiusScale: Math.sqrt(intensity) };
    }
    default:
      return { draw: hash(col + layerSeed, row) < intensity, radiusScale: 1 };
  }
}

function hexToNorm(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export function generateRisoSvg(
  imageData: ImageData,
  settings: RisoSettings,
  options?: { layerIndex?: number }
): string {
  const { width: w, height: h, data: pixels } = imageData;
  const freq = settings.frequency;
  const cellSize = Math.max(w, h) / freq;
  const paperRgb = hexToNorm(settings.paperColor);

  const layersToRender =
    options?.layerIndex !== undefined
      ? [settings.layers[options.layerIndex]].filter(Boolean)
      : settings.layers.filter((l) => l.visible);

  const allInkColors = settings.layers.map(
    (l) => [l.color[0] / 255, l.color[1] / 255, l.color[2] / 255] as [number, number, number]
  );

  const dots: DotData[] = [];

  for (let li = 0; li < layersToRender.length; li++) {
    const layer = layersToRender[li];
    if (!layer.visible && options?.layerIndex === undefined) continue;

    const inkColor: [number, number, number] = [
      layer.color[0] / 255,
      layer.color[1] / 255,
      layer.color[2] / 255,
    ];
    const rad = (layer.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const ditherMode = layer.ditherMode || settings.ditherMode;
    const hShape = layer.halftoneShape || settings.halftoneShape;

    const misregPx = settings.misregistration;
    const offX = layer.offsetX * misregPx;
    const offY = layer.offsetY * misregPx;

    const diag = Math.sqrt(w * w + h * h);
    const gridSize = Math.ceil(diag / cellSize) + 2;
    const centerX = w / 2;
    const centerY = h / 2;

    for (let row = -gridSize; row <= gridSize; row++) {
      for (let col = -gridSize; col <= gridSize; col++) {
        const gx = col * cellSize;
        const gy = row * cellSize;

        const px = cos * gx - sin * gy + centerX + offX;
        const py = sin * gx + cos * gy + centerY + offY;

        if (px < -cellSize || px > w + cellSize || py < -cellSize || py > h + cellSize) continue;

        const u = px / w;
        const v = py / h;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;

        const pixel = samplePixel(pixels, w, h, u, v, settings.contrast, settings.lightness);

        const allDists = allInkColors.map((c) => colorDistance(pixel, c));
        const myIdx = settings.layers.indexOf(layer);
        const myDist = myIdx >= 0 ? allDists[myIdx] : colorDistance(pixel, inkColor);

        const intensity = getLayerIntensity(pixel, inkColor, paperRgb, allDists, myDist);
        if (intensity < 0.01) continue;

        // Ink dropout
        if (hash(col + li * 200, row + 200) < settings.inkDropout) continue;

        const { draw, radiusScale } = shouldDither(
          intensity,
          col,
          row,
          li * 100,
          ditherMode,
          hShape
        );
        if (!draw) continue;

        const baseRadius = Math.max(0, settings.dotSize * cellSize * 0.45 - (settings.dotSpacing ?? 0) * cellSize * 0.5);
        const radius = radiusScale * baseRadius;

        if (radius < 0.3) continue;

        // Ink absorption variation
        const absorbNoise = hash(col + li * 31, row + 31);
        const absorbMod = 1 - settings.inkNoise * 0.2 * (absorbNoise - 0.5);

        dots.push({
          cx: Math.round(px * 100) / 100,
          cy: Math.round(py * 100) / 100,
          r: Math.round(radius * absorbMod * 100) / 100,
          color: layer.hex,
          opacity: Math.round(layer.alpha * 100) / 100,
        });
      }
    }
  }

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
  ];

  // Paper background
  parts.push(`<rect width="${w}" height="${h}" fill="${settings.paperColor}"/>`);

  // Paper grain noise (subtle rect noise)
  parts.push(
    '<g opacity="0.04"><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/></filter>'
  );
  parts.push(`<rect width="${w}" height="${h}" filter="url(#grain)"/></g>`);

  // Ink layers with multiply blend
  parts.push('<g style="mix-blend-mode:multiply">');

  for (const d of dots) {
    const op = d.opacity < 1 ? ` opacity="${d.opacity}"` : '';
    parts.push(`<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${d.color}"${op}/>`);
  }

  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}

export function generateRisoSvgFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  settings: RisoSettings,
  options?: { layerIndex?: number }
): string {
  const tmpCanvas = document.createElement('canvas');
  const { width: w, height: h } = sourceCanvas;
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const ctx = tmpCanvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  return generateRisoSvg(imageData, settings, options);
}
