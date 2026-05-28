/**
 * ImageLab Server-Side Types
 *
 * Settings interfaces mirrored from client-side renderers.
 * These are pure type definitions — no runtime dependency on browser code.
 */

// ── Halftone ──

export interface HalftoneSettings {
  frequency: number;
  dotSize: number;
  roughness: number;
  fuzz: number;
  paperNoise: number;
  inkNoise: number;
  randomness: number;
  contrast: number;
  lightness: number;
  blur: number;
  threshold: number;
  blendMode: number;
  cyanAngle: number;
  magentaAngle: number;
  yellowAngle: number;
  blackAngle: number;
  cyanInk: string;
  cyanAlpha: number;
  magentaInk: string;
  magentaAlpha: number;
  yellowInk: string;
  yellowAlpha: number;
  blackInk: string;
  blackAlpha: number;
  paperColor: string;
  paperAlpha: number;
  showCyan: boolean;
  showMagenta: boolean;
  showYellow: boolean;
  showBlack: boolean;
  effectOpacity?: number;
}

export const HALFTONE_DEFAULTS: HalftoneSettings = {
  frequency: 85,
  dotSize: 1.0,
  roughness: 2.0,
  fuzz: 0.1,
  paperNoise: 0.0,
  inkNoise: 0.6,
  randomness: 0.2,
  contrast: 1.0,
  lightness: 0.0,
  blur: 1.0,
  threshold: 0.05,
  blendMode: 0,
  cyanAngle: 15,
  magentaAngle: 75,
  yellowAngle: 0,
  blackAngle: 45,
  cyanInk: '#00FFFF',
  cyanAlpha: 0.95,
  magentaInk: '#FF00FF',
  magentaAlpha: 0.95,
  yellowInk: '#FFFF00',
  yellowAlpha: 0.95,
  blackInk: '#000000',
  blackAlpha: 0.95,
  paperColor: '#f8f4e8',
  paperAlpha: 1.0,
  showCyan: true,
  showMagenta: true,
  showYellow: true,
  showBlack: true,
};

// ── Riso ──

export type DitherMode = 'stochastic' | 'atkinson' | 'floydsteinberg' | 'bayer' | 'halftone';
export type HalftoneShape = 'circle' | 'line' | 'cross' | 'ellipse';

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
  soloLayer?: number;
  ditherMode: DitherMode;
  halftoneShape: HalftoneShape;
  effectOpacity?: number;
}

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

// ── Texture ──

export type TextureBlendMode = 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'color-burn' | 'color-dodge';

export interface TextureSettings {
  textureName: string;
  textureUrl?: string;
  blendMode: TextureBlendMode;
  opacity: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  tileMode: boolean;
  tileGapX: number;
  tileGapY: number;
  maskMode: boolean;
  maskInvert: boolean;
  textureColor: string;
  useOriginalColor: boolean;
}

export const TEXTURE_DEFAULTS: TextureSettings = {
  textureName: 'visant-grid',
  blendMode: 'multiply',
  opacity: 0.5,
  scale: 1.0,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  tileMode: true,
  tileGapX: 0,
  tileGapY: 0,
  maskMode: false,
  maskInvert: false,
  textureColor: '#000000',
  useOriginalColor: true,
};

// ── Post-FX Shaders ──

export type ShaderType = 'halftone' | 'vhs' | 'ascii' | 'matrixDither' | 'upscale' | 'dither' | 'duotone' | 'filmGrain' | 'pixelate' | 'posterize' | 'chromaticAberration' | 'crtScanlines' | 'edgeDetect' | 'glitch';

export interface ShaderSettings {
  shaderType?: ShaderType;
  halftoneVariant?: 'ellipse' | 'square' | 'lines';
  // All shader-specific params use defaults from shaderRenderer — kept flat
  [key: string]: any;
}

// ── Shared ──

export type ImageLabMode = 'halftone' | 'texture' | 'riso';

export type ExportFormat = 'png' | 'jpeg' | 'svg';

export interface ImageLabRequest {
  imageUrl: string;
  mode: ImageLabMode;
  preset?: string;
  settings?: Record<string, any>;
  format?: ExportFormat;
  quality?: number;
}

export interface ShaderRequest {
  imageUrl: string;
  shaderType: ShaderType;
  settings?: Record<string, any>;
  format?: ExportFormat;
}

export interface ChainRequest {
  imageUrl: string;
  effect?: { mode: ImageLabMode; preset?: string; settings?: Record<string, any> };
  shader?: { shaderType: ShaderType; settings?: Record<string, any> };
  effectOpacity?: number;
  format?: ExportFormat;
}

export interface ImageLabResult {
  imageUrl: string;
  format: string;
  width: number;
  height: number;
  mode?: string;
  preset?: string;
}
