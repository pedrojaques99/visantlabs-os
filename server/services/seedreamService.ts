import type { UploadedImage, AspectRatio, SeedreamModel, Resolution } from '../../src/types/types.js';
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
    return `data:${image.mimeType};base64,${base64Data}`;
}

/**
 * Generate image using Seedream via APIFree.ai (async API)
 * Returns base64 image data
 */
export async function generateSeedreamImage(options: SeedreamGenerateOptions): Promise<string> {
    const {
        prompt,
        baseImage,
        model = 'seedream-4.5',
        resolution = '2K',
        watermark = false,
        apiKey: specificApiKey,
    } = options;

    const apiKey = specificApiKey || process.env.APIFREE_API_KEY;
    if (!apiKey) {
        throw new Error('APIFREE_API_KEY not configured and no user key provided.');
    }

    // Build request body for APIFree.ai
    const body: Record<string, any> = {
        model: `bytedance/${model}`, // APIFree.ai format: bytedance/seedream-4.5
        prompt,
        size: resolution, // "2K" or "4K"
    };

    // Add reference image if provided (for img2img)
    if (baseImage) {
        const imageData = await resolveImageBase64(baseImage);
        body.image = imageData;
    }

    console.log(`[Seedream] Submitting request: model=${body.model}, size=${resolution}`);

    // Step 1: Submit the request
    const submitResponse = await fetch(SUBMIT_ENDPOINT, {
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
            // Try to parse JSON error if possible
            const errorJson = JSON.parse(errorText);
            console.error('[Seedream] Full error details:', JSON.stringify(errorJson, null, 2));
        } catch (e) {
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

        const resultResponse = await fetch(RESULT_ENDPOINT(requestId), {
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

            console.log(`[Seedream] Generation complete. Usage: $${resultData.resp_data?.usage?.cost || 0}`);
            return base64;
        }

        if (status === 'error' || status === 'failed') {
            const error = resultData.resp_data?.error || 'Unknown error';
            console.error('[Seedream] Generation failed in polling:', error);
            throw new Error(`Seedream generation failed: ${error}`);
        }

        // Status is 'queuing' or 'processing' - continue polling
    }

    throw new Error('Seedream generation timed out after 2 minutes');
}

/**
 * Get available Seedream models
 */
export function getSeedreamModels(): { id: SeedreamModel; name: string }[] {
    return [
        { id: 'seedream-4.5', name: 'Seedream 4.5 (Latest)' },
        { id: 'seedream-4.0', name: 'Seedream 4.0' },
    ];
}

/**
 * Get supported resolutions for Seedream
 */
export function getSeedreamResolutions(): Resolution[] {
    return ['2K', '4K'];
}
