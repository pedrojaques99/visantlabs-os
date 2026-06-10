import type { UploadedImage, AspectRatio, Resolution } from '../../src/types/types.js';
import type {
  IdeogramModelId,
  IdeogramRenderingSpeed,
} from '../../src/constants/ideogramModels.js';
import { IDEOGRAM_MODELS, resolveIdeogramAspectRatio } from '../../src/constants/ideogramModels.js';
import { safeFetch } from '../utils/securityValidation.js';
import { withResilience } from '../lib/ai-resilience.js';

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
  referenceImages?: UploadedImage[];
}

interface IdeogramRemixOptions {
  prompt: string;
  baseImage: UploadedImage;
  referenceImages?: UploadedImage[];
  imageWeight?: number;
  aspectRatio?: AspectRatio;
  renderingSpeed?: IdeogramRenderingSpeed;
  magicPrompt?: 'AUTO' | 'ON' | 'OFF';
  negativePrompt?: string;
  styleType?: string;
  seed?: number;
  apiKey?: string;
}

interface IdeogramEditOptions {
  prompt: string;
  baseImage: UploadedImage;
  mask?: UploadedImage;
  renderingSpeed?: IdeogramRenderingSpeed;
  magicPrompt?: 'AUTO' | 'ON' | 'OFF';
  styleType?: string;
  seed?: number;
  apiKey?: string;
}

export interface IdeogramGenerateResult {
  base64: string;
  seed?: number;
  resolution?: string;
}

async function downloadImageAsBase64(url: string): Promise<string> {
  const response = await safeFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download Ideogram image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

async function resolveImageToBuffer(image: UploadedImage): Promise<Buffer> {
  if (image.base64) {
    const raw = image.base64.includes(',') ? image.base64.split(',')[1] : image.base64;
    return Buffer.from(raw, 'base64');
  }
  if (image.url) {
    const response = await safeFetch(image.url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error('Image has no base64 data or URL');
}

function getMimeType(image: UploadedImage): string {
  if (image.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) {
    return image.mimeType;
  }
  return 'image/png';
}

function getExtension(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

function resolveApiKey(specificApiKey?: string): string {
  const apiKey = specificApiKey || process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No Ideogram API key available. Configure IDEOGRAM_API_KEY on the server or provide your own key.'
    );
  }
  return apiKey;
}

function parseIdeogramResponse(data: Record<string, unknown>): {
  url: string;
  seed?: number;
  resolution?: string;
} {
  const dataArray = data.data as Array<Record<string, unknown>> | undefined;
  if (!dataArray || dataArray.length === 0) {
    throw new Error('No images in Ideogram response');
  }
  const imageData = dataArray[0];
  if (!imageData.url) {
    if (!imageData.is_image_safe) {
      throw new Error('Ideogram flagged the generated image as unsafe');
    }
    throw new Error('No image URL in Ideogram response');
  }
  return {
    url: imageData.url as string,
    seed: imageData.seed as number | undefined,
    resolution: imageData.resolution as string | undefined,
  };
}

function handleIdeogramError(response: Response, errorText: string): never {
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

/**
 * Generate image using Ideogram API (text-to-image).
 * Supports V3 and V4 models via their respective endpoints.
 * V3 with referenceImages uses multipart/form-data with character_reference_images.
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
    referenceImages,
  } = options;

  const apiKey = resolveApiKey(specificApiKey);
  const ideogramAspect = resolveIdeogramAspectRatio(aspectRatio);
  const hasRefs = !!referenceImages?.length;

  // V3 + referenceImages → multipart with character_reference_images
  if (model !== IDEOGRAM_MODELS.V4 && hasRefs) {
    const endpoint = `${IDEOGRAM_BASE_URL}/v1/ideogram-v3/generate`;

    console.log(
      `[Ideogram] Generating with refs: model=${model}, speed=${renderingSpeed}, aspect=${ideogramAspect}, refs=${
        referenceImages!.length
      }, keySource=${specificApiKey ? 'user' : 'server'}`
    );

    return withResilience('ideogram', async () => {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('rendering_speed', renderingSpeed);
      formData.append('magic_prompt', magicPrompt);
      formData.append('num_images', '1');
      if (aspectRatio) formData.append('aspect_ratio', ideogramAspect);
      if (negativePrompt) formData.append('negative_prompt', negativePrompt);
      if (styleType) formData.append('style_type', styleType);
      if (typeof seed === 'number') formData.append('seed', String(seed));

      for (const ref of referenceImages!.slice(0, 4)) {
        try {
          const refBuffer = await resolveImageToBuffer(ref);
          const refMime = getMimeType(ref);
          formData.append(
            'character_reference_images',
            new Blob([refBuffer], { type: refMime }),
            `ref.${getExtension(refMime)}`
          );
        } catch {
          // non-critical
        }
      }

      const response = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Api-Key': apiKey },
        body: formData,
      });

      if (!response.ok) {
        handleIdeogramError(response, await response.text());
      }

      const data = await response.json();
      const parsed = parseIdeogramResponse(data);
      const base64 = await downloadImageAsBase64(parsed.url);

      console.log(
        `[Ideogram] Generation with refs complete. seed=${parsed.seed ?? 'n/a'}, resolution=${
          parsed.resolution ?? 'n/a'
        }`
      );

      return { base64, seed: parsed.seed, resolution: parsed.resolution };
    });
  }

  // Standard JSON text-to-image (V4 or V3 without refs)
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
    `[Ideogram] Generating: model=${model}, speed=${renderingSpeed}, aspect=${ideogramAspect}, keySource=${
      specificApiKey ? 'user' : 'server'
    }`
  );

  return withResilience('ideogram', async () => {
    const response = await safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      handleIdeogramError(response, await response.text());
    }

    const data = await response.json();
    const parsed = parseIdeogramResponse(data);
    const base64 = await downloadImageAsBase64(parsed.url);

    console.log(
      `[Ideogram] Generation complete. seed=${parsed.seed ?? 'n/a'}, resolution=${
        parsed.resolution ?? 'n/a'
      }`
    );

    return { base64, seed: parsed.seed, resolution: parsed.resolution };
  });
}

/**
 * Remix an image using Ideogram V3 API (multipart/form-data).
 * V4 does not support remix — callers should fall back to V3.
 */
export async function remixIdeogramImage(
  options: IdeogramRemixOptions
): Promise<IdeogramGenerateResult> {
  const {
    prompt,
    baseImage,
    referenceImages,
    imageWeight = 50,
    aspectRatio,
    renderingSpeed = 'DEFAULT',
    magicPrompt = 'AUTO',
    negativePrompt,
    styleType,
    seed,
    apiKey: specificApiKey,
  } = options;

  const apiKey = resolveApiKey(specificApiKey);
  const ideogramAspect = resolveIdeogramAspectRatio(aspectRatio);
  const endpoint = `${IDEOGRAM_BASE_URL}/v1/ideogram-v3/remix`;

  console.log(
    `[Ideogram] Remixing: aspect=${ideogramAspect}, weight=${imageWeight}, refs=${
      referenceImages?.length ?? 0
    }, keySource=${specificApiKey ? 'user' : 'server'}`
  );

  return withResilience('ideogram', async () => {
    const formData = new FormData();

    const imageBuffer = await resolveImageToBuffer(baseImage);
    const mime = getMimeType(baseImage);
    formData.append(
      'image',
      new Blob([imageBuffer], { type: mime }),
      `input.${getExtension(mime)}`
    );

    formData.append('prompt', prompt);
    formData.append('image_weight', String(imageWeight));
    formData.append('rendering_speed', renderingSpeed);
    formData.append('magic_prompt', magicPrompt);
    formData.append('num_images', '1');
    if (aspectRatio) formData.append('aspect_ratio', ideogramAspect);
    if (negativePrompt) formData.append('negative_prompt', negativePrompt);
    if (styleType) formData.append('style_type', styleType);
    if (typeof seed === 'number') formData.append('seed', String(seed));

    if (referenceImages?.length) {
      for (const ref of referenceImages.slice(0, 4)) {
        try {
          const refBuffer = await resolveImageToBuffer(ref);
          const refMime = getMimeType(ref);
          formData.append(
            'character_reference_images',
            new Blob([refBuffer], { type: refMime }),
            `ref.${getExtension(refMime)}`
          );
        } catch {
          // non-critical — skip failed ref images
        }
      }
    }

    const response = await safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Api-Key': apiKey },
      body: formData,
    });

    if (!response.ok) {
      handleIdeogramError(response, await response.text());
    }

    const data = await response.json();
    const parsed = parseIdeogramResponse(data);
    const base64 = await downloadImageAsBase64(parsed.url);

    console.log(
      `[Ideogram] Remix complete. seed=${parsed.seed ?? 'n/a'}, resolution=${
        parsed.resolution ?? 'n/a'
      }`
    );

    return { base64, seed: parsed.seed, resolution: parsed.resolution };
  });
}

/**
 * Edit an image using Ideogram V3 API (multipart/form-data).
 * Requires a base image; mask is optional (edits the masked area).
 */
export async function editIdeogramImage(
  options: IdeogramEditOptions
): Promise<IdeogramGenerateResult> {
  const {
    prompt,
    baseImage,
    mask,
    renderingSpeed = 'DEFAULT',
    magicPrompt = 'AUTO',
    styleType,
    seed,
    apiKey: specificApiKey,
  } = options;

  const apiKey = resolveApiKey(specificApiKey);
  const endpoint = `${IDEOGRAM_BASE_URL}/v1/ideogram-v3/edit`;

  console.log(
    `[Ideogram] Editing: hasMask=${!!mask}, keySource=${specificApiKey ? 'user' : 'server'}`
  );

  return withResilience('ideogram', async () => {
    const formData = new FormData();

    const imageBuffer = await resolveImageToBuffer(baseImage);
    const mime = getMimeType(baseImage);
    formData.append(
      'image',
      new Blob([imageBuffer], { type: mime }),
      `input.${getExtension(mime)}`
    );

    if (mask) {
      const maskBuffer = await resolveImageToBuffer(mask);
      const maskMime = getMimeType(mask);
      formData.append(
        'mask',
        new Blob([maskBuffer], { type: maskMime }),
        `mask.${getExtension(maskMime)}`
      );
    }

    formData.append('prompt', prompt);
    formData.append('rendering_speed', renderingSpeed);
    formData.append('magic_prompt', magicPrompt);
    formData.append('num_images', '1');
    if (styleType) formData.append('style_type', styleType);
    if (typeof seed === 'number') formData.append('seed', String(seed));

    const response = await safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Api-Key': apiKey },
      body: formData,
    });

    if (!response.ok) {
      handleIdeogramError(response, await response.text());
    }

    const data = await response.json();
    const parsed = parseIdeogramResponse(data);
    const base64 = await downloadImageAsBase64(parsed.url);

    console.log(`[Ideogram] Edit complete. seed=${parsed.seed ?? 'n/a'}`);

    return { base64, seed: parsed.seed, resolution: parsed.resolution };
  });
}
