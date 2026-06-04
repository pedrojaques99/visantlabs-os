import type { AspectRatio, Resolution } from '../../src/types/types.js';
import type { IdeogramModelId, IdeogramRenderingSpeed } from '../../src/constants/ideogramModels.js';
import { IDEOGRAM_MODELS, resolveIdeogramAspectRatio } from '../../src/constants/ideogramModels.js';
import { safeFetch } from '../utils/securityValidation.js';

const IDEOGRAM_BASE_URL = 'https://api.ideogram.ai';

interface IdeogramGenerateOptions {
  prompt: string;
  model?: IdeogramModelId;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  renderingSpeed?: IdeogramRenderingSpeed;
  magicPrompt?: 'AUTO' | 'ON' | 'OFF';
  negativePrompt?: string;
  styleType?: string;
  seed?: number;
  apiKey?: string;
}

export interface IdeogramGenerateResult {
  base64: string;
  seed?: number;
  resolution?: string;
}

/**
 * Download an image URL and return it as base64.
 * Ideogram returns temporary URLs that expire, so we must download immediately.
 */
async function downloadImageAsBase64(url: string): Promise<string> {
  const response = await safeFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download Ideogram image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

/**
 * Generate image using Ideogram API.
 * Supports V3 and V4 models via their respective endpoints.
 */
export async function generateIdeogramImage(
  options: IdeogramGenerateOptions
): Promise<IdeogramGenerateResult> {
  const {
    prompt,
    model = IDEOGRAM_MODELS.V4,
    aspectRatio,
    renderingSpeed = 'DEFAULT',
    magicPrompt = 'AUTO',
    negativePrompt,
    styleType,
    seed,
    apiKey: specificApiKey,
  } = options;

  const apiKey = specificApiKey || process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No Ideogram API key available. Configure IDEOGRAM_API_KEY on the server or provide your own key.'
    );
  }

  const ideogramAspect = resolveIdeogramAspectRatio(aspectRatio);

  // Build endpoint and body based on model version
  let endpoint: string;
  const body: Record<string, unknown> = {};

  if (model === IDEOGRAM_MODELS.V4) {
    endpoint = `${IDEOGRAM_BASE_URL}/v1/ideogram-v4/generate`;
    body.text_prompt = prompt;
    body.rendering_speed = renderingSpeed;
    body.num_images = 1;
    if (aspectRatio) body.aspect_ratio = ideogramAspect;
    if (typeof seed === 'number') body.seed = seed;
  } else {
    // V3
    endpoint = `${IDEOGRAM_BASE_URL}/v1/ideogram-v3/generate`;
    body.prompt = prompt;
    body.rendering_speed = renderingSpeed;
    body.magic_prompt = magicPrompt;
    body.num_images = 1;
    if (aspectRatio) body.aspect_ratio = ideogramAspect;
    if (negativePrompt) body.negative_prompt = negativePrompt;
    if (styleType) body.style_type = styleType;
    if (typeof seed === 'number') body.seed = seed;
  }

  console.log(
    `[Ideogram] Generating: model=${model}, speed=${renderingSpeed}, aspect=${ideogramAspect}, keySource=${specificApiKey ? 'user' : 'server'}`
  );

  const response = await safeFetch(endpoint, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Ideogram] API error status:', response.status);
    console.error('[Ideogram] API error text:', errorText);

    if (response.status === 401) {
      throw new Error('Invalid Ideogram API key. Please check your IDEOGRAM_API_KEY.');
    }
    if (response.status === 402) {
      throw new Error('Insufficient Ideogram credits. Please top up your account at ideogram.ai.');
    }
    if (response.status === 422) {
      throw new Error(`Ideogram safety filter triggered: ${errorText}`);
    }
    if (response.status === 429) {
      throw new Error('Ideogram rate limit exceeded. Maximum 10 concurrent requests.');
    }

    throw new Error(`Ideogram API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.data || data.data.length === 0) {
    console.error('[Ideogram] No images in response:', JSON.stringify(data, null, 2));
    throw new Error('No images in Ideogram response');
  }

  const imageData = data.data[0];

  if (!imageData.url) {
    if (!imageData.is_image_safe) {
      throw new Error('Ideogram flagged the generated image as unsafe');
    }
    throw new Error('No image URL in Ideogram response');
  }

  // Download the temporary URL to base64 (URLs expire)
  const base64 = await downloadImageAsBase64(imageData.url);

  console.log(
    `[Ideogram] Generation complete. seed=${imageData.seed ?? 'n/a'}, resolution=${imageData.resolution ?? 'n/a'}`
  );

  return {
    base64,
    seed: imageData.seed,
    resolution: imageData.resolution,
  };
}
