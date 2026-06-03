/**
 * ImageLab Server-Side Service
 *
 * Orchestrates halftone, texture, riso, and shader rendering server-side.
 * Used by MCP tools and HTTP API routes.
 */
type NapiCanvasModule = typeof import('@napi-rs/canvas');
type Canvas = import('@napi-rs/canvas').Canvas;
type CanvasImage = import('@napi-rs/canvas').Image;

let _napiCanvas: NapiCanvasModule | null = null;
async function getNapiCanvas() {
  if (!_napiCanvas) _napiCanvas = await import('@napi-rs/canvas');
  return _napiCanvas;
}
import { uploadImage } from '../r2Service.js';
import { generateHalftoneSvg } from './halftoneRenderer.js';
import { renderRiso } from './risoRenderer.js';
import { renderShader } from './shaderRenderer.js';
import { HALFTONE_PRESETS, RISO_FULL_PRESETS, TEXTURE_PRESETS, SHADER_TYPES } from './presets.js';
import {
  HALFTONE_DEFAULTS,
  TEXTURE_DEFAULTS,
  type HalftoneSettings,
  type RisoSettings,
  type InkLayer,
  type TextureSettings,
  type ImageLabMode,
  type ExportFormat,
  type ShaderType,
  type ImageLabRequest,
  type ShaderRequest,
  type ChainRequest,
  type ImageLabResult,
} from './types.js';

// ── Constants ──

const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 30_000;
const VALID_MODES = new Set<ImageLabMode>(['halftone', 'texture', 'riso']);
const VALID_SHADER_TYPES = new Set<string>([
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
]);

// ── Security ──

function validateImageUrl(url: string): void {
  if (url.startsWith('data:')) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid image URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed.');
  }
  const hostname = parsed.hostname.toLowerCase();
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'metadata.google.internal'];
  if (blocked.includes(hostname)) throw new Error('URL hostname is not allowed.');
  // Block private IP ranges
  const parts = hostname.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const first = parseInt(parts[0]);
    if (first === 10 || first === 127) throw new Error('Private IP addresses are not allowed.');
    if (first === 172 && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31)
      throw new Error('Private IP addresses are not allowed.');
    if (first === 192 && parseInt(parts[1]) === 168)
      throw new Error('Private IP addresses are not allowed.');
    if (first === 169 && parseInt(parts[1]) === 254)
      throw new Error('Link-local addresses are not allowed.');
  }
}

// ── Image loading ──

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  validateImageUrl(imageUrl);
  if (imageUrl.startsWith('data:')) {
    const base64 = imageUrl.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    if (buf.length > MAX_IMAGE_BYTES)
      throw new Error(
        `Image too large (${(buf.length / 1024 / 1024).toFixed(1)} MB, max ${
          MAX_IMAGE_BYTES / 1024 / 1024
        } MB).`
      );
    return buf;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES)
      throw new Error(
        `Image too large (${(buf.length / 1024 / 1024).toFixed(1)} MB, max ${
          MAX_IMAGE_BYTES / 1024 / 1024
        } MB).`
      );
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function loadSourceImage(
  imageUrl: string
): Promise<{
  image: CanvasImage;
  canvas: Canvas;
  pixels: Uint8Array;
  width: number;
  height: number;
}> {
  const { createCanvas, loadImage } = await getNapiCanvas();
  const buf = await fetchImageBuffer(imageUrl);
  const image = await loadImage(buf);
  const width = image.width;
  const height = image.height;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Image dimensions ${width}x${height} exceed maximum ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}.`
    );
  }
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { image, canvas, pixels: new Uint8Array(imageData.data.buffer), width, height };
}

async function pixelsToBase64Png(
  pixels: Uint8Array,
  width: number,
  height: number
): Promise<string> {
  const { createCanvas } = await getNapiCanvas();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

function canvasToBase64(canvas: Canvas, format: ExportFormat = 'png', quality?: number): string {
  if (format === 'jpeg') {
    return canvas.toDataURL('image/jpeg', quality ? quality / 100 : 0.92);
  }
  return canvas.toDataURL('image/png');
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ── Halftone ──

async function applyHalftone(
  imageUrl: string,
  preset?: string,
  settings?: Record<string, any>,
  format: ExportFormat = 'png'
): Promise<{ base64: string; width: number; height: number }> {
  const { pixels, width, height, canvas } = await loadSourceImage(imageUrl);

  const merged: HalftoneSettings = { ...HALFTONE_DEFAULTS };
  if (preset && HALFTONE_PRESETS[preset]) Object.assign(merged, HALFTONE_PRESETS[preset]);
  if (settings) Object.assign(merged, settings);

  if (format === 'svg') {
    const svg = generateHalftoneSvg(new Uint8ClampedArray(pixels.buffer), width, height, merged);
    const svgBase64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    return { base64: svgBase64, width, height };
  }

  // For PNG/JPEG, generate SVG then rasterize with canvas
  const { createCanvas: mkCanvas, loadImage: ldImage } = await getNapiCanvas();
  const svg = generateHalftoneSvg(new Uint8ClampedArray(pixels.buffer), width, height, merged);
  const svgBuf = Buffer.from(svg);
  const svgImage = await ldImage(svgBuf);
  const out = mkCanvas(width, height);
  const ctx = out.getContext('2d');
  ctx.drawImage(svgImage, 0, 0, width, height);
  return { base64: canvasToBase64(out, format), width, height };
}

// ── Texture ──

async function applyTexture(
  imageUrl: string,
  preset?: string,
  settings?: Record<string, any>,
  format: ExportFormat = 'png'
): Promise<{ base64: string; width: number; height: number }> {
  const { image, width, height } = await loadSourceImage(imageUrl);

  const merged: TextureSettings = { ...TEXTURE_DEFAULTS };
  if (preset && TEXTURE_PRESETS[preset]) Object.assign(merged, TEXTURE_PRESETS[preset]);
  if (settings) Object.assign(merged, settings);

  // Load texture
  let textureBuf: Buffer;
  if (merged.textureUrl) {
    textureBuf = await fetchImageBuffer(merged.textureUrl);
  } else {
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');
    const texPath = resolve(process.cwd(), 'public', 'textures', `${merged.textureName}.svg`);
    textureBuf = await readFile(texPath);
  }
  const { createCanvas: mkCanvas, loadImage: ldImage } = await getNapiCanvas();
  const textureImg = await ldImage(textureBuf);

  const out = mkCanvas(width, height);
  const ctx = out.getContext('2d');

  if (merged.maskMode) {
    // Draw source
    ctx.drawImage(image, 0, 0);
    // Create mask canvas
    const maskCanvas = mkCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d');
    drawTextureLayer(maskCtx, textureImg, width, height, merged, mkCanvas);
    ctx.globalCompositeOperation = merged.maskInvert ? 'destination-out' : 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
  } else {
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = merged.blendMode as any;
    ctx.globalAlpha = merged.opacity;
    drawTextureLayer(ctx, textureImg, width, height, merged, mkCanvas);
  }

  return { base64: canvasToBase64(out, format), width, height };
}

function drawTextureLayer(
  ctx: any,
  textureImg: CanvasImage,
  width: number,
  height: number,
  settings: TextureSettings,
  mkCanvas: NapiCanvasModule['createCanvas']
): void {
  let texSource: CanvasImage | Canvas = textureImg;

  // Recolor if not using original color
  if (!settings.useOriginalColor) {
    const recolorCanvas = mkCanvas(textureImg.width, textureImg.height);
    const rctx = recolorCanvas.getContext('2d');
    rctx.drawImage(textureImg, 0, 0);
    rctx.globalCompositeOperation = 'source-in';
    rctx.fillStyle = settings.textureColor;
    rctx.fillRect(0, 0, textureImg.width, textureImg.height);
    texSource = recolorCanvas;
  }

  const tw = textureImg.width * settings.scale;
  const th = textureImg.height * settings.scale;

  ctx.save();
  if (settings.rotation) {
    ctx.translate(width / 2, height / 2);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);
  }

  if (settings.tileMode) {
    const gapX = settings.tileGapX || 0;
    const gapY = settings.tileGapY || 0;
    for (let y = -th; y < height + th; y += th + gapY) {
      for (let x = -tw; x < width + tw; x += tw + gapX) {
        ctx.drawImage(texSource, x + settings.offsetX, y + settings.offsetY, tw, th);
      }
    }
  } else {
    ctx.drawImage(texSource, settings.offsetX, settings.offsetY, tw, th);
  }
  ctx.restore();
}

// ── Riso ──

async function applyRiso(
  imageUrl: string,
  preset?: string,
  settings?: Record<string, any>,
  format: ExportFormat = 'png'
): Promise<{ base64: string; width: number; height: number }> {
  const { pixels, width, height } = await loadSourceImage(imageUrl);

  const merged: Partial<RisoSettings> = {
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

  if (preset && RISO_FULL_PRESETS[preset]) {
    const p = RISO_FULL_PRESETS[preset];
    Object.assign(merged, {
      frequency: p.frequency,
      dotSize: p.dotSize,
      paperColor: p.paperColor,
      paperNoise: p.paperNoise,
      inkNoise: p.inkNoise,
      inkDropout: p.inkDropout,
      misregistration: p.misregistration,
      edgeBleed: p.edgeBleed,
      ditherMode: p.ditherMode,
      halftoneShape: p.halftoneShape,
    });
    merged.layers = p.colors.map((hex, i) => ({
      color: hexToRgb(hex),
      hex,
      visible: true,
      alpha: 0.85,
      angle: i * 22.5,
      offsetX: [1, -1, 1, -1][i],
      offsetY: [-1, 1, 1, -1][i],
    }));
  }
  if (settings) Object.assign(merged, settings);

  if (!merged.layers?.length) {
    throw new Error('Riso mode requires ink layers. Use a preset or provide layers in settings.');
  }

  const result = await renderRiso(pixels, width, height, merged as RisoSettings);
  if (!result)
    throw new Error(
      'Riso rendering failed — headless-gl may not be available. Install with: npm install gl'
    );

  return { base64: await pixelsToBase64Png(result, width, height), width, height };
}

// ── Shader ──

async function applyShaderEffect(
  imageUrl: string,
  shaderType: ShaderType,
  settings: Record<string, any> = {},
  format: ExportFormat = 'png'
): Promise<{ base64: string; width: number; height: number }> {
  const { pixels, width, height } = await loadSourceImage(imageUrl);

  const result = await renderShader(pixels, width, height, shaderType, settings);
  if (!result)
    throw new Error(`Shader '${shaderType}' rendering failed — headless-gl may not be available.`);

  return { base64: await pixelsToBase64Png(result, width, height), width, height };
}

// ── Public API ──

export async function imageLabApplyEffect(
  req: ImageLabRequest,
  userId: string
): Promise<ImageLabResult> {
  const { imageUrl, mode, preset, settings, format = 'png', quality } = req;
  if (!imageUrl) throw new Error('imageUrl is required.');
  if (!VALID_MODES.has(mode))
    throw new Error(`Invalid mode "${mode}". Must be one of: ${[...VALID_MODES].join(', ')}`);

  let result: { base64: string; width: number; height: number };

  switch (mode) {
    case 'halftone':
      result = await applyHalftone(imageUrl, preset, settings, format);
      break;
    case 'texture':
      result = await applyTexture(imageUrl, preset, settings, format);
      break;
    case 'riso':
      result = await applyRiso(imageUrl, preset, settings, format);
      break;
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }

  const url = await uploadImage(result.base64, userId, `imagelab-${mode}`);
  return { imageUrl: url, format, width: result.width, height: result.height, mode, preset };
}

export async function imageLabApplyShader(
  req: ShaderRequest,
  userId: string
): Promise<ImageLabResult> {
  const { imageUrl, shaderType, settings = {}, format = 'png' } = req;
  if (!imageUrl) throw new Error('imageUrl is required.');
  if (!VALID_SHADER_TYPES.has(shaderType))
    throw new Error(
      `Invalid shaderType "${shaderType}". Must be one of: ${[...VALID_SHADER_TYPES].join(', ')}`
    );
  const result = await applyShaderEffect(imageUrl, shaderType, settings, format);
  const url = await uploadImage(result.base64, userId, `imagelab-shader-${shaderType}`);
  return {
    imageUrl: url,
    format,
    width: result.width,
    height: result.height,
    mode: 'shader' as any,
  };
}

export async function imageLabChain(req: ChainRequest, userId: string): Promise<ImageLabResult> {
  let currentUrl = req.imageUrl;
  let width = 0,
    height = 0;

  // Step 1: Apply effect
  if (req.effect) {
    const effectResult = await imageLabApplyEffect(
      {
        imageUrl: currentUrl,
        mode: req.effect.mode,
        preset: req.effect.preset,
        settings: { ...req.effect.settings, effectOpacity: req.effectOpacity },
        format: 'png',
      },
      userId
    );
    currentUrl = effectResult.imageUrl;
    width = effectResult.width;
    height = effectResult.height;
  }

  // Step 2: Apply shader
  if (req.shader) {
    const shaderResult = await imageLabApplyShader(
      {
        imageUrl: currentUrl,
        shaderType: req.shader.shaderType,
        settings: req.shader.settings,
        format: req.format,
      },
      userId
    );
    currentUrl = shaderResult.imageUrl;
    width = shaderResult.width;
    height = shaderResult.height;
  }

  return { imageUrl: currentUrl, format: req.format || 'png', width, height };
}

export function imageLabListPresets(mode: string): Record<string, any> {
  switch (mode) {
    case 'halftone':
      return Object.fromEntries(
        Object.entries(HALFTONE_PRESETS).map(([k, v]) => [k, { ...HALFTONE_DEFAULTS, ...v }])
      );
    case 'texture':
      return TEXTURE_PRESETS;
    case 'riso':
      return RISO_FULL_PRESETS;
    case 'shader':
      return Object.fromEntries(
        SHADER_TYPES.map((t) => [t, { description: `${t} post-processing shader` }])
      );
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}
