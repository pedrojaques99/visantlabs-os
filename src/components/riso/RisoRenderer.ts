export interface InkLayer {
  color: [number, number, number];
  hex: string;
  visible: boolean;
  alpha: number;
  angle: number;
  offsetX: number;
  offsetY: number;
}

export interface RisoSettings {
  layers: InkLayer[];
  frequency: number;
  dotSize: number;
  contrast: number;
  lightness: number;
  paperColor: string;
  paperNoise: number;
  inkNoise: number;
  inkDropout: number;
  misregistration: number;
  edgeBleed: number;
  colorCount: number;
}

export const RISO_DEFAULTS: RisoSettings = {
  layers: [],
  frequency: 55,
  dotSize: 0.9,
  contrast: 1.2,
  lightness: 0.0,
  paperColor: '#f5f0e0',
  paperNoise: 0.25,
  inkNoise: 0.4,
  inkDropout: 0.03,
  misregistration: 2,
  edgeBleed: 1,
  colorCount: 4,
};

export const RISO_INK_PRESETS: Record<string, string[]> = {
  'Classic': ['#e3503e', '#00838a', '#f5c520', '#1a1a1a'],
  'Fluorescent': ['#ff6eb4', '#00c9a7', '#ffe135', '#333333'],
  'Earth': ['#c4622d', '#2d6a4f', '#dda15e', '#3d3d3d'],
  'Cool Duo': ['#005f73', '#ee6c4d', '#e0e0e0', '#2b2b2b'],
  'Warm Duo': ['#e63946', '#264653', '#f4a261', '#1d1d1d'],
};

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function extractDominantColors(imageData: ImageData, count: number): [number, number, number][] {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.floor((width * height) / 2000));
  const samples: [number, number, number][] = [];

  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = (r + g + b) / 3;
    if (brightness > 240 || brightness < 15) continue;
    samples.push([r, g, b]);
  }

  if (samples.length === 0) return [hexToRgb('#e3503e')];

  // k-means clustering
  let centroids: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    centroids.push(samples[Math.floor(i * samples.length / count)]);
  }

  for (let iter = 0; iter < 15; iter++) {
    const clusters: [number, number, number][][] = centroids.map(() => []);
    for (const s of samples) {
      let minDist = Infinity, minIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistance(s, centroids[c]);
        if (d < minDist) { minDist = d; minIdx = c; }
      }
      clusters[minIdx].push(s);
    }

    let converged = true;
    for (let c = 0; c < centroids.length; c++) {
      if (clusters[c].length === 0) continue;
      const avg: [number, number, number] = [0, 0, 0];
      for (const s of clusters[c]) { avg[0] += s[0]; avg[1] += s[1]; avg[2] += s[2]; }
      const newCentroid: [number, number, number] = [
        avg[0] / clusters[c].length,
        avg[1] / clusters[c].length,
        avg[2] / clusters[c].length,
      ];
      if (colorDistance(centroids[c], newCentroid) > 2) converged = false;
      centroids[c] = newCentroid;
    }
    if (converged) break;
  }

  // sort by luminance (darkest last)
  centroids.sort((a, b) => {
    const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    return lumB - lumA;
  });

  return centroids;
}

// Seeded PRNG for deterministic noise
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class RisoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sourceCanvas: HTMLCanvasElement;
  private sourceCtx: CanvasRenderingContext2D;
  public imageWidth = 0;
  public imageHeight = 0;
  public isImageLoaded = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    this.sourceCanvas = document.createElement('canvas');
    this.sourceCtx = this.sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  setupImage(img: HTMLImageElement): void {
    this.imageWidth = img.naturalWidth || img.width;
    this.imageHeight = img.naturalHeight || img.height;
    this.canvas.width = this.imageWidth;
    this.canvas.height = this.imageHeight;
    this.sourceCanvas.width = this.imageWidth;
    this.sourceCanvas.height = this.imageHeight;
    this.sourceCtx.drawImage(img, 0, 0);
    this.isImageLoaded = true;
  }

  render(settings: RisoSettings): void {
    if (!this.isImageLoaded) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    const sourceData = this.sourceCtx.getImageData(0, 0, width, height);
    const adjusted = this.adjustImage(sourceData, settings.contrast, settings.lightness);

    // Draw paper background
    this.drawPaper(ctx, width, height, settings);

    // Render each ink layer with halftone + overprint
    for (const layer of settings.layers) {
      if (!layer.visible) continue;
      this.renderInkLayer(ctx, adjusted, width, height, layer, settings);
    }
  }

  private adjustImage(data: ImageData, contrast: number, lightness: number): ImageData {
    const out = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = d[i + c] / 255;
        v = (v - 0.5) * contrast + 0.5 + lightness;
        d[i + c] = Math.round(Math.max(0, Math.min(1, v)) * 255);
      }
    }
    return out;
  }

  private drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, settings: RisoSettings): void {
    const [pr, pg, pb] = hexToRgb(settings.paperColor);
    const imgData = ctx.createImageData(w, h);
    const d = imgData.data;
    const rng = mulberry32(42);

    for (let i = 0; i < d.length; i += 4) {
      const grain = (rng() - 0.5) * settings.paperNoise * 40;
      d[i] = Math.max(0, Math.min(255, pr + grain));
      d[i + 1] = Math.max(0, Math.min(255, pg + grain));
      d[i + 2] = Math.max(0, Math.min(255, pb + grain));
      d[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  private renderInkLayer(
    ctx: CanvasRenderingContext2D,
    source: ImageData,
    w: number, h: number,
    layer: InkLayer,
    settings: RisoSettings,
  ): void {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = w;
    layerCanvas.height = h;
    const lCtx = layerCanvas.getContext('2d')!;
    const imgData = lCtx.createImageData(w, h);
    const d = imgData.data;
    const sd = source.data;
    const [ir, ig, ib] = layer.color;
    const rng = mulberry32(
      Math.round(ir * 1000 + ig * 100 + ib * 10)
    );

    const freq = settings.frequency;
    const dotMax = settings.dotSize;
    const angleRad = (layer.angle * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const sr = sd[idx], sg = sd[idx + 1], sb = sd[idx + 2];

        // How much of this ink layer is needed at this pixel
        const intensity = this.inkIntensity(sr, sg, sb, layer.color);

        // Halftone screening
        const rx = x * cosA - y * sinA;
        const ry = x * sinA + y * cosA;
        const gx = (rx % freq + freq) % freq;
        const gy = (ry % freq + freq) % freq;
        const cx = freq / 2;
        const cy = freq / 2;
        const dist = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2);
        const maxRadius = (freq / 2) * dotMax * Math.sqrt(intensity);

        let inkVal = dist < maxRadius ? 1 : 0;

        // Ink noise / uneven density
        if (inkVal > 0) {
          const noiseVal = rng();
          if (noiseVal < settings.inkNoise * 0.15) {
            inkVal *= 0.4 + rng() * 0.6;
          }
          // Ink dropout
          if (rng() < settings.inkDropout) {
            inkVal = 0;
          }
        }

        // Edge bleed
        if (inkVal === 0 && settings.edgeBleed > 0 && dist < maxRadius + settings.edgeBleed) {
          const bleedFactor = 1 - (dist - maxRadius) / settings.edgeBleed;
          inkVal = bleedFactor * 0.3 * rng();
        }

        const alpha = inkVal * layer.alpha * 255;
        d[idx] = ir;
        d[idx + 1] = ig;
        d[idx + 2] = ib;
        d[idx + 3] = Math.round(alpha);
      }
    }

    lCtx.putImageData(imgData, 0, 0);

    // Apply misregistration offset
    const offsetX = layer.offsetX * settings.misregistration;
    const offsetY = layer.offsetY * settings.misregistration;

    // Draw with multiply blend (overprint)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(layerCanvas, offsetX, offsetY);
    ctx.restore();
  }

  private inkIntensity(r: number, g: number, b: number, ink: [number, number, number]): number {
    const dist = colorDistance([r, g, b], ink);
    const maxDist = 441.67; // sqrt(255^2 * 3)
    const similarity = 1 - dist / maxDist;
    const darkness = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return Math.pow(similarity * 0.6 + darkness * 0.4, 1.2);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  destroy(): void {
    // nothing to clean up for 2d context
  }
}
