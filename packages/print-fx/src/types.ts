// Shared settings types for @visant/print-fx.
// These mirror the field shapes used by the Visant ImageLab client + server and
// are intentionally framework-agnostic (no DOM, zustand, or node deps).

// ── Halftone ──

export interface HalftoneSettings {
  frequency: number;
  dotSize: number;
  dotSpacing?: number;
  roughness: number;
  fuzz: number;
  paperNoise: number;
  inkNoise: number;
  randomness: number;
  contrast: number;
  lightness: number;
  blur: number;
  threshold: number;
  /** 0=multiply, 1=screen, 2=normal */
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
  dotSpacing: 0.0,
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

// ── Texture (preset data only — the texture compositor itself is Canvas2D and
// lives in the host app; the package ships the preset catalog so presets stay a
// single source of truth across client + server). ──

export type TextureBlendMode =
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'color-burn'
  | 'color-dodge';

// ── Post-FX Shaders ──

export type ShaderType =
  | 'halftone'
  | 'vhs'
  | 'ascii'
  | 'matrixDither'
  | 'upscale'
  | 'dither'
  | 'duotone'
  | 'filmGrain'
  | 'pixelate'
  | 'posterize'
  | 'chromaticAberration'
  | 'crtScanlines'
  | 'edgeDetect'
  | 'glitch';

/** Canvas factory injected by the host (node-canvas, DOM canvas, @napi-rs/canvas). */
export type CreateCanvas = (w: number, h: number) => any;
