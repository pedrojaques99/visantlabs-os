import type { UploadedImage, AspectRatio, SeedreamModel, Resolution } from '../../src/types/types.js';
import {
    SEEDREAM_MODELS,
    SEEDREAM_MODEL_CONFIG,
    resolveSeedreamSize,
} from '../../src/constants/seedreamModels.js';
import { safeFetch } from '../utils/securityValidation.js';

// BytePlus official endpoint (synchronous API — no polling)
const BYTEPLUS_ENDPOINT = 'https://ark.ap-southeast-1.byteplusapi.com/api/v3/images/generations';

interface SeedreamGenerateOptions {
    prompt: string;
    baseImage?: UploadedImage;
    model?: SeedreamModel;
    resolution?: Resolution;
    aspectRatio?: AspectRatio;
    watermark?: boolean;
    apiKey?: string;
    /** Seed for deterministic generation [-1, 2147483647]. -1 = random. */
    seed?: number;
    /** Guidance scale [1–10] */
    guidanceScale?: number;
    /** Output format — only supported by seedream-5-0-lite */
    outputFormat?: 'png' | 'jpeg';
}

export interface SeedreamGenerateResult {
    base64: string;
    seed: number;
}

/**
 * Resolves image to base64 data URL format
 */
async function resolveImageBase64(image: UploadedImage): Promise<string> {
    let base64Data: string;

    if (image.base64 && image.base64.length > 0) {
        base64Data = image.base64;
    } else if (image.url) {
        const response = await safeFetch(image.url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        base64Data = Buffer.from(arrayBuffer).toString('base64');
    } else {
        throw new Error('Image has no base64 data or URL');
    }

    // Return with data URL prefix if not already present
    if (base64Data.startsWith('data:')) {
        return base64Data;
    }
    const mimeType = image.mimeType || 'image/jpeg';
    return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Generate image using Seedream via BytePlus official API (synchronous).
 * Falls back to server BYTEPLUS_API_KEY if no user key provided.
 */
export async function generateSeedreamImage(options: SeedreamGenerateOptions): Promise<SeedreamGenerateResult> {
    const {
        prompt,
        baseImage,
        model = SEEDREAM_MODELS.SD_4_5,
        resolution = '2K',
        aspectRatio,
        watermark = false,
        apiKey: specificApiKey,
        seed: userSeed,
        guidanceScale,
        outputFormat,
    } = options;

    const modelConfig = SEEDREAM_MODEL_CONFIG[model];
    if (!modelConfig) {
        throw new Error(`Unknown Seedream model: ${model}`);
    }

    // Validate image requirement
    if (modelConfig.requiresImage && !baseImage) {
        throw new Error(`Model ${model} requires an input image.`);
    }

    // Resolve seed — all models support seed per BytePlus docs
    const usedSeed = (typeof userSeed === 'number' && userSeed >= -1 && userSeed <= 2_147_483_647)
        ? userSeed
        : -1; // -1 = random

    // Use user BYOK first, then server key
    const apiKey = specificApiKey || process.env.BYTEPLUS_API_KEY;
    if (!apiKey) {
        throw new Error('No Seedream API key available. Configure BYTEPLUS_API_KEY on the server or provide your own key.');
    }

    // Resolve the size value for this model + resolution + aspect ratio
    const resolvedSize = modelConfig.adaptiveSize
        ? 'adaptive'
        : resolveSeedreamSize(model, resolution, aspectRatio);

    // Build request body — BytePlus format: model ID directly, no prefix
    const body: Record<string, unknown> = {
        model,
        prompt,
        watermark,
        response_format: 'b64_json',
    };

    // size param (not used for adaptive seededit)
    if (!modelConfig.adaptiveSize && resolvedSize) {
        body.size = resolvedSize;
    }

    // seed — supported by all models
    body.seed = usedSeed;

    // guidance_scale — supported by all models, value range [1, 10]
    const defaultScale = modelConfig.defaultGuidanceScale ?? 2.5;
    body.guidance_scale = (typeof guidanceScale === 'number' && guidanceScale >= 1 && guidanceScale <= 10)
        ? guidanceScale
        : defaultScale;

    // output_format — only for seedream-5-0-lite
    if (outputFormat) {
        body.output_format = outputFormat;
    }

    // Reference image(s) — passed as array of base64 data URLs
    if (baseImage) {
        const imageData = await resolveImageBase64(baseImage);
        body.image = [imageData];
    }

    console.log(`[Seedream] Generating: model=${model}, size=${resolvedSize ?? 'adaptive'}, seed=${usedSeed}, keySource=${specificApiKey ? 'user' : 'server'}`);

    const response = await safeFetch(BYTEPLUS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Seedream] API error status:', response.status);
        console.error('[Seedream] API error text:', errorText);

        try {
            const errorJson = JSON.parse(errorText);
            console.error('[Seedream] Full error details:', JSON.stringify(errorJson, null, 2));
        } catch (_) {
            // Ignore parse error
        }

        if (response.status === 401) {
            throw new Error('Invalid BytePlus API key. Please check your BYTEPLUS_API_KEY.');
        }
        if (response.status === 402) {
            throw new Error('Insufficient BytePlus credits. Please top up your account.');
        }

        throw new Error(`Seedream API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        console.error('[Seedream] No images in response:', JSON.stringify(data, null, 2));
        throw new Error('No images in Seedream response');
    }

    const base64 = data.data[0].b64_json;
    if (!base64) {
        throw new Error('No base64 data in Seedream response');
    }

    const finalSeed = usedSeed === -1 ? (data.seed ?? -1) : usedSeed;
    const usage = data.usage;
    console.log(`[Seedream] Generation complete. seed=${finalSeed}, tokens=${usage?.total_tokens ?? 'n/a'}`);

    return { base64, seed: finalSeed };
}
