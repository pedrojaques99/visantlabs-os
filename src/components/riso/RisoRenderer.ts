import { hexToRgb } from '@/utils/colorUtils';

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
  'Classic': ['#e3503e', '#00838a', '#f5c520', '#1a1a1a'],
  'Fluorescent': ['#ff6eb4', '#00c9a7', '#ffe135', '#333333'],
  'Earth': ['#c4622d', '#2d6a4f', '#dda15e', '#3d3d3d'],
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

export const RISO_FULL_PRESETS: Record<string, RisoFullPreset> = {
  'Vintage Poster': { frequency: 45, dotSize: 0.95, paperColor: '#f5f0e0', paperNoise: 0.4, inkNoise: 0.5, inkDropout: 0.04, misregistration: 3, edgeBleed: 1.5, colors: ['#e3503e', '#00838a', '#f5c520', '#1a1a1a'] },
  'Clean Modern': { frequency: 80, dotSize: 0.8, paperColor: '#faf8f2', paperNoise: 0.1, inkNoise: 0.2, inkDropout: 0.01, misregistration: 1, edgeBleed: 0.5, colors: ['#005f73', '#ee6c4d', '#e0e0e0', '#2b2b2b'] },
  'Punk Zine': { frequency: 35, dotSize: 1.0, paperColor: '#f0e8d0', paperNoise: 0.6, inkNoise: 0.7, inkDropout: 0.06, misregistration: 5, edgeBleed: 2, colors: ['#ff6eb4', '#00c9a7', '#ffe135', '#333333'] },
  'Minimal Duo': { frequency: 65, dotSize: 0.85, paperColor: '#faf8f2', paperNoise: 0.15, inkNoise: 0.3, inkDropout: 0.02, misregistration: 2, edgeBleed: 1, colors: ['#264653', '#e63946'] },
  'Atkinson Mono': { frequency: 50, dotSize: 0.9, paperColor: '#f5f0e0', paperNoise: 0.3, inkNoise: 0.3, inkDropout: 0.02, misregistration: 2, edgeBleed: 1, colors: ['#000000', '#ff665e'], ditherMode: 'atkinson' },
  'Bayer Retro': { frequency: 40, dotSize: 0.85, paperColor: '#f0e8d0', paperNoise: 0.2, inkNoise: 0.2, inkDropout: 0.01, misregistration: 1, edgeBleed: 0.5, colors: ['#3255a4', '#ff6c2f', '#ffe800'], ditherMode: 'bayer' },
  'Halftone Pop': { frequency: 35, dotSize: 0.95, paperColor: '#faf8f2', paperNoise: 0.1, inkNoise: 0.15, inkDropout: 0.01, misregistration: 2, edgeBleed: 0.5, colors: ['#ff48b0', '#44d62c', '#0078bf', '#000000'], ditherMode: 'halftone', halftoneShape: 'circle' },
  'Line Screen': { frequency: 45, dotSize: 0.9, paperColor: '#f5f0e0', paperNoise: 0.25, inkNoise: 0.3, inkDropout: 0.02, misregistration: 2, edgeBleed: 1, colors: ['#914e72', '#00838a', '#bb8b41'], ditherMode: 'halftone', halftoneShape: 'line' },
};

// --- GLSL Shaders (ported from HalftoneRenderer with riso-specific changes) ---

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

uniform float u_frequency;
uniform float u_dotSize;
uniform float u_contrast;
uniform float u_lightness;
uniform float u_paperNoise;
uniform float u_inkNoise;
uniform float u_inkDropout;
uniform float u_misregistration;
uniform float u_edgeBleed;
uniform vec4 u_paperColor;

uniform int u_layerCount;
uniform int u_soloLayer;
uniform int u_ditherMode;
uniform int u_halftoneShape;
uniform float u_effectOpacity;

// Per-layer dither: -1 = use global, 0-4 = override
uniform int u_layerDither0;
uniform int u_layerDither1;
uniform int u_layerDither2;
uniform int u_layerDither3;
uniform int u_layerHShape0;
uniform int u_layerHShape1;
uniform int u_layerHShape2;
uniform int u_layerHShape3;

uniform vec3 u_inkColor0;
uniform vec3 u_inkColor1;
uniform vec3 u_inkColor2;
uniform vec3 u_inkColor3;

uniform float u_inkAlpha0;
uniform float u_inkAlpha1;
uniform float u_inkAlpha2;
uniform float u_inkAlpha3;

uniform float u_inkAngle0;
uniform float u_inkAngle1;
uniform float u_inkAngle2;
uniform float u_inkAngle3;

uniform vec2 u_inkOffset0;
uniform vec2 u_inkOffset1;
uniform vec2 u_inkOffset2;
uniform vec2 u_inkOffset3;

uniform bool u_inkVisible0;
uniform bool u_inkVisible1;
uniform bool u_inkVisible2;
uniform bool u_inkVisible3;

varying vec2 v_texCoord;

// --- Hash noise (high quality 2-tap) ---
float hash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(p.x * p.y * (p.x + p.y));
}

mat2 rotationMatrix(float angle) {
  float rad = radians(angle);
  return mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
}

// --- Color separation (subtractive color model, like p5.riso) ---
// Solves: pixel = paper * (1 - opacity * (1 - ink)) for opacity per channel.
// Weights by ink absorption strength for perceptually correct decomposition.
float getLayerIntensity(vec3 pixel, vec3 ink, vec3 paperRgb,
                        float dist0, float dist1, float dist2, float dist3,
                        int totalLayers) {
  vec3 ratio = pixel / max(paperRgb, vec3(0.01));
  vec3 absorption = max(vec3(1.0) - ink, vec3(0.001));

  // Per-channel ink opacity: (1 - pixel/paper) / (1 - ink)
  vec3 opPerCh = clamp((vec3(1.0) - ratio) / absorption, vec3(0.0), vec3(1.0));

  // Weight by absorption² — channels where ink absorbs more are more informative
  vec3 w = absorption * absorption;
  float opacity = dot(opPerCh, w) / max(dot(w, vec3(1.0)), 0.001);

  // Suppress stray dots in near-paper areas
  float paperDist = distance(pixel, paperRgb);
  opacity *= smoothstep(0.04, 0.15, paperDist);

  return clamp(opacity, 0.0, 1.0);
}

// --- Bayer 4x4 ordered dithering (WebGL 1 compatible, no bitwise ops) ---
float bayerMatrix4(vec2 pos) {
  float x = mod(pos.x, 4.0);
  float y = mod(pos.y, 4.0);
  float idx = x + y * 4.0;
  // Flat lookup — GLSL ES 1.0 has no int arrays, use step chains
  if (idx < 0.5) return 0.0 / 16.0;
  if (idx < 1.5) return 8.0 / 16.0;
  if (idx < 2.5) return 2.0 / 16.0;
  if (idx < 3.5) return 10.0 / 16.0;
  if (idx < 4.5) return 12.0 / 16.0;
  if (idx < 5.5) return 4.0 / 16.0;
  if (idx < 6.5) return 14.0 / 16.0;
  if (idx < 7.5) return 6.0 / 16.0;
  if (idx < 8.5) return 3.0 / 16.0;
  if (idx < 9.5) return 11.0 / 16.0;
  if (idx < 10.5) return 1.0 / 16.0;
  if (idx < 11.5) return 9.0 / 16.0;
  if (idx < 12.5) return 15.0 / 16.0;
  if (idx < 13.5) return 7.0 / 16.0;
  if (idx < 14.5) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

// --- Common grid setup (pixel space, no aspect distortion) ---
vec2 getDitherPos(vec2 st, float angle) {
  vec2 px = st * u_resolution;
  vec2 center = u_resolution * 0.5;
  vec2 centered = px - center;
  vec2 rotated = rotationMatrix(angle) * centered;
  return rotated + center;
}

float getCellScale() {
  return u_frequency / max(u_resolution.x, u_resolution.y);
}

// --- Dot shape within cell (all modes use this for round grain) ---
float dotShape(vec2 f, float dotSz) {
  float d = length(f) * 2.0;
  float r = dotSz * 0.5;
  return 1.0 - smoothstep(r - 0.08, r + 0.08, d);
}

// --- Stochastic riso grain (authentic risograph) ---
float risoGrain(vec2 st, float intensity, float angle, float layerSeed) {
  if (intensity < 0.005) return 0.0;
  if (intensity > 0.995) return 1.0;

  vec2 pos = getDitherPos(st, angle);
  float cellScale = getCellScale();
  vec2 cell = floor(pos * cellScale);
  vec2 f = fract(pos * cellScale) - 0.5;

  float n = hash(cell + layerSeed);

  vec2 medCell = floor(pos * cellScale * 0.2);
  float medNoise = hash(medCell + layerSeed + 43.0);
  float localIntensity = intensity * (0.85 + 0.3 * medNoise);

  float threshold = 1.0 - clamp(localIntensity, 0.0, 1.0);
  float softness = mix(0.1, 0.03, intensity);
  float grain = smoothstep(threshold - softness, threshold + softness, n);

  grain *= dotShape(f, u_dotSize);

  grain = mix(grain, min(grain * (1.0 + u_edgeBleed * 0.15), 1.0), u_edgeBleed * 0.3);

  if (hash(cell + layerSeed + 200.0) < u_inkDropout) grain = 0.0;

  return clamp(grain, 0.0, 1.0);
}

// --- Atkinson dither (characteristic sparse dot pattern) ---
float atkinsonDither(vec2 st, float intensity, float angle, float layerSeed) {
  if (intensity < 0.005) return 0.0;
  if (intensity > 0.995) return 1.0;

  vec2 pos = getDitherPos(st, angle);
  float cellScale = getCellScale();
  vec2 cell = floor(pos * cellScale);
  vec2 f = fract(pos * cellScale) - 0.5;

  float attenuated = intensity * 0.75;

  float n1 = hash(cell + layerSeed);
  float n2 = hash(cell * 1.7 + layerSeed + 71.0);
  float n3 = hash(cell * 0.5 + layerSeed + 137.0);
  float noise = n1 * 0.6 + n2 * 0.25 + n3 * 0.15;

  float threshold = 1.0 - attenuated;
  float dither = smoothstep(threshold - 0.04, threshold + 0.04, noise);

  dither *= dotShape(f, u_dotSize);

  if (hash(cell + layerSeed + 200.0) < u_inkDropout) dither = 0.0;
  return dither;
}

// --- Floyd-Steinberg dither (smooth gradients via error diffusion approx) ---
float floydSteinbergDither(vec2 st, float intensity, float angle, float layerSeed) {
  if (intensity < 0.005) return 0.0;
  if (intensity > 0.995) return 1.0;

  vec2 pos = getDitherPos(st, angle);
  float cellScale = getCellScale();
  vec2 cell = floor(pos * cellScale);
  vec2 f = fract(pos * cellScale) - 0.5;

  float n0 = hash(cell + layerSeed);
  float nR = hash(cell + layerSeed + vec2(1.0, 0.0));
  float nBL = hash(cell + layerSeed + vec2(-1.0, 1.0));
  float nB = hash(cell + layerSeed + vec2(0.0, 1.0));
  float nBR = hash(cell + layerSeed + vec2(1.0, 1.0));

  float errSpread = (nR * 0.4375 + nBL * 0.1875 + nB * 0.3125 + nBR * 0.0625);
  float noise = n0 * 0.5 + errSpread * 0.5;

  float threshold = 1.0 - intensity;
  float dither = smoothstep(threshold - 0.02, threshold + 0.02, noise);

  dither *= dotShape(f, u_dotSize);

  if (hash(cell + layerSeed + 200.0) < u_inkDropout) dither = 0.0;
  return dither;
}

// --- Bayer ordered dither (classic square grid pattern) ---
float bayerDither(vec2 st, float intensity, float angle, float layerSeed) {
  if (intensity < 0.005) return 0.0;
  if (intensity > 0.995) return 1.0;

  vec2 pos = getDitherPos(st, angle);
  float cellScale = getCellScale();
  vec2 cell = pos * cellScale;
  vec2 iCell = floor(cell);

  float threshold = bayerMatrix4(cell);
  float dither = step(threshold, intensity);

  if (hash(iCell + layerSeed + 200.0) < u_inkDropout) dither = 0.0;
  return dither;
}

// --- Halftone shapes (classic AM screening) ---
float halftonePattern(vec2 st, float intensity, float angle, float layerSeed, int shape) {
  if (intensity < 0.005) return 0.0;
  if (intensity > 0.995) return 1.0;

  vec2 pos = getDitherPos(st, angle);
  float cellScale = getCellScale();
  vec2 cell = floor(pos * cellScale);
  vec2 f = fract(pos * cellScale) - 0.5;

  float radius = sqrt(intensity) * u_dotSize * 0.5;
  float result = 0.0;

  if (shape == 0) {
    result = 1.0 - smoothstep(radius - 0.03, radius + 0.03, length(f));
  } else if (shape == 1) {
    result = 1.0 - smoothstep(radius * 0.5 - 0.03, radius * 0.5 + 0.03, abs(f.y));
  } else if (shape == 2) {
    float arm = min(abs(f.x), abs(f.y));
    result = 1.0 - smoothstep(radius * 0.35 - 0.03, radius * 0.35 + 0.03, arm);
  } else {
    vec2 ef = vec2(f.x * 0.65, f.y);
    result = 1.0 - smoothstep(radius - 0.03, radius + 0.03, length(ef));
  }

  if (hash(cell + layerSeed + 200.0) < u_inkDropout) result = 0.0;
  return clamp(result, 0.0, 1.0);
}

// --- Per-layer dither dispatch ---
float applyLayerDither(vec2 st, float intensity, float angle, float layerSeed, int layerDither, int layerShape) {
  int mode = layerDither >= 0 ? layerDither : u_ditherMode;
  int shape = layerShape >= 0 ? layerShape : u_halftoneShape;

  if (mode == 1) return atkinsonDither(st, intensity, angle, layerSeed);
  if (mode == 2) return floydSteinbergDither(st, intensity, angle, layerSeed);
  if (mode == 3) return bayerDither(st, intensity, angle, layerSeed);
  if (mode == 4) return halftonePattern(st, intensity, angle, layerSeed, shape);
  return risoGrain(st, intensity, angle, layerSeed);
}

// --- Image sampling ---
vec3 sampleAt(vec2 uv) {
  vec3 color = texture2D(u_texture, clamp(uv, 0.0, 1.0)).rgb;
  color = (color - 0.5) * u_contrast + 0.5 + u_lightness;
  return clamp(color, 0.0, 1.0);
}

void main() {
  vec2 st = v_texCoord;
  vec2 paperCoord = st * u_resolution;

  // Paper texture — multi-octave fiber grain
  float grain = hash(paperCoord * 0.4) * 0.5
              + hash(paperCoord * 0.2 + 7.3) * 0.3
              + hash(paperCoord * 0.08 + 13.7) * 0.2;
  grain = (grain - 0.5) * u_paperNoise * 0.06;

  vec3 paperRgb = u_paperColor.rgb;
  vec3 paper = paperRgb + grain;

  // Ink absorption variation
  float inkAbsorb = hash(paperCoord * 0.15 + 31.0);
  float absorbMod = 1.0 - u_inkNoise * 0.2 * (inkAbsorb - 0.5);

  vec3 result = paper;

  // Misregistration in UV space
  vec2 misregUnit = u_misregistration / u_resolution;

  // Compute distances for color separation (RGB — proven thresholds)
  vec3 p0 = sampleAt(st + u_inkOffset0 * misregUnit);
  vec3 p1 = sampleAt(st + u_inkOffset1 * misregUnit);
  vec3 p2 = sampleAt(st + u_inkOffset2 * misregUnit);
  vec3 p3 = sampleAt(st + u_inkOffset3 * misregUnit);

  float d0 = distance(p0, u_inkColor0);
  float d1 = distance(p1, u_inkColor1);
  float d2 = distance(p2, u_inkColor2);
  float d3 = distance(p3, u_inkColor3);

  // Each layer: intensity → dither → multiply-blend
  if (u_inkVisible0 && (u_soloLayer < 0 || u_soloLayer == 0) && u_layerCount > 0) {
    vec2 offsetUV = st + u_inkOffset0 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor0, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = applyLayerDither(offsetUV, intensity, u_inkAngle0, 0.0, u_layerDither0, u_layerHShape0);
    float a = u_inkAlpha0 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor0, a);
  }

  if (u_inkVisible1 && (u_soloLayer < 0 || u_soloLayer == 1) && u_layerCount > 1) {
    vec2 offsetUV = st + u_inkOffset1 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor1, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = applyLayerDither(offsetUV, intensity, u_inkAngle1, 100.0, u_layerDither1, u_layerHShape1);
    float a = u_inkAlpha1 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor1, a);
  }

  if (u_inkVisible2 && (u_soloLayer < 0 || u_soloLayer == 2) && u_layerCount > 2) {
    vec2 offsetUV = st + u_inkOffset2 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor2, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = applyLayerDither(offsetUV, intensity, u_inkAngle2, 200.0, u_layerDither2, u_layerHShape2);
    float a = u_inkAlpha2 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor2, a);
  }

  if (u_inkVisible3 && (u_soloLayer < 0 || u_soloLayer == 3) && u_layerCount > 3) {
    vec2 offsetUV = st + u_inkOffset3 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor3, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = applyLayerDither(offsetUV, intensity, u_inkAngle3, 300.0, u_layerDither3, u_layerHShape3);
    float a = u_inkAlpha3 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor3, a);
  }

  vec3 original = texture2D(u_texture, v_texCoord).rgb;
  result = mix(original, result, u_effectOpacity);
  gl_FragColor = vec4(result, 1.0);
}`;

// --- Perceptual color distance (CPU-side LAB) ---

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let lr = r / 255, lg = g / 255, lb = b / 255;
  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;

  let x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  let y = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722);
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

  // K-means++ initialization for better centroid spread
  const centroids: [number, number, number][] = [samples[Math.floor(Math.random() * samples.length)]];
  for (let k = 1; k < count; k++) {
    const dists = samples.map(s => {
      let minD = Infinity;
      for (const c of centroids) minD = Math.min(minD, colorDistance(s, c));
      return minD * minD;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { centroids.push(samples[i]); break; }
    }
    if (centroids.length <= k) centroids.push(samples[Math.floor(Math.random() * samples.length)]);
  }

  for (let iter = 0; iter < 20; iter++) {
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
  count: number,
): [number, number, number][] {
  const colors = extractDominantColors(imageData, count);
  return colors.map(c => {
    let bestInk = targetInks[0];
    let bestDist = Infinity;
    for (const ink of targetInks) {
      const d = colorDistance(c, ink.rgb);
      if (d < bestDist) { bestDist = d; bestInk = ink; }
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
      'u_texture', 'u_resolution', 'u_frequency', 'u_dotSize',
      'u_contrast', 'u_lightness', 'u_paperNoise', 'u_inkNoise',
      'u_inkDropout', 'u_misregistration', 'u_edgeBleed', 'u_paperColor',
      'u_layerCount', 'u_soloLayer', 'u_ditherMode', 'u_halftoneShape', 'u_effectOpacity',
      'u_layerDither0', 'u_layerDither1', 'u_layerDither2', 'u_layerDither3',
      'u_layerHShape0', 'u_layerHShape1', 'u_layerHShape2', 'u_layerHShape3',
      'u_inkColor0', 'u_inkColor1', 'u_inkColor2', 'u_inkColor3',
      'u_inkAlpha0', 'u_inkAlpha1', 'u_inkAlpha2', 'u_inkAlpha3',
      'u_inkAngle0', 'u_inkAngle1', 'u_inkAngle2', 'u_inkAngle3',
      'u_inkOffset0', 'u_inkOffset1', 'u_inkOffset2', 'u_inkOffset3',
      'u_inkVisible0', 'u_inkVisible1', 'u_inkVisible2', 'u_inkVisible3',
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
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);

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
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
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

    const ditherModeMapGlobal: Record<string, number> = { stochastic: 0, atkinson: 1, floydsteinberg: 2, bayer: 3, halftone: 4 };
    const shapeMapGlobal: Record<string, number> = { circle: 0, line: 1, cross: 2, ellipse: 3 };
    gl.uniform1i(u.u_ditherMode, ditherModeMapGlobal[settings.ditherMode] ?? 0);
    gl.uniform1i(u.u_halftoneShape, shapeMapGlobal[settings.halftoneShape] ?? 0);
    gl.uniform1f(u.u_effectOpacity, settings.effectOpacity ?? 1.0);

    const colorUniforms = [u.u_inkColor0, u.u_inkColor1, u.u_inkColor2, u.u_inkColor3];
    const alphaUniforms = [u.u_inkAlpha0, u.u_inkAlpha1, u.u_inkAlpha2, u.u_inkAlpha3];
    const angleUniforms = [u.u_inkAngle0, u.u_inkAngle1, u.u_inkAngle2, u.u_inkAngle3];
    const offsetUniforms = [u.u_inkOffset0, u.u_inkOffset1, u.u_inkOffset2, u.u_inkOffset3];
    const visibleUniforms = [u.u_inkVisible0, u.u_inkVisible1, u.u_inkVisible2, u.u_inkVisible3];

    const ditherModeMap: Record<string, number> = { stochastic: 0, atkinson: 1, floydsteinberg: 2, bayer: 3, halftone: 4 };
    const shapeMap: Record<string, number> = { circle: 0, line: 1, cross: 2, ellipse: 3 };
    const layerDitherUniforms = [u.u_layerDither0, u.u_layerDither1, u.u_layerDither2, u.u_layerDither3];
    const layerHShapeUniforms = [u.u_layerHShape0, u.u_layerHShape1, u.u_layerHShape2, u.u_layerHShape3];

    for (let i = 0; i < 4; i++) {
      if (i < layers.length) {
        const layer = layers[i];
        const c = [layer.color[0] / 255, layer.color[1] / 255, layer.color[2] / 255];
        gl.uniform3f(colorUniforms[i], c[0], c[1], c[2]);
        gl.uniform1f(alphaUniforms[i], layer.alpha);
        gl.uniform1f(angleUniforms[i], layer.angle);
        gl.uniform2f(offsetUniforms[i], layer.offsetX, layer.offsetY);
        gl.uniform1i(visibleUniforms[i], layer.visible ? 1 : 0);
        gl.uniform1i(layerDitherUniforms[i], layer.ditherMode ? ditherModeMap[layer.ditherMode] ?? -1 : -1);
        gl.uniform1i(layerHShapeUniforms[i], layer.halftoneShape ? shapeMap[layer.halftoneShape] ?? -1 : -1);
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
