/**
 * Riso GLSL Shaders — single source of truth for the vertex + fragment shader.
 *
 * Run by the browser RisoRenderer (WebGLRenderingContext) and the server riso
 * renderer (headless-gl) — same source, identical output. Uniform contract:
 * see the per-layer `u_ink*` uniforms below (max 4 ink layers).
 */

export const RISO_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}`;

export const RISO_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

uniform float u_frequency;
uniform float u_dotSize;
uniform float u_dotSpacing;
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

float hash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(p.x * p.y * (p.x + p.y));
}

mat2 rotationMatrix(float angle) {
  float rad = radians(angle);
  return mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
}

float getLayerIntensity(vec3 pixel, vec3 ink, vec3 paperRgb,
                        float dist0, float dist1, float dist2, float dist3,
                        int totalLayers) {
  vec3 ratio = pixel / max(paperRgb, vec3(0.01));
  vec3 absorption = max(vec3(1.0) - ink, vec3(0.001));
  vec3 opPerCh = clamp((vec3(1.0) - ratio) / absorption, vec3(0.0), vec3(1.0));
  vec3 w = absorption * absorption;
  float opacity = dot(opPerCh, w) / max(dot(w, vec3(1.0)), 0.001);
  float paperDist = distance(pixel, paperRgb);
  opacity *= smoothstep(0.04, 0.15, paperDist);
  return clamp(opacity, 0.0, 1.0);
}

float bayerMatrix4(vec2 pos) {
  float x = mod(pos.x, 4.0);
  float y = mod(pos.y, 4.0);
  float idx = x + y * 4.0;
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

float dotShape(vec2 f, float dotSz) {
  float d = length(f) * 2.0;
  float r = max(0.0, dotSz * 0.5 - u_dotSpacing * 0.5);
  return 1.0 - smoothstep(r - 0.08, r + 0.08, d);
}

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

float halftonePattern(vec2 st, float intensity, float angle, float layerSeed, int shape) {
  if (intensity < 0.005) return 0.0;
  if (intensity > 0.995) return 1.0;
  vec2 pos = getDitherPos(st, angle);
  float cellScale = getCellScale();
  vec2 cell = floor(pos * cellScale);
  vec2 f = fract(pos * cellScale) - 0.5;
  float radius = max(0.0, sqrt(intensity) * u_dotSize * 0.5 - u_dotSpacing * 0.5);
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

float applyLayerDither(vec2 st, float intensity, float angle, float layerSeed, int layerDither, int layerShape) {
  int mode = layerDither >= 0 ? layerDither : u_ditherMode;
  int shape = layerShape >= 0 ? layerShape : u_halftoneShape;
  if (mode == 1) return atkinsonDither(st, intensity, angle, layerSeed);
  if (mode == 2) return floydSteinbergDither(st, intensity, angle, layerSeed);
  if (mode == 3) return bayerDither(st, intensity, angle, layerSeed);
  if (mode == 4) return halftonePattern(st, intensity, angle, layerSeed, shape);
  return risoGrain(st, intensity, angle, layerSeed);
}

vec3 sampleAt(vec2 uv) {
  vec3 color = texture2D(u_texture, clamp(uv, 0.0, 1.0)).rgb;
  color = (color - 0.5) * u_contrast + 0.5 + u_lightness;
  return clamp(color, 0.0, 1.0);
}

void main() {
  vec2 st = v_texCoord;
  vec2 paperCoord = st * u_resolution;

  float grain = hash(paperCoord * 0.4) * 0.5
              + hash(paperCoord * 0.2 + 7.3) * 0.3
              + hash(paperCoord * 0.08 + 13.7) * 0.2;
  grain = (grain - 0.5) * u_paperNoise * 0.06;

  vec3 paperRgb = u_paperColor.rgb;
  vec3 paper = paperRgb + grain;

  float inkAbsorb = hash(paperCoord * 0.15 + 31.0);
  float absorbMod = 1.0 - u_inkNoise * 0.2 * (inkAbsorb - 0.5);

  vec3 result = paper;

  vec2 misregUnit = u_misregistration / u_resolution;

  vec3 p0 = sampleAt(st + u_inkOffset0 * misregUnit);
  vec3 p1 = sampleAt(st + u_inkOffset1 * misregUnit);
  vec3 p2 = sampleAt(st + u_inkOffset2 * misregUnit);
  vec3 p3 = sampleAt(st + u_inkOffset3 * misregUnit);

  float d0 = distance(p0, u_inkColor0);
  float d1 = distance(p1, u_inkColor1);
  float d2 = distance(p2, u_inkColor2);
  float d3 = distance(p3, u_inkColor3);

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
