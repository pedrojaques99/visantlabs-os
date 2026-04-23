import OpenAI from 'openai';
import type { Resolution, AspectRatio } from '../../src/types/types.js';
import {
  OPENAI_SIZE_MAP,
  OPENAI_QUALITY_MAP,
} from '../../src/constants/openaiModels.js';

export interface OpenAIImageInput {
  base64?: string;
  url?: string;
  mimeType?: string;
}

export interface GenerateOpenAIImageParams {
  prompt: string;
  /** Base image for image editing (i2i). When provided uses images.edit API */
  baseImage?: OpenAIImageInput | null;
  /** Additional reference images merged into the editing call (up to 16 total) */
  referenceImages?: (OpenAIImageInput | null)[];
  model?: string;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  /** OpenAI API key — user BYOK or system key */
  apiKey?: string;
}

export interface OpenAIImageResult {
  base64: string;
  revisedPrompt?: string;
}

function getClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!key) throw new Error('OpenAI API key is not configured');
  return new OpenAI({ apiKey: key });
}

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const byteString = Buffer.from(base64, 'base64');
  return new File([byteString], filename, { type: mimeType });
}

export async function generateOpenAIImage(params: GenerateOpenAIImageParams): Promise<OpenAIImageResult> {
  const {
    prompt,
    baseImage,
    referenceImages,
    model = 'gpt-image-2',
    resolution = '1K',
    apiKey,
  } = params;

  const client = getClient(apiKey);
  const size = OPENAI_SIZE_MAP[resolution] ?? '1024x1024';
  const quality = OPENAI_QUALITY_MAP[resolution] ?? 'medium';

  const hasBaseImage = !!(baseImage?.base64 || baseImage?.url);
  const hasReferenceImages = !!(referenceImages?.length && referenceImages.some(r => r?.base64));

  if (hasBaseImage || hasReferenceImages) {
    // Image editing mode — uses images.edit
    // IMPORTANT: reference images (e.g. brand logo) MUST be passed here so the model sees them.
    // If only referenceImages provided (no baseImage), they become the image[] input directly.
    const imageFiles: File[] = [];

    if (baseImage?.base64) {
      imageFiles.push(base64ToFile(baseImage.base64, baseImage.mimeType || 'image/png', 'base.png'));
    }

    // Add reference images (logo, brand assets) — up to 16 total per API limit
    if (referenceImages?.length) {
      for (const ref of referenceImages.slice(0, 16 - imageFiles.length)) {
        if (ref?.base64) {
          imageFiles.push(base64ToFile(ref.base64, ref.mimeType || 'image/png', `ref_${imageFiles.length}.png`));
        }
      }
    }

    const response = await client.images.edit({
      model,
      image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
      prompt,
      size: size as any,
      n: 1,
    });

    const result = response.data[0];
    if (!result?.b64_json) throw new Error('OpenAI image edit returned no image data');

    return {
      base64: result.b64_json,
      revisedPrompt: result.revised_prompt,
    };
  }

  // Text-to-image mode — uses images.generate (no reference images)
  const response = await client.images.generate({
    model,
    prompt,
    size: size as any,
    quality,
    n: 1,
  });

  const result = response.data[0];
  // gpt-image-1/2 return b64_json by default; fallback to url if needed
  const b64 = result?.b64_json;
  if (!b64) throw new Error('OpenAI image generation returned no image data');

  return {
    base64: b64,
    revisedPrompt: (result as any).revised_prompt,
  };
}
