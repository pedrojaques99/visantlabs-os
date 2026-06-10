import type { UploadedImage, AspectRatio } from '../../src/types/types.js';
import type { ReveModelId } from '../../src/constants/reveModels.js';
import { REVE_MODELS, resolveReveAspectRatio } from '../../src/constants/reveModels.js';
import { safeFetch } from '../utils/securityValidation.js';
import { withResilience } from '../lib/ai-resilience.js';

const REVE_BASE_URL = 'https://api.reve.com/v1';

// ── Shared types ────────────────────────────────────────────────────────────────

interface ReveGenerateOptions {
  prompt: string;
  model?: ReveModelId;
  aspectRatio?: AspectRatio;
  negativePrompt?: string;
  seed?: number;
  apiKey?: string;
}

interface ReveEditOptions {
  editInstruction: string;
  baseImage: UploadedImage;
  aspectRatio?: AspectRatio;
  version?: string;
  apiKey?: string;
}

interface ReveRemixOptions {
  prompt: string;
  referenceImages: UploadedImage[];
  aspectRatio?: AspectRatio;
  version?: string;
  apiKey?: string;
}

export interface ReveGenerateResult {
  base64: string;
  seed?: number;
  requestId?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function resolveApiKey(specificApiKey?: string): string {
  const apiKey = specificApiKey || process.env.REVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No REVE API key available. Configure REVE_API_KEY on the server or provide your own key.'
    );
  }
  return apiKey;
}

function resolveImageToBase64(image: UploadedImage): string {
  if (!image.base64) throw new Error('Image has no base64 data');
  if (image.base64.includes(',')) return image.base64.split(',')[1];
  return image.base64;
}

async function resolveImageToBase64Async(image: UploadedImage): Promise<string> {
  if (image.base64) return resolveImageToBase64(image);
  if (image.url) {
    const response = await safeFetch(image.url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  }
  throw new Error('Image has no base64 data or URL');
}

function handleReveError(response: Response, errorText: string, context: string): never {
  console.error(`[Reve] ${context} error status:`, response.status);
  console.error(`[Reve] ${context} error text:`, errorText);

  if (response.status === 401) {
    throw new Error('Invalid REVE API key. Please check your REVE_API_KEY.');
  }
  if (response.status === 402) {
    throw new Error('Insufficient REVE credits. Please top up your account at reve.com.');
  }
  if (response.status === 429) {
    throw new Error('REVE rate limit exceeded. Please try again shortly.');
  }
  throw new Error(`REVE API failed: ${response.status} - ${errorText}`);
}

function validateReveResponse(data: Record<string, unknown>, context: string): string {
  if (data.content_violation) {
    throw new Error('REVE flagged the content as a policy violation');
  }
  if (!data.image) {
    console.error(`[Reve] No image in ${context} response:`, JSON.stringify(data, null, 2));
    throw new Error(`No image data in REVE ${context} response`);
  }
  return data.image as string;
}

// ── Text-to-image ───────────────────────────────────────────────────────────────

export async function generateReveImage(options: ReveGenerateOptions): Promise<ReveGenerateResult> {
  const {
    prompt,
    model = REVE_MODELS.REVE_1,
    aspectRatio,
    negativePrompt,
    seed,
    apiKey: specificApiKey,
  } = options;

  const apiKey = resolveApiKey(specificApiKey);
  const reveAspect = resolveReveAspectRatio(aspectRatio);

  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: reveAspect,
  };

  if (negativePrompt) body.negative_prompt = negativePrompt;
  if (typeof seed === 'number' && seed >= 0) body.seed = seed;

  console.log(
    `[Reve] Generating: model=${model}, aspect=${reveAspect}, keySource=${
      specificApiKey ? 'user' : 'server'
    }`
  );

  return withResilience('reve', async () => {
    const response = await safeFetch(`${REVE_BASE_URL}/image/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      handleReveError(response, await response.text(), 'Generate');
    }

    const data = await response.json();
    const image = validateReveResponse(data, 'generation');

    console.log(
      `[Reve] Generation complete. requestId=${data.request_id ?? 'n/a'}, creditsUsed=${
        data.credits_used ?? 'n/a'
      }`
    );

    return { base64: image, seed: data.seed, requestId: data.request_id };
  });
}

// ── Image-to-image edit ─────────────────────────────────────────────────────────

export async function editReveImage(options: ReveEditOptions): Promise<ReveGenerateResult> {
  const {
    editInstruction,
    baseImage,
    aspectRatio,
    version = 'latest',
    apiKey: specificApiKey,
  } = options;

  const apiKey = resolveApiKey(specificApiKey);
  const referenceImageBase64 = await resolveImageToBase64Async(baseImage);

  const body: Record<string, unknown> = {
    edit_instruction: editInstruction,
    reference_image: referenceImageBase64,
    version,
  };

  if (aspectRatio) {
    body.aspect_ratio = resolveReveAspectRatio(aspectRatio);
  }

  console.log(
    `[Reve] Editing: version=${version}, aspect=${aspectRatio ?? 'auto'}, keySource=${
      specificApiKey ? 'user' : 'server'
    }`
  );

  return withResilience('reve', async () => {
    const response = await safeFetch(`${REVE_BASE_URL}/image/edit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      handleReveError(response, await response.text(), 'Edit');
    }

    const data = await response.json();
    const image = validateReveResponse(data, 'edit');

    console.log(
      `[Reve] Edit complete. requestId=${data.request_id ?? 'n/a'}, creditsUsed=${
        data.credits_used ?? 'n/a'
      }`
    );

    return { base64: image, requestId: data.request_id };
  });
}

// ── Multi-image remix ───────────────────────────────────────────────────────────

export async function remixReveImage(options: ReveRemixOptions): Promise<ReveGenerateResult> {
  const {
    prompt,
    referenceImages,
    aspectRatio,
    version = 'latest',
    apiKey: specificApiKey,
  } = options;

  const apiKey = resolveApiKey(specificApiKey);

  const resolvedImages: string[] = [];
  for (const img of referenceImages.slice(0, 6)) {
    try {
      resolvedImages.push(await resolveImageToBase64Async(img));
    } catch {
      // non-critical — skip failed images
    }
  }

  if (resolvedImages.length === 0) {
    throw new Error('No valid reference images for REVE remix');
  }

  const body: Record<string, unknown> = {
    prompt,
    reference_images: resolvedImages,
    version,
  };

  if (aspectRatio) {
    body.aspect_ratio = resolveReveAspectRatio(aspectRatio);
  }

  console.log(
    `[Reve] Remixing: version=${version}, images=${resolvedImages.length}, aspect=${
      aspectRatio ?? 'auto'
    }, keySource=${specificApiKey ? 'user' : 'server'}`
  );

  return withResilience('reve', async () => {
    const response = await safeFetch(`${REVE_BASE_URL}/image/remix`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      handleReveError(response, await response.text(), 'Remix');
    }

    const data = await response.json();
    const image = validateReveResponse(data, 'remix');

    console.log(
      `[Reve] Remix complete. requestId=${data.request_id ?? 'n/a'}, creditsUsed=${
        data.credits_used ?? 'n/a'
      }`
    );

    return { base64: image, requestId: data.request_id };
  });
}
