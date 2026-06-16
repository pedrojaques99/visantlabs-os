import { hexToRgb } from '@/utils/colorUtils';
import { RISO_FULL_PRESETS_DATA } from '../../../shared/imagelab/presets';

export interface InkLayer {
  color: [number, number, number];
  hex: string;
  visible: boolean;
  alpha: number;
  angle: number;
  offsetX: number;
  offsetY: number;
  ditherMode?: DitherMode;
  halftoneShape?: HalftoneShape;
}

export type DitherMode = 'stochastic' | 'atkinson' | 'floydsteinberg' | 'bayer' | 'halftone';
export type HalftoneShape = 'circle' | 'line' | 'cross' | 'ellipse';

export interface RisoSettings {
  layers: InkLayer[];
  frequency: number;
  dotSize: number;
  dotSpacing?: number;
  contrast: number;
  lightness: number;
  paperColor: string;
  paperNoise: number;
  inkNoise: number;
  inkDropout: number;
  misregistration: number;
  edgeBleed: number;
  colorCount: number;
  soloLayer?: number;
  ditherMode: DitherMode;
  halftoneShape: HalftoneShape;
  effectOpacity?: number;
}

export interface RisoInkColor {
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export const RISO_INK_CATALOG: RisoInkColor[] = [
  { name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
  { name: 'Burgundy', hex: '#914e72', rgb: [145, 78, 114] },
  { name: 'Blue', hex: '#0078bf', rgb: [0, 120, 191] },
  { name: 'Green', hex: '#00a95c', rgb: [0, 169, 92] },
  { name: 'Medium Blue', hex: '#3255a4', rgb: [50, 85, 164] },
  { name: 'Bright Red', hex: '#f15060', rgb: [241, 80, 96] },
  { name: 'Riso Federal Blue', hex: '#3d5588', rgb: [61, 85, 136] },
  { name: 'Purple', hex: '#765ba7', rgb: [118, 91, 167] },
  { name: 'Teal', hex: '#00838a', rgb: [0, 131, 138] },
  { name: 'Flat Gold', hex: '#bb8b41', rgb: [187, 139, 65] },
  { name: 'Hunter Green', hex: '#407060', rgb: [64, 112, 96] },
  { name: 'Red', hex: '#ff665e', rgb: [255, 102, 94] },
  { name: 'Brown', hex: '#925f52', rgb: [146, 95, 82] },
  { name: 'Yellow', hex: '#ffe800', rgb: [255, 232, 0] },
  { name: 'Marine Red', hex: '#d2515e', rgb: [210, 81, 94] },
  { name: 'Orange', hex: '#ff6c2f', rgb: [255, 108, 47] },
  { name: 'Fluorescent Pink', hex: '#ff48b0', rgb: [255, 72, 176] },
  { name: 'Light Gray', hex: '#88898a', rgb: [136, 137, 138] },
  { name: 'Metallic Gold', hex: '#ac936e', rgb: [172, 147, 110] },
  { name: 'Crimson', hex: '#e45d50', rgb: [228, 93, 80] },
  { name: 'Fluorescent Orange', hex: '#ff7477', rgb: [255, 116, 119] },
  { name: 'Cornflower', hex: '#62a8e5', rgb: [98, 168, 229] },
  { name: 'Sky Blue', hex: '#4982cf', rgb: [73, 130, 207] },
  { name: 'Sea Blue', hex: '#0074a2', rgb: [0, 116, 162] },
  { name: 'Lake', hex: '#235ba8', rgb: [35, 91, 168] },
  { name: 'Indigo', hex: '#484d7a', rgb: [72, 77, 122] },
  { name: 'Midnight', hex: '#435060', rgb: [67, 80, 96] },
  { name: 'Mist', hex: '#d5e4c0', rgb: [213, 228, 192] },
  { name: 'Granite', hex: '#a5aaa8', rgb: [165, 170, 168] },
  { name: 'Charcoal', hex: '#70747c', rgb: [112, 116, 124] },
  { name: 'Smoky Teal', hex: '#5f8289', rgb: [95, 130, 137] },
  { name: 'Steel', hex: '#375e77', rgb: [55, 94, 119] },
  { name: 'Slate', hex: '#5e695e', rgb: [94, 105, 94] },
  { name: 'Turquoise', hex: '#00aa93', rgb: [0, 170, 147] },
  { name: 'Light Teal', hex: '#009da5', rgb: [0, 157, 165] },
  { name: 'Aqua', hex: '#5ec8e5', rgb: [94, 200, 229] },
  { name: 'Mint', hex: '#82d8d5', rgb: [130, 216, 213] },
  { name: 'Fluorescent Green', hex: '#44d62c', rgb: [68, 214, 44] },
  { name: 'Kelly Green', hex: '#67b346', rgb: [103, 179, 70] },
  { name: 'Grass', hex: '#397e58', rgb: [57, 126, 88] },
  { name: 'Forest', hex: '#516e5a', rgb: [81, 110, 90] },
  { name: 'Spruce', hex: '#4a635d', rgb: [74, 99, 93] },
  { name: 'Moss', hex: '#68724d', rgb: [104, 114, 77] },
  { name: 'Sea Foam', hex: '#62c2b1', rgb: [98, 194, 177] },
  { name: 'Bright Olive Green', hex: '#b49f29', rgb: [180, 159, 41] },
  { name: 'Light Lime', hex: '#e3ed55', rgb: [227, 237, 85] },
  { name: 'Ivy', hex: '#169b62', rgb: [22, 155, 98] },
  { name: 'Pine', hex: '#237e74', rgb: [35, 126, 116] },
  { name: 'Lagoon', hex: '#2f6165', rgb: [47, 97, 101] },
  { name: 'Violet', hex: '#9d7ad2', rgb: [157, 122, 210] },
  { name: 'Orchid', hex: '#aa60bf', rgb: [170, 96, 191] },
  { name: 'Plum', hex: '#845991', rgb: [132, 89, 145] },
  { name: 'Raisin', hex: '#775d7a', rgb: [119, 93, 122] },
  { name: 'Grape', hex: '#6c5d80', rgb: [108, 93, 128] },
  { name: 'Scarlet', hex: '#ff4f58', rgb: [255, 79, 88] },
  { name: 'Tomato', hex: '#d2515e', rgb: [210, 81, 94] },
  { name: 'Cranberry', hex: '#d1517a', rgb: [209, 81, 122] },
  { name: 'Maroon', hex: '#9e4c6e', rgb: [158, 76, 110] },
  { name: 'Raspberry Red', hex: '#d1517a', rgb: [209, 81, 122] },
  { name: 'Brick', hex: '#a75154', rgb: [167, 81, 84] },
  { name: 'Light Mauve', hex: '#e0b5c7', rgb: [224, 181, 199] },
  { name: 'Dark Mauve', hex: '#bd8ca6', rgb: [189, 140, 166] },
  { name: 'Wine', hex: '#914e72', rgb: [145, 78, 114] },
  { name: 'Gray', hex: '#928d88', rgb: [146, 141, 136] },
  { name: 'Coral', hex: '#ff8f6b', rgb: [255, 143, 107] },
  { name: 'White', hex: '#ffffff', rgb: [255, 255, 255] },
  { name: 'Sunflower', hex: '#ffb511', rgb: [255, 181, 17] },
  { name: 'Melon', hex: '#ffae3b', rgb: [255, 174, 59] },
  { name: 'Apricot', hex: '#f6a04d', rgb: [246, 160, 77] },
  { name: 'Paprika', hex: '#ee5d32', rgb: [238, 93, 50] },
  { name: 'Pumpkin', hex: '#ff6f2c', rgb: [255, 111, 44] },
  { name: 'Bright Gold', hex: '#e5b151', rgb: [229, 177, 81] },
  { name: 'Copper', hex: '#bd6439', rgb: [189, 100, 57] },
  { name: 'Mahogany', hex: '#8e595a', rgb: [142, 89, 90] },
  { name: 'Bubble Gum', hex: '#f984ca', rgb: [249, 132, 202] },
  { name: 'Fluorescent Yellow', hex: '#ffe916', rgb: [255, 233, 22] },
];

export const RISO_DEFAULTS: RisoSettings = {
  layers: [],
  frequency: 40,
  dotSize: 0.85,
  dotSpacing: 0.0,
  contrast: 1.2,
  lightness: 0.0,
  paperColor: '#f5f0e0',
  paperNoise: 0.25,
  inkNoise: 0.4,
  inkDropout: 0.03,
  misregistration: 2,
  edgeBleed: 1,
  colorCount: 4,
  soloLayer: -1,
  ditherMode: 'stochastic',
  halftoneShape: 'circle',
};

export const RISO_INK_PRESETS: Record<string, string[]> = {
  Classic: ['#e3503e', '#00838a', '#f5c520', '#1a1a1a'],
  Fluorescent: ['#ff6eb4', '#00c9a7', '#ffe135', '#333333'],
  Earth: ['#c4622d', '#2d6a4f', '#dda15e', '#3d3d3d'],
  'Cool Duo': ['#005f73', '#ee6c4d', '#e0e0e0', '#2b2b2b'],
  'Warm Duo': ['#e63946', '#264653', '#f4a261', '#1d1d1d'],
};

export interface RisoFullPreset {
  frequency: number;
  dotSize: number;
  paperColor: string;
  paperNoise: number;
  inkNoise: number;
  inkDropout: number;
  misregistration: number;
  edgeBleed: number;
  colors: string[];
  ditherMode?: DitherMode;
  halftoneShape?: HalftoneShape;
}

// Single source of truth: shared/imagelab/presets.ts (also consumed server-side).
export const RISO_FULL_PRESETS: Record<string, RisoFullPreset> =
  RISO_FULL_PRESETS_DATA as unknown as Record<string, RisoFullPreset>;

// GLSL shaders — single source of truth in shared/riso/shaders.ts
import {
  RISO_VERTEX_SHADER as VERTEX_SHADER,
  RISO_FRAGMENT_SHADER as FRAGMENT_SHADER,
} from '../../../shared/riso/shaders';

// --- Perceptual color distance (CPU-side LAB) ---

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let lr = r / 255,
    lg = g / 255,
    lb = b / 255;
  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;

  let x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  let y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  let z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;

  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labDistance(a: [number, number, number], b: [number, number, number]): number {
  const la = rgbToLab(a[0], a[1], a[2]);
  const lb = rgbToLab(b[0], b[1], b[2]);
  return Math.sqrt((la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2);
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return labDistance(a, b);
}

// --- Color extraction (CPU, runs once on image load) ---

export function extractDominantColors(
  imageData: ImageData,
  count: number
): [number, number, number][] {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.floor((width * height) / 2000));
  const samples: [number, number, number][] = [];

  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const brightness = (r + g + b) / 3;
    if (brightness > 240 || brightness < 15) continue;
    samples.push([r, g, b]);
  }

  if (samples.length === 0) return [hexToRgb('#e3503e')];

  // K-means++ initialization for better centroid spread
  const centroids: [number, number, number][] = [
    samples[Math.floor(Math.random() * samples.length)],
  ];
  for (let k = 1; k < count; k++) {
    const dists = samples.map((s) => {
      let minD = Infinity;
      for (const c of centroids) minD = Math.min(minD, colorDistance(s, c));
      return minD * minD;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) {
        centroids.push(samples[i]);
        break;
      }
    }
    if (centroids.length <= k) centroids.push(samples[Math.floor(Math.random() * samples.length)]);
  }

  for (let iter = 0; iter < 20; iter++) {
    const clusters: [number, number, number][][] = centroids.map(() => []);
    for (const s of samples) {
      let minDist = Infinity,
        minIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistance(s, centroids[c]);
        if (d < minDist) {
          minDist = d;
          minIdx = c;
        }
      }
      clusters[minIdx].push(s);
    }

    let converged = true;
    for (let c = 0; c < centroids.length; c++) {
      if (clusters[c].length === 0) continue;
      const avg: [number, number, number] = [0, 0, 0];
      for (const s of clusters[c]) {
        avg[0] += s[0];
        avg[1] += s[1];
        avg[2] += s[2];
      }
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

  centroids.sort((a, b) => {
    const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    return lumB - lumA;
  });

  return centroids;
}

// --- Map to Palette: snap extracted colors to nearest Riso ink ---

export function mapToRisoInks(
  imageData: ImageData,
  targetInks: RisoInkColor[],
  count: number
): [number, number, number][] {
  const colors = extractDominantColors(imageData, count);
  return colors.map((c) => {
    let bestInk = targetInks[0];
    let bestDist = Infinity;
    for (const ink of targetInks) {
      const d = colorDistance(c, ink.rgb);
      if (d < bestDist) {
        bestDist = d;
        bestInk = ink;
      }
    }
    return bestInk.rgb;
  });
}

// --- WebGL Renderer ---

function hexToGl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
}

export class RisoRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private canvas: HTMLCanvasElement;

  public imageWidth = 0;
  public imageHeight = 0;
  public isImageLoaded = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): boolean {
    this.gl = this.canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: true,
    });

    if (!this.gl) return false;
    this.gl.getExtension('OES_standard_derivatives');

    const vs = this.createShader(this.gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return false;

    this.program = this.gl.createProgram()!;
    this.gl.attachShader(this.program, vs);
    this.gl.attachShader(this.program, fs);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(this.program));
      return false;
    }

    const uniformNames = [
      'u_texture',
      'u_resolution',
      'u_frequency',
      'u_dotSize',
      'u_dotSpacing',
      'u_contrast',
      'u_lightness',
      'u_paperNoise',
      'u_inkNoise',
      'u_inkDropout',
      'u_misregistration',
      'u_edgeBleed',
      'u_paperColor',
      'u_layerCount',
      'u_soloLayer',
      'u_ditherMode',
      'u_halftoneShape',
      'u_effectOpacity',
      'u_layerDither0',
      'u_layerDither1',
      'u_layerDither2',
      'u_layerDither3',
      'u_layerHShape0',
      'u_layerHShape1',
      'u_layerHShape2',
      'u_layerHShape3',
      'u_inkColor0',
      'u_inkColor1',
      'u_inkColor2',
      'u_inkColor3',
      'u_inkAlpha0',
      'u_inkAlpha1',
      'u_inkAlpha2',
      'u_inkAlpha3',
      'u_inkAngle0',
      'u_inkAngle1',
      'u_inkAngle2',
      'u_inkAngle3',
      'u_inkOffset0',
      'u_inkOffset1',
      'u_inkOffset2',
      'u_inkOffset3',
      'u_inkVisible0',
      'u_inkVisible1',
      'u_inkVisible2',
      'u_inkVisible3',
    ];
    for (const name of uniformNames) {
      this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
    }

    const vertices = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const posLoc = this.gl.getAttribLocation(this.program, 'a_position');
    const texLoc = this.gl.getAttribLocation(this.program, 'a_texCoord');
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.enableVertexAttribArray(texLoc);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.vertexAttribPointer(texLoc, 2, this.gl.FLOAT, false, 16, 8);

    return true;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  setupTexture(source: TexImageSource): void {
    if (!this.gl) return;
    if (this.texture) this.gl.deleteTexture(this.texture);

    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      source
    );

    if (source instanceof HTMLVideoElement) {
      this.imageWidth = source.videoWidth;
      this.imageHeight = source.videoHeight;
    } else if (source instanceof HTMLImageElement) {
      this.imageWidth = source.naturalWidth || source.width;
      this.imageHeight = source.naturalHeight || source.height;
    } else {
      this.imageWidth = (source as HTMLCanvasElement).width;
      this.imageHeight = (source as HTMLCanvasElement).height;
    }
    this.canvas.width = this.imageWidth;
    this.canvas.height = this.imageHeight;
    this.gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    this.isImageLoaded = true;
  }

  updateTexture(source: TexImageSource): void {
    if (!this.gl || !this.texture) return;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      source
    );
  }

  render(settings: RisoSettings): void {
    if (!this.gl || !this.program || !this.texture || !this.isImageLoaded) return;

    const gl = this.gl;
    const u = this.uniforms;

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.uniform1i(u.u_texture, 0);
    gl.uniform2f(u.u_resolution, this.imageWidth, this.imageHeight);
    gl.uniform1f(u.u_frequency, settings.frequency);
    gl.uniform1f(u.u_dotSize, settings.dotSize);
    gl.uniform1f(u.u_dotSpacing, settings.dotSpacing ?? 0);
    gl.uniform1f(u.u_contrast, settings.contrast);
    gl.uniform1f(u.u_lightness, settings.lightness);
    gl.uniform1f(u.u_paperNoise, settings.paperNoise);
    gl.uniform1f(u.u_inkNoise, settings.inkNoise);
    gl.uniform1f(u.u_inkDropout, settings.inkDropout);
    gl.uniform1f(u.u_misregistration, settings.misregistration);
    gl.uniform1f(u.u_edgeBleed, settings.edgeBleed);

    const paperGl = hexToGl(settings.paperColor);
    gl.uniform4f(u.u_paperColor, paperGl[0], paperGl[1], paperGl[2], 1.0);

    const layers = settings.layers;
    gl.uniform1i(u.u_layerCount, layers.length);
    gl.uniform1i(u.u_soloLayer, settings.soloLayer ?? -1);

    const ditherModeMapGlobal: Record<string, number> = {
      stochastic: 0,
      atkinson: 1,
      floydsteinberg: 2,
      bayer: 3,
      halftone: 4,
    };
    const shapeMapGlobal: Record<string, number> = { circle: 0, line: 1, cross: 2, ellipse: 3 };
    gl.uniform1i(u.u_ditherMode, ditherModeMapGlobal[settings.ditherMode] ?? 0);
    gl.uniform1i(u.u_halftoneShape, shapeMapGlobal[settings.halftoneShape] ?? 0);
    gl.uniform1f(u.u_effectOpacity, settings.effectOpacity ?? 1.0);

    const colorUniforms = [u.u_inkColor0, u.u_inkColor1, u.u_inkColor2, u.u_inkColor3];
    const alphaUniforms = [u.u_inkAlpha0, u.u_inkAlpha1, u.u_inkAlpha2, u.u_inkAlpha3];
    const angleUniforms = [u.u_inkAngle0, u.u_inkAngle1, u.u_inkAngle2, u.u_inkAngle3];
    const offsetUniforms = [u.u_inkOffset0, u.u_inkOffset1, u.u_inkOffset2, u.u_inkOffset3];
    const visibleUniforms = [u.u_inkVisible0, u.u_inkVisible1, u.u_inkVisible2, u.u_inkVisible3];

    const ditherModeMap: Record<string, number> = {
      stochastic: 0,
      atkinson: 1,
      floydsteinberg: 2,
      bayer: 3,
      halftone: 4,
    };
    const shapeMap: Record<string, number> = { circle: 0, line: 1, cross: 2, ellipse: 3 };
    const layerDitherUniforms = [
      u.u_layerDither0,
      u.u_layerDither1,
      u.u_layerDither2,
      u.u_layerDither3,
    ];
    const layerHShapeUniforms = [
      u.u_layerHShape0,
      u.u_layerHShape1,
      u.u_layerHShape2,
      u.u_layerHShape3,
    ];

    for (let i = 0; i < 4; i++) {
      if (i < layers.length) {
        const layer = layers[i];
        const c = [layer.color[0] / 255, layer.color[1] / 255, layer.color[2] / 255];
        gl.uniform3f(colorUniforms[i], c[0], c[1], c[2]);
        gl.uniform1f(alphaUniforms[i], layer.alpha);
        gl.uniform1f(angleUniforms[i], layer.angle);
        gl.uniform2f(offsetUniforms[i], layer.offsetX, layer.offsetY);
        gl.uniform1i(visibleUniforms[i], layer.visible ? 1 : 0);
        gl.uniform1i(
          layerDitherUniforms[i],
          layer.ditherMode ? (ditherModeMap[layer.ditherMode] ?? -1) : -1
        );
        gl.uniform1i(
          layerHShapeUniforms[i],
          layer.halftoneShape ? (shapeMap[layer.halftoneShape] ?? -1) : -1
        );
      } else {
        gl.uniform3f(colorUniforms[i], 0, 0, 0);
        gl.uniform1f(alphaUniforms[i], 0);
        gl.uniform1f(angleUniforms[i], 0);
        gl.uniform2f(offsetUniforms[i], 0, 0);
        gl.uniform1i(visibleUniforms[i], 0);
        gl.uniform1i(layerDitherUniforms[i], -1);
        gl.uniform1i(layerHShapeUniforms[i], -1);
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  renderAtScale(settings: RisoSettings, scale: number): HTMLCanvasElement {
    if (!this.gl || !this.program || !this.texture || !this.isImageLoaded || scale <= 1) {
      this.render(settings);
      return this.canvas;
    }

    const w = Math.round(this.imageWidth * scale);
    const h = Math.round(this.imageHeight * scale);
    const origW = this.imageWidth;
    const origH = this.imageHeight;

    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.imageWidth = w;
    this.imageHeight = h;
    this.render(settings);

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(this.canvas, 0, 0);

    this.canvas.width = origW;
    this.canvas.height = origH;
    this.gl.viewport(0, 0, origW, origH);
    this.imageWidth = origW;
    this.imageHeight = origH;
    this.render(settings);

    return out;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  destroy(): void {
    if (this.gl && this.texture) {
      this.gl.deleteTexture(this.texture);
    }
  }
}
