/**
 * ImageLab / print-fx preset catalog — single source of truth.
 *
 * Pure data, no runtime dependency on browser (zustand/WebGL) or server code, so
 * client and server consume the same module. The structural types below avoid
 * importing each consumer's settings interfaces; each side casts to its own type
 * on re-export (the field shapes match by construction).
 */

// ── Structural types (local, dependency-free) ──

type HalftonePresetData = Record<string, number | string | boolean>;

interface TexturePresetData {
  opacity: number;
  scale: number;
  blendMode: string;
  tileMode?: boolean;
  tileGapX?: number;
  tileGapY?: number;
  maskMode?: boolean;
  maskInvert?: boolean;
}

interface RisoPresetData {
  frequency: number;
  dotSize: number;
  paperColor: string;
  paperNoise: number;
  inkNoise: number;
  inkDropout: number;
  misregistration: number;
  edgeBleed: number;
  colors: string[];
  ditherMode?: string;
  halftoneShape?: string;
}

// ── Halftone Presets ──
// 'Classic Print' is intentionally `{}`: every consumer applies presets as
// `{ ...HALFTONE_DEFAULTS, ...preset }`, so an empty override == pure defaults.

export const HALFTONE_PRESETS_DATA: Record<string, HalftonePresetData> = {
  'Classic Print': {},
  Newsprint: {
    frequency: 45,
    dotSize: 1.0,
    roughness: 3.0,
    fuzz: 0.15,
    paperNoise: 0.3,
    inkNoise: 0.8,
    contrast: 1.2,
    paperColor: '#ede6d6',
  },
  'Pop Art': {
    frequency: 30,
    dotSize: 1.0,
    roughness: 0,
    fuzz: 0,
    paperNoise: 0,
    inkNoise: 0,
    contrast: 1.5,
    blendMode: 0,
    paperColor: '#ffffff',
  },
  Risograph: {
    frequency: 60,
    dotSize: 0.9,
    roughness: 1.5,
    fuzz: 0.2,
    paperNoise: 0.15,
    inkNoise: 0.5,
    randomness: 0.3,
    paperColor: '#f5f0e0',
  },
  'Duotone BW': {
    frequency: 70,
    dotSize: 1.0,
    showCyan: false,
    showMagenta: false,
    showYellow: false,
    showBlack: true,
    paperColor: '#ffffff',
    blackAlpha: 1.0,
  },
  'Neon Screen': {
    frequency: 50,
    dotSize: 0.8,
    blendMode: 1,
    paperColor: '#0a0a0a',
    paperAlpha: 1.0,
    cyanInk: '#00ffcc',
    magentaInk: '#ff00aa',
    yellowInk: '#ffee00',
  },
};

// ── Riso Presets ──

export const RISO_FULL_PRESETS_DATA: Record<string, RisoPresetData> = {
  'Vintage Poster': {
    frequency: 45,
    dotSize: 0.95,
    paperColor: '#f5f0e0',
    paperNoise: 0.4,
    inkNoise: 0.5,
    inkDropout: 0.04,
    misregistration: 3,
    edgeBleed: 1.5,
    colors: ['#e3503e', '#00838a', '#f5c520', '#1a1a1a'],
  },
  'Clean Modern': {
    frequency: 80,
    dotSize: 0.8,
    paperColor: '#faf8f2',
    paperNoise: 0.1,
    inkNoise: 0.2,
    inkDropout: 0.01,
    misregistration: 1,
    edgeBleed: 0.5,
    colors: ['#005f73', '#ee6c4d', '#e0e0e0', '#2b2b2b'],
  },
  'Punk Zine': {
    frequency: 35,
    dotSize: 1.0,
    paperColor: '#f0e8d0',
    paperNoise: 0.6,
    inkNoise: 0.7,
    inkDropout: 0.06,
    misregistration: 5,
    edgeBleed: 2,
    colors: ['#ff6eb4', '#00c9a7', '#ffe135', '#333333'],
  },
  'Minimal Duo': {
    frequency: 65,
    dotSize: 0.85,
    paperColor: '#faf8f2',
    paperNoise: 0.15,
    inkNoise: 0.3,
    inkDropout: 0.02,
    misregistration: 2,
    edgeBleed: 1,
    colors: ['#264653', '#e63946'],
  },
  'Atkinson Mono': {
    frequency: 50,
    dotSize: 0.9,
    paperColor: '#f5f0e0',
    paperNoise: 0.3,
    inkNoise: 0.3,
    inkDropout: 0.02,
    misregistration: 2,
    edgeBleed: 1,
    colors: ['#000000', '#ff665e'],
    ditherMode: 'atkinson',
  },
  'Bayer Retro': {
    frequency: 40,
    dotSize: 0.85,
    paperColor: '#f0e8d0',
    paperNoise: 0.2,
    inkNoise: 0.2,
    inkDropout: 0.01,
    misregistration: 1,
    edgeBleed: 0.5,
    colors: ['#3255a4', '#ff6c2f', '#ffe800'],
    ditherMode: 'bayer',
  },
  'Halftone Pop': {
    frequency: 35,
    dotSize: 0.95,
    paperColor: '#faf8f2',
    paperNoise: 0.1,
    inkNoise: 0.15,
    inkDropout: 0.01,
    misregistration: 2,
    edgeBleed: 0.5,
    colors: ['#ff48b0', '#44d62c', '#0078bf', '#000000'],
    ditherMode: 'halftone',
    halftoneShape: 'circle',
  },
  'Line Screen': {
    frequency: 45,
    dotSize: 0.9,
    paperColor: '#f5f0e0',
    paperNoise: 0.25,
    inkNoise: 0.3,
    inkDropout: 0.02,
    misregistration: 2,
    edgeBleed: 1,
    colors: ['#914e72', '#00838a', '#bb8b41'],
    ditherMode: 'halftone',
    halftoneShape: 'line',
  },
};

// ── Texture / Filter Presets ──

export const TEXTURE_PRESETS_DATA: Record<string, TexturePresetData> = {
  Subtle: {
    opacity: 0.15,
    scale: 1.0,
    blendMode: 'soft-light',
    tileMode: true,
    tileGapX: 0,
    tileGapY: 0,
  },
  Bold: {
    opacity: 0.8,
    scale: 1.2,
    blendMode: 'multiply',
    tileMode: true,
    tileGapX: 0,
    tileGapY: 0,
  },
  'Screen Glow': {
    opacity: 0.5,
    scale: 1.0,
    blendMode: 'screen',
    tileMode: true,
    tileGapX: 0,
    tileGapY: 0,
  },
  Overlay: {
    opacity: 0.6,
    scale: 0.8,
    blendMode: 'overlay',
    tileMode: true,
    tileGapX: 10,
    tileGapY: 10,
  },
  Burn: {
    opacity: 0.4,
    scale: 1.5,
    blendMode: 'color-burn',
    tileMode: true,
    tileGapX: 0,
    tileGapY: 0,
  },
  Spaced: {
    opacity: 0.7,
    scale: 0.5,
    blendMode: 'multiply',
    tileMode: true,
    tileGapX: 40,
    tileGapY: 40,
  },
  Single: { opacity: 1.0, scale: 2.0, blendMode: 'multiply', tileMode: false },
  'Mask Cut': {
    opacity: 1.0,
    scale: 1.0,
    blendMode: 'multiply',
    maskMode: true,
    maskInvert: false,
    tileMode: true,
  },
};

// ── Shader types list (for list_presets / UI) ──

export const SHADER_TYPES = [
  'halftone',
  'vhs',
  'ascii',
  'matrixDither',
  'upscale',
  'dither',
  'duotone',
  'filmGrain',
  'pixelate',
  'posterize',
  'chromaticAberration',
  'crtScanlines',
  'edgeDetect',
  'glitch',
] as const;
