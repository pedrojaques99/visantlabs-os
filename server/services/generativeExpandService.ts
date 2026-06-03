/**
 * Generative Expand Service (Outpainting)
 *
 * Single source of truth for AI-powered image expansion.
 * Expands an image in any direction by generating new content that
 * seamlessly continues the original composition.
 *
 * Used by: imagelab route, MCP tool, canvas ReactFlow, creative studio.
 *
 * Engine: OpenAI GPT Image 2 (images.edit) — best quality for photographic outpainting.
 */
import { uploadImage } from './r2Service.js';
import type { Resolution, AspectRatio } from '../../src/types/types.js';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

// ── Types ──

export type ExpandDirection = 'up' | 'down' | 'left' | 'right' | 'all';

export interface ExpandAnchor {
  /** Horizontal origin of the original image in the expanded canvas. 0 = left, 1 = right */
  x: number;
  /** Vertical origin of the original image in the expanded canvas. 0 = top, 1 = bottom */
  y: number;
}

export interface GenerativeExpandRequest {
  /** Source image URL or base64 data URL */
  imageUrl: string;
  /** Expansion direction shortcut — sets anchor automatically */
  direction?: ExpandDirection;
  /** Fine-grained anchor override (0-1 normalized). Overrides direction if both provided. */
  anchor?: ExpandAnchor;
  /** Target aspect ratio for the expanded image */
  targetAspectRatio?: AspectRatio;
  /** Expansion factor: 1.5 = 50% larger on the expanded axis. Default 1.5 */
  expandFactor?: number;
  /** Optional prompt to guide what the AI generates in the expanded area */
  prompt?: string;
  /** Output resolution tier */
  resolution?: Resolution;
  /** OpenAI API key (BYOK) */
  apiKey?: string;
}

export interface GenerativeExpandResult {
  /** Public R2 URL of the expanded image */
  imageUrl: string;
  /** Base64 of the expanded image (for immediate display) */
  base64: string;
  /** Revised prompt from the model */
  revisedPrompt?: string;
  /** Final canvas dimensions */
  width: number;
  height: number;
  /** Original image dimensions */
  originalWidth: number;
  originalHeight: number;
}

import { validateImageUrl } from '../utils/validateImageUrl.js';

// ── Image loading ──

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

// ── Anchor resolution ──

const DIRECTION_ANCHORS: Record<ExpandDirection, ExpandAnchor> = {
  up: { x: 0.5, y: 1 },
  down: { x: 0.5, y: 0 },
  left: { x: 1, y: 0.5 },
  right: { x: 0, y: 0.5 },
  all: { x: 0.5, y: 0.5 },
};

function resolveAnchor(direction?: ExpandDirection, anchor?: ExpandAnchor): ExpandAnchor {
  if (anchor) return anchor;
  return DIRECTION_ANCHORS[direction || 'all'];
}

// ── Prompt engineering ──

function buildExpandPrompt(direction: ExpandDirection | undefined, userPrompt?: string): string {
  const directionHint =
    direction && direction !== 'all'
      ? `The image is being expanded ${direction}ward.`
      : 'The image is being expanded outward in all directions.';

  const base = [
    'Seamlessly extend this image beyond its current boundaries.',
    directionHint,
    'Continue the scene naturally — match the lighting, perspective, color palette, depth of field, and style exactly.',
    'The transition from original to generated content must be invisible.',
    'Do not alter, crop, or recompose the original image content.',
  ].join(' ');

  if (userPrompt?.trim()) {
    return `${base} Additional context: ${userPrompt.trim()}`;
  }
  return base;
}

// ── Main service ──

export async function generativeExpand(
  req: GenerativeExpandRequest,
  userId: string
): Promise<GenerativeExpandResult> {
  const { base64, mimeType } = await fetchImageAsBase64(req.imageUrl);

  const factor = Math.max(1.1, Math.min(req.expandFactor || 1.5, 3));
  const anchor = resolveAnchor(req.direction, req.anchor);
  const prompt = buildExpandPrompt(req.direction, req.prompt);

  // Decode image to get dimensions via a lightweight probe
  const imgBuf = Buffer.from(base64, 'base64');
  const dimensions = probeImageDimensions(imgBuf);
  const originalWidth = dimensions.width;
  const originalHeight = dimensions.height;

  // Calculate expanded canvas based on direction
  let canvasWidth: number;
  let canvasHeight: number;

  if (req.direction === 'left' || req.direction === 'right') {
    canvasWidth = Math.round(originalWidth * factor);
    canvasHeight = originalHeight;
  } else if (req.direction === 'up' || req.direction === 'down') {
    canvasWidth = originalWidth;
    canvasHeight = Math.round(originalHeight * factor);
  } else {
    canvasWidth = Math.round(originalWidth * factor);
    canvasHeight = Math.round(originalHeight * factor);
  }

  // Composite: place original image on expanded canvas, transparent areas = mask
  const { createCanvas, loadImage: loadCanvasImage } = await import('@napi-rs/canvas');

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Canvas starts fully transparent — the transparent areas become the mask
  const sourceImg = await loadCanvasImage(imgBuf);

  // Place original at anchor position
  const offsetX = Math.round(anchor.x * (canvasWidth - originalWidth));
  const offsetY = Math.round(anchor.y * (canvasHeight - originalHeight));
  ctx.drawImage(sourceImg, offsetX, offsetY, originalWidth, originalHeight);

  // Export composited image as PNG
  const compositedBase64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

  // Create mask: black where original is, transparent where to generate
  const maskCanvas = createCanvas(canvasWidth, canvasHeight);
  const maskCtx = maskCanvas.getContext('2d');
  // Fill everything transparent (= area to generate)
  // Then fill the original image area with black (= area to keep)
  maskCtx.fillStyle = '#000000';
  maskCtx.fillRect(offsetX, offsetY, originalWidth, originalHeight);
  const maskBase64 = maskCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

  // Call OpenAI images.edit with image + mask
  const OpenAI = (await import('openai')).default;
  const apiKey = req.apiKey || process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) throw new Error('OpenAI API key is not configured');
  const client = new OpenAI({ apiKey });

  function base64ToFile(b64: string, mime: string, name: string): File {
    const buf = Buffer.from(b64, 'base64');
    return new File([buf], name, { type: mime });
  }

  const imageFile = base64ToFile(compositedBase64, 'image/png', 'image.png');
  const maskFile = base64ToFile(maskBase64, 'image/png', 'mask.png');

  const size = (await import('../../src/constants/openaiModels.js')).resolveOpenAISize(
    req.resolution || '1K',
    req.targetAspectRatio
  );
  const quality =
    (await import('../../src/constants/openaiModels.js')).OPENAI_QUALITY_MAP[
      req.resolution || '1K'
    ] ?? 'medium';

  const response = await client.images.edit({
    model: 'gpt-image-2',
    image: imageFile,
    mask: maskFile,
    prompt,
    size: size as any,
    quality,
    n: 1,
  });

  const resultData = response.data?.[0];
  if (!resultData?.b64_json) throw new Error('Generative expand returned no image data.');

  const resultDataUrl = `data:image/png;base64,${resultData.b64_json}`;
  const publicUrl = await uploadImage(resultDataUrl, userId);

  return {
    imageUrl: publicUrl,
    base64: resultData.b64_json,
    revisedPrompt: resultData.revised_prompt,
    width: canvasWidth,
    height: canvasHeight,
    originalWidth,
    originalHeight,
  };
}

// ── Lightweight image dimension probe (PNG/JPEG header) ──

import { probeImageDimensions } from '../utils/probeImageDimensions.js';
