import { hexToRgb } from '@/utils/colorUtils';

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
  soloLayer?: number;
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
  soloLayer: -1,
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
}

export const RISO_FULL_PRESETS: Record<string, RisoFullPreset> = {
  'Vintage Poster': { frequency: 45, dotSize: 0.95, paperColor: '#f5f0e0', paperNoise: 0.4, inkNoise: 0.5, inkDropout: 0.04, misregistration: 3, edgeBleed: 1.5, colors: ['#e3503e', '#00838a', '#f5c520', '#1a1a1a'] },
  'Clean Modern': { frequency: 80, dotSize: 0.8, paperColor: '#faf8f2', paperNoise: 0.1, inkNoise: 0.2, inkDropout: 0.01, misregistration: 1, edgeBleed: 0.5, colors: ['#005f73', '#ee6c4d', '#e0e0e0', '#2b2b2b'] },
  'Punk Zine': { frequency: 35, dotSize: 1.0, paperColor: '#f0e8d0', paperNoise: 0.6, inkNoise: 0.7, inkDropout: 0.06, misregistration: 5, edgeBleed: 2, colors: ['#ff6eb4', '#00c9a7', '#ffe135', '#333333'] },
  'Minimal Duo': { frequency: 65, dotSize: 0.85, paperColor: '#faf8f2', paperNoise: 0.15, inkNoise: 0.3, inkDropout: 0.02, misregistration: 2, edgeBleed: 1, colors: ['#264653', '#e63946'] },
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

// --- Hash noise ---
float hash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(p.x * p.y * (p.x + p.y));
}

mat2 rotationMatrix(float angle) {
  float rad = radians(angle);
  return mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
}

// --- Color separation ---
float getLayerIntensity(vec3 pixel, vec3 ink, vec3 paperRgb,
                        float dist0, float dist1, float dist2, float dist3,
                        int totalLayers) {
  float paperDist = distance(pixel, paperRgb);
  if (paperDist < 0.12) return 0.0;

  float lum = dot(pixel, vec3(0.299, 0.587, 0.114));
  float darkness = 1.0 - lum;

  float myDist = distance(pixel, ink);

  float minDist = dist0;
  if (totalLayers > 1) minDist = min(minDist, dist1);
  if (totalLayers > 2) minDist = min(minDist, dist2);
  if (totalLayers > 3) minDist = min(minDist, dist3);

  float ownership = 0.0;
  if (myDist <= minDist + 0.02) {
    ownership = 1.0;
  } else {
    float ratio = (minDist + 0.02) / (myDist + 0.02);
    ownership = ratio * ratio * ratio * 0.12;
  }

  float intensity = ownership * smoothstep(0.05, 0.45, darkness) * (0.25 + 0.75 * darkness);
  return clamp(intensity, 0.0, 1.0);
}

// --- Stochastic riso grain ---
// Real risograph uses stochastic screening: random noise thresholded by intensity.
// Sparse speckles at low %, dense grain at mid %, near-solid at high %.
float risoGrain(vec2 st, float intensity, float angle, float layerSeed) {
  if (intensity < 0.005) return 0.0;
  if (intensity > 0.995) return 1.0;

  vec2 aspectSt = st;
  aspectSt.x *= u_resolution.x / u_resolution.y;
  vec2 rotSt = rotationMatrix(angle) * aspectSt;
  vec2 pos = rotSt * u_resolution;

  // Grain cell size: dotSize scales particle size, frequency scales density
  // Larger dotSize = bigger grain particles, higher frequency = finer texture
  float cellScale = u_frequency / (120.0 * u_dotSize);
  vec2 cell = floor(pos * cellScale);
  vec2 f = fract(pos * cellScale) - 0.5;

  // Primary noise per grain cell
  float n = hash(cell + layerSeed);

  // Medium-scale variation for uneven ink absorption
  vec2 medCell = floor(pos * cellScale * 0.2);
  float medNoise = hash(medCell + layerSeed + 43.0);
  float localIntensity = intensity * (0.85 + 0.3 * medNoise);

  // Threshold: intensity determines what fraction of cells get ink
  float threshold = 1.0 - clamp(localIntensity, 0.0, 1.0);

  // Soft transition width — wider at low densities for organic sparse dots
  float softness = mix(0.1, 0.03, intensity);
  float grain = smoothstep(threshold - softness, threshold + softness, n);

  // Organic dot shape — not perfectly square cells
  // Use distance from cell center to soften edges
  float cellDist = length(f) * 1.4;
  float edgeSoften = smoothstep(1.0, 0.3, cellDist);
  grain *= mix(1.0, edgeSoften, 0.3 * (1.0 - intensity));

  // Edge bleed — expand grain particles
  grain = mix(grain, min(grain * (1.0 + u_edgeBleed * 0.15), 1.0), u_edgeBleed * 0.3);

  // Ink dropout — random cells go blank
  if (hash(cell + layerSeed + 200.0) < u_inkDropout) grain = 0.0;

  return clamp(grain, 0.0, 1.0);
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

  // Paper texture — subtle fiber grain
  float grain = hash(paperCoord * 0.4) * 0.5
              + hash(paperCoord * 0.2 + 7.3) * 0.3
              + hash(paperCoord * 0.08 + 13.7) * 0.2;
  grain = (grain - 0.5) * u_paperNoise * 0.06;

  vec3 paperRgb = u_paperColor.rgb;
  vec3 paper = paperRgb + grain;

  // Ink absorption variation across paper surface
  float inkAbsorb = hash(paperCoord * 0.15 + 31.0);
  float absorbMod = 1.0 - u_inkNoise * 0.2 * (inkAbsorb - 0.5);

  vec3 result = paper;

  // Misregistration in UV space
  vec2 misregUnit = u_misregistration / u_resolution;

  // Compute distances for color separation
  vec3 p0 = sampleAt(st + u_inkOffset0 * misregUnit);
  vec3 p1 = sampleAt(st + u_inkOffset1 * misregUnit);
  vec3 p2 = sampleAt(st + u_inkOffset2 * misregUnit);
  vec3 p3 = sampleAt(st + u_inkOffset3 * misregUnit);

  float d0 = distance(p0, u_inkColor0);
  float d1 = distance(p1, u_inkColor1);
  float d2 = distance(p2, u_inkColor2);
  float d3 = distance(p3, u_inkColor3);

  // Each layer: compute intensity, generate grain, multiply-blend ink
  // Multiply blend = how real transparent inks work (overlaps darken/mix colors)

  if (u_inkVisible0 && (u_soloLayer < 0 || u_soloLayer == 0) && u_layerCount > 0) {
    vec2 offsetUV = st + u_inkOffset0 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor0, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = risoGrain(offsetUV, intensity, u_inkAngle0, 0.0);
    float a = u_inkAlpha0 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor0, a);
  }

  if (u_inkVisible1 && (u_soloLayer < 0 || u_soloLayer == 1) && u_layerCount > 1) {
    vec2 offsetUV = st + u_inkOffset1 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor1, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = risoGrain(offsetUV, intensity, u_inkAngle1, 100.0);
    float a = u_inkAlpha1 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor1, a);
  }

  if (u_inkVisible2 && (u_soloLayer < 0 || u_soloLayer == 2) && u_layerCount > 2) {
    vec2 offsetUV = st + u_inkOffset2 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor2, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = risoGrain(offsetUV, intensity, u_inkAngle2, 200.0);
    float a = u_inkAlpha2 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor2, a);
  }

  if (u_inkVisible3 && (u_soloLayer < 0 || u_soloLayer == 3) && u_layerCount > 3) {
    vec2 offsetUV = st + u_inkOffset3 * misregUnit;
    vec3 pixel = sampleAt(offsetUV);
    float intensity = getLayerIntensity(pixel, u_inkColor3, paperRgb, d0, d1, d2, d3, u_layerCount);
    float g = risoGrain(offsetUV, intensity, u_inkAngle3, 300.0);
    float a = u_inkAlpha3 * g * absorbMod;
    result = result * mix(vec3(1.0), u_inkColor3, a);
  }

  gl_FragColor = vec4(result, 1.0);
}`;

// --- Color extraction (CPU, runs once on image load) ---

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

  centroids.sort((a, b) => {
    const lumA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const lumB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    return lumB - lumA;
  });

  return centroids;
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
      'u_layerCount', 'u_soloLayer',
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

  setupTexture(img: HTMLImageElement): void {
    if (!this.gl) return;
    if (this.texture) this.gl.deleteTexture(this.texture);

    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);

    this.imageWidth = img.naturalWidth || img.width;
    this.imageHeight = img.naturalHeight || img.height;
    this.canvas.width = this.imageWidth;
    this.canvas.height = this.imageHeight;
    this.gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    this.isImageLoaded = true;
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

    const colorUniforms = [u.u_inkColor0, u.u_inkColor1, u.u_inkColor2, u.u_inkColor3];
    const alphaUniforms = [u.u_inkAlpha0, u.u_inkAlpha1, u.u_inkAlpha2, u.u_inkAlpha3];
    const angleUniforms = [u.u_inkAngle0, u.u_inkAngle1, u.u_inkAngle2, u.u_inkAngle3];
    const offsetUniforms = [u.u_inkOffset0, u.u_inkOffset1, u.u_inkOffset2, u.u_inkOffset3];
    const visibleUniforms = [u.u_inkVisible0, u.u_inkVisible1, u.u_inkVisible2, u.u_inkVisible3];

    for (let i = 0; i < 4; i++) {
      if (i < layers.length) {
        const layer = layers[i];
        const c = [layer.color[0] / 255, layer.color[1] / 255, layer.color[2] / 255];
        gl.uniform3f(colorUniforms[i], c[0], c[1], c[2]);
        gl.uniform1f(alphaUniforms[i], layer.alpha);
        gl.uniform1f(angleUniforms[i], layer.angle);
        gl.uniform2f(offsetUniforms[i], layer.offsetX, layer.offsetY);
        gl.uniform1i(visibleUniforms[i], layer.visible ? 1 : 0);
      } else {
        gl.uniform3f(colorUniforms[i], 0, 0, 0);
        gl.uniform1f(alphaUniforms[i], 0);
        gl.uniform1f(angleUniforms[i], 0);
        gl.uniform2f(offsetUniforms[i], 0, 0);
        gl.uniform1i(visibleUniforms[i], 0);
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
