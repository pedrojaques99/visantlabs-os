import type { UploadedImage, AspectRatio, SeedreamModel, Resolution } from '../../src/types/types.js';
import {
    SEEDREAM_MODELS,
    SEEDREAM_MODEL_CONFIG,
    resolveSeedreamSize,
    seedreamSupportsSeed,
    seedreamSupportsGuidanceScale,
    seedreamRequiresImage,
} from '../../src/constants/seedreamModels.js';
import { safeFetch } from '../utils/securityValidation.js';

// APIFree.ai endpoints (async API with submit→poll pattern)
const APIFREE_BASE = 'https://api.apifree.ai';
const SUBMIT_ENDPOINT = `${APIFREE_BASE}/v1/image/submit`;
const RESULT_ENDPOINT = (requestId: string) => `${APIFREE_BASE}/v1/image/${requestId}/result`;

// Polling configuration
const POLL_INTERVAL_MS = 2000; // 2 seconds between polls
const MAX_POLL_ATTEMPTS = 60; // Max 2 minutes of polling

interface SeedreamGenerateOptions {
    prompt: string;
    baseImage?: UploadedImage;
    model?: SeedreamModel;
    resolution?: Resolution;
    aspectRatio?: AspectRatio;
    watermark?: boolean;
    apiKey?: string;
    /** Seed for deterministic generation — only supported by seedream-3.0-t2i and seededit-3.0-i2i */
    seed?: number;
    /** Guidance scale [1–10] — only supported by seedream-3.0-t2i and seededit-3.0-i2i */
    guidanceScale?: number;
}

export interface SeedreamGenerateResult {
    base64: string;
    seed: number;
}

/**
 * Resolves image to base64 format with data URL prefix
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
 * Generate image using Seedream via APIFree.ai (async API)
 * Falls back to server APIFREE_API_KEY if no user key provided
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
    } = options;

    const modelConfig = SEEDREAM_MODEL_CONFIG[model];
    if (!modelConfig) {
        throw new Error(`Unknown Seedream model: ${model}`);
    }

    // Validate image requirement
    if (modelConfig.requiresImage && !baseImage) {
        throw new Error(`Model ${model} requires an input image.`);
    }

    // Resolve seed — only for models that support it per official docs
    const supportsSeed = seedreamSupportsSeed(model);
    const usedSeed = supportsSeed
        ? (typeof userSeed === 'number' && userSeed >= 0 && userSeed <= 2_147_483_647)
            ? userSeed
            : Math.floor(Math.random() * 2_147_483_647)
        : -1; // -1 = not used

    // Use user BYOK first, then server key
    const apiKey = specificApiKey || process.env.APIFREE_API_KEY;
    if (!apiKey) {
        throw new Error('No Seedream API key available. Configure APIFREE_API_KEY on the server or provide your own key.');
    }

    // Resolve the size value for this model + resolution + aspect ratio
    const resolvedSize = modelConfig.adaptiveSize
        ? 'adaptive'
        : resolveSeedreamSize(model, resolution, aspectRatio);

    // Build request body — APIFree.ai format: bytedance/<model>
    const body: Record<string, unknown> = {
        model: `bytedance/${model}`,
        prompt,
        watermark,
    };

    // size param (not used for adaptive seededit)
    if (!modelConfig.adaptiveSize && resolvedSize) {
        body.size = resolvedSize;
    }

    // seed — only seedream-3.0-t2i and seededit-3.0-i2i
    if (supportsSeed) {
        body.seed = usedSeed;
    }

    // guidance_scale — only 3.0 models, value range [1, 10]
    if (seedreamSupportsGuidanceScale(model)) {
        const defaultScale = modelConfig.defaultGuidanceScale ?? 2.5;
        body.guidance_scale = (typeof guidanceScale === 'number' && guidanceScale >= 1 && guidanceScale <= 10)
            ? guidanceScale
            : defaultScale;
    }

    // Reference image (img2img or multi-ref for 4.x)
    if (baseImage) {
        const imageData = await resolveImageBase64(baseImage);
        body.image = imageData;
    }

    console.log(`[Seedream] Submitting: model=${body.model}, size=${resolvedSize ?? 'adaptive'}, seed=${supportsSeed ? usedSeed : 'n/a'}, keySource=${specificApiKey ? 'user' : 'server'}`);

    // Step 1: Submit the request
    const submitResponse = await safeFetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        console.error('[Seedream] Submit error status:', submitResponse.status);
        console.error('[Seedream] Submit error text:', errorText);

        try {
            const errorJson = JSON.parse(errorText);
            console.error('[Seedream] Full error details:', JSON.stringify(errorJson, null, 2));
        } catch (_) {
            // Ignore parse error
        }

        if (submitResponse.status === 401) {
            throw new Error('Invalid APIFree.ai API key. Please check your APIFREE_API_KEY.');
        }
        if (submitResponse.status === 402) {
            throw new Error('Insufficient APIFree.ai credits. Please top up your account.');
        }

        throw new Error(`Seedream submit failed: ${submitResponse.status} - ${errorText}`);
    }

    const submitData = await submitResponse.json();

    if (submitData.code !== 200) {
        console.error('[Seedream] Full error response:', JSON.stringify(submitData, null, 2));
        const errorMsg = submitData.code_msg ||
            (submitData.resp_data && submitData.resp_data.error) ||
            'Unknown error';
        throw new Error(`Seedream API error (${submitData.code}): ${errorMsg}`);
    }

    const requestId = submitData.resp_data?.request_id;
    if (!requestId) {
        console.error('[Seedream] No request_id in response:', JSON.stringify(submitData, null, 2));
        throw new Error('No request_id returned from Seedream API');
    }

    console.log(`[Seedream] Request submitted. ID: ${requestId}. Polling for result...`);

    // Step 2: Poll for result
    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        attempts++;

        const resultResponse = await safeFetch(RESULT_ENDPOINT(requestId), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!resultResponse.ok) {
            console.error('[Seedream] Poll error:', resultResponse.status);
            continue; // Keep trying
        }

        const resultData = await resultResponse.json();

        if (resultData.code !== 200) {
            console.error('[Seedream] Result error code:', resultData.code);
            console.error('[Seedream] Result error msg:', resultData.code_msg);
            continue;
        }

        const status = resultData.resp_data?.status;
        console.log(`[Seedream] Poll attempt ${attempts}: status=${status}`);

        if (status === 'success') {
            const imageList = resultData.resp_data?.image_list;
            if (!imageList || imageList.length === 0) {
                throw new Error('No images in Seedream response');
            }

            const imageUrl = imageList[0];
            console.log(`[Seedream] Image generated successfully. Downloading...`);

            // Download the image and convert to base64
            const imageResponse = await safeFetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error('Failed to download generated image');
            }

            const arrayBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');

            const finalSeed = supportsSeed ? usedSeed : (resultData.resp_data?.seed ?? -1);
            console.log(`[Seedream] Generation complete. seed=${finalSeed}, cost=$${resultData.resp_data?.usage?.cost || 0}`);
            return { base64, seed: finalSeed };
        }

        if (status === 'error' || status === 'failed') {
            const error = resultData.resp_data?.error || 'Unknown error';
            console.error('[Seedream] Generation failed in polling:', error);
            throw new Error(`Seedream generation failed: ${error}`);
        }

        // Status is 'queuing' or 'processing' — continue polling
    }

    throw new Error('Seedream generation timed out after 2 minutes');
}
