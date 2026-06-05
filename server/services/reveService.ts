import type { AspectRatio } from '../../src/types/types.js';
import type { ReveModelId } from '../../src/constants/reveModels.js';
import { REVE_MODELS, resolveReveAspectRatio } from '../../src/constants/reveModels.js';
import { safeFetch } from '../utils/securityValidation.js';
import { withResilience } from '../lib/ai-resilience.js';

const REVE_BASE_URL = 'https://api.reve.art/v1';

interface ReveGenerateOptions {
  prompt: string;
  model?: ReveModelId;
  aspectRatio?: AspectRatio;
  negativePrompt?: string;
  seed?: number;
  apiKey?: string;
}

export interface ReveGenerateResult {
  base64: string;
  seed?: number;
  requestId?: string;
}

/**
 * Generate image using REVE API (text-to-image).
 * Returns base64 directly (no URL download needed).
 */
export async function generateReveImage(options: ReveGenerateOptions): Promise<ReveGenerateResult> {
  const {
    prompt,
    model = REVE_MODELS.REVE_1,
    aspectRatio,
    negativePrompt,
    seed,
    apiKey: specificApiKey,
  } = options;

  const apiKey = specificApiKey || process.env.REVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No REVE API key available. Configure REVE_API_KEY on the server or provide your own key.'
    );
  }

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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Reve] API error status:', response.status);
      console.error('[Reve] API error text:', errorText);

      if (response.status === 401) {
        throw new Error('Invalid REVE API key. Please check your REVE_API_KEY.');
      }
      if (response.status === 402) {
        throw new Error('Insufficient REVE credits. Please top up your account at reve.art.');
      }
      if (response.status === 429) {
        throw new Error('REVE rate limit exceeded. Please try again shortly.');
      }

      throw new Error(`REVE API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.content_violation) {
      throw new Error('REVE flagged the content as a policy violation');
    }

    if (!data.image) {
      console.error('[Reve] No image in response:', JSON.stringify(data, null, 2));
      throw new Error('No image data in REVE response');
    }

    console.log(
      `[Reve] Generation complete. requestId=${data.request_id ?? 'n/a'}, creditsUsed=${
        data.credits_used ?? 'n/a'
      }`
    );

    return {
      base64: data.image,
      seed: data.seed,
      requestId: data.request_id,
    };
  });
}
