/**
 * Inpainting Service
 *
 * Single source of truth for localized AI image editing with masks.
 * Select a region → describe what you want → AI replaces/generates only that area.
 *
 * Supports three modes:
 * - replace:  Fill masked area with new content described by prompt
 * - remove:   Erase masked area and fill with surrounding context
 * - retouch:  Subtle adjustments to masked area (color correction, cleanup)
 *
 * Engine: OpenAI GPT Image 2 (images.edit with mask).
 *
 * Used by: imagelab route, MCP tool, canvas ReactFlow, creative studio.
 */
import OpenAI from 'openai';
import { uploadImage } from './r2Service.js';
import type { Resolution, AspectRatio } from '../../src/types/types.js';
import { resolveOpenAISize, OPENAI_QUALITY_MAP } from '../../src/constants/openaiModels.js';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

// ── Types ──

export type InpaintMode = 'replace' | 'remove' | 'retouch';

export interface MaskRegion {
  /** Normalized 0-1 coordinates of the mask rectangle */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InpaintRequest {
  /** Source image URL or base64 data URL */
  imageUrl: string;
  /** What to do with the masked area */
  mode: InpaintMode;
  /** What to generate in the masked area (required for 'replace' mode) */
  prompt?: string;
  /** Mask as base64 PNG (transparent = edit, opaque = keep). Takes priority over maskRegion. */
  maskBase64?: string;
  /** Simple rectangular mask as normalized coordinates. Converted to PNG mask internally. */
  maskRegion?: MaskRegion;
  /** Output resolution tier */
  resolution?: Resolution;
  /** Target aspect ratio */
  aspectRatio?: AspectRatio;
  /** OpenAI API key (BYOK) */
  apiKey?: string;
}

export interface InpaintResult {
  /** Public R2 URL of the result */
  imageUrl: string;
  /** Base64 of the result (for immediate display) */
  base64: string;
  /** Revised prompt from the model */
  revisedPrompt?: string;
  /** Mode that was applied */
  mode: InpaintMode;
}

import { validateImageUrl } from '../utils/validateImageUrl.js';

// ── Image helpers ──

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  validateImageUrl(imageUrl);

  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URL format.');
    return { base64: match[2], mimeType: match[1] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES)
      throw new Error(`Image too large (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    const mimeType = res.headers.get('content-type') || 'image/png';
    return { base64: buf.toString('base64'), mimeType };
  } finally {
    clearTimeout(timer);
  }
}

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const byteString = Buffer.from(base64, 'base64');
  return new File([byteString], filename, { type: mimeType });
}

// ── Mask generation from region ──

async function generateMaskFromRegion(imageBase64: string, region: MaskRegion): Promise<string> {
  const imgBuf = Buffer.from(imageBase64, 'base64');
  const dims = probeImageDimensions(imgBuf);

  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(dims.width, dims.height);
  const ctx = canvas.getContext('2d');

  // Fill entire canvas with black (opaque = keep)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, dims.width, dims.height);

  // Draw transparent rectangle where the mask region is (transparent = edit)
  const rx = Math.round(region.x * dims.width);
  const ry = Math.round(region.y * dims.height);
  const rw = Math.round(region.width * dims.width);
  const rh = Math.round(region.height * dims.height);

  ctx.clearRect(rx, ry, rw, rh);

  const pngBuffer = canvas.toBuffer('image/png');
  return pngBuffer.toString('base64');
}

// ── Prompt engineering per mode ──

function buildInpaintPrompt(mode: InpaintMode, userPrompt?: string): string {
  switch (mode) {
    case 'replace':
      if (!userPrompt?.trim()) throw new Error('Prompt is required for replace mode.');
      return `Replace the masked area with: ${userPrompt.trim()}. Match the surrounding style, lighting, perspective, and color palette seamlessly.`;

    case 'remove':
      return [
        'Remove the object/content in the masked area.',
        'Fill it naturally with the surrounding background — match texture, lighting, and perspective.',
        'The result should look as if the removed content was never there.',
        userPrompt?.trim() ? `Context: ${userPrompt.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' ');

    case 'retouch':
      return [
        'Subtly improve the masked area.',
        'Clean up imperfections, smooth skin, correct colors, or enhance details.',
        'Keep the overall composition and content identical — only refine quality.',
        userPrompt?.trim() ? `Specific adjustments: ${userPrompt.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' ');
  }
}

// ── Main service ──

export async function inpaint(req: InpaintRequest, userId: string): Promise<InpaintResult> {
  if (!req.maskBase64 && !req.maskRegion) {
    throw new Error('Either maskBase64 or maskRegion is required.');
  }

  const { base64: imageBase64, mimeType } = await fetchImageAsBase64(req.imageUrl);
  const prompt = buildInpaintPrompt(req.mode, req.prompt);

  // Resolve mask
  let maskBase64: string;
  if (req.maskBase64) {
    maskBase64 = req.maskBase64.replace(/^data:image\/\w+;base64,/, '');
  } else {
    maskBase64 = await generateMaskFromRegion(imageBase64, req.maskRegion!);
  }

  // Convert frontend mask format (white-on-transparent) to OpenAI format (transparent-on-opaque)
  // Frontend: white pixels = edit area, transparent = keep
  // OpenAI: transparent pixels = edit area, opaque = keep
  const { createCanvas: mkCanvas, loadImage: ldImage } = await import('@napi-rs/canvas');
  const maskBuf = Buffer.from(maskBase64, 'base64');
  const maskImg = await ldImage(maskBuf);
  const maskCanvas = mkCanvas(maskImg.width, maskImg.height);
  const maskCtx = maskCanvas.getContext('2d');

  // Fill with black (opaque = keep)
  maskCtx.fillStyle = '#000000';
  maskCtx.fillRect(0, 0, maskImg.width, maskImg.height);

  // Draw the mask image — where it's white, we need transparent
  maskCtx.globalCompositeOperation = 'destination-out';
  maskCtx.drawImage(maskImg, 0, 0);
  maskCtx.globalCompositeOperation = 'source-over';

  // Export corrected mask
  const correctedMaskBase64 = maskCanvas
    .toDataURL('image/png')
    .replace(/^data:image\/png;base64,/, '');

  // Apply feather (gaussian blur) to mask edges for seamless blending
  // Use canvas filter if available, otherwise skip
  const featherCanvas = mkCanvas(maskImg.width, maskImg.height);
  const featherCtx = featherCanvas.getContext('2d');
  const correctedMaskImg = await ldImage(Buffer.from(correctedMaskBase64, 'base64'));

  // @napi-rs/canvas supports CSS filter
  (featherCtx as any).filter = 'blur(3px)';
  featherCtx.drawImage(correctedMaskImg, 0, 0);
  (featherCtx as any).filter = 'none';

  const featheredMaskBase64 = featherCanvas
    .toDataURL('image/png')
    .replace(/^data:image\/png;base64,/, '');

  const key = req.apiKey || process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!key) throw new Error('OpenAI API key is not configured');
  const client = new OpenAI({ apiKey: key });

  const imageFile = base64ToFile(imageBase64, mimeType, 'image.png');
  const maskFile = base64ToFile(featheredMaskBase64, 'image/png', 'mask.png');

  const size = resolveOpenAISize(req.resolution || '1K', req.aspectRatio);
  const quality = OPENAI_QUALITY_MAP[req.resolution || '1K'] ?? 'medium';

  const response = await client.images.edit({
    model: 'gpt-image-2',
    image: imageFile,
    mask: maskFile,
    prompt,
    size: size as any,
    quality,
    n: 1,
  });

  const result = response.data?.[0];
  if (!result?.b64_json) throw new Error('Inpainting returned no image data.');

  const dataUrl = `data:image/png;base64,${result.b64_json}`;
  const publicUrl = await uploadImage(dataUrl, userId);

  return {
    imageUrl: publicUrl,
    base64: result.b64_json,
    revisedPrompt: result.revised_prompt,
    mode: req.mode,
  };
}

import { probeImageDimensions } from '../utils/probeImageDimensions.js';
