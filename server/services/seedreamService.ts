import type { UploadedImage, AspectRatio, SeedreamModel, Resolution } from '../../src/types/types.js';
import { safeFetch } from '../utils/securityValidation.js';

const APIFREE_ENDPOINT = 'https://api.apifree.ai/v1/images/generations';

// Aspect ratio to Seedream size mapping (based on Seedream 4.5 docs)
const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
    '1:1': '2048x2048',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3024x1296',
    '4:5': '1638x2048',
    '5:4': '2048x1638',
};

// Scale sizes for 4K resolution (multiply by ~1.4)
const ASPECT_RATIO_TO_SIZE_4K: Record<string, string> = {
    '1:1': '2880x2880',
    '16:9': '3584x2016',
    '9:16': '2016x3584',
    '4:3': '3226x2419',
    '3:4': '2419x3226',
    '3:2': '3494x2330',
    '2:3': '2330x3494',
    '21:9': '4096x1755',
    '4:5': '2294x2867',
    '5:4': '2867x2294',
};

interface SeedreamGenerateOptions {
    prompt: string;
    baseImage?: UploadedImage;
    model?: SeedreamModel;
    resolution?: Resolution;
    aspectRatio?: AspectRatio;
    watermark?: boolean;
}

/**
 * Resolves image to base64 format
 */
async function resolveImageBase64(image: UploadedImage): Promise<string> {
    if (image.base64 && image.base64.length > 0) {
        return image.base64;
    }

    if (image.url) {
        const response = await safeFetch(image.url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer).toString('base64');
    }

    throw new Error('Image has no base64 data or URL');
}

/**
 * Generate image using Seedream via APIFree.ai
 * Returns base64 image data
 */
export async function generateSeedreamImage(options: SeedreamGenerateOptions): Promise<string> {
    const {
        prompt,
        baseImage,
        model = 'seedream-4.5',
        resolution = '2K',
        aspectRatio = '1:1',
        watermark = false,
    } = options;

    const apiKey = process.env.APIFREE_API_KEY;
    if (!apiKey) {
        throw new Error('APIFREE_API_KEY not configured. Please add it to your .env file.');
    }

    // Select size based on resolution and aspect ratio
    const sizeMap = resolution === '4K' ? ASPECT_RATIO_TO_SIZE_4K : ASPECT_RATIO_TO_SIZE;
    const size = sizeMap[aspectRatio] || ASPECT_RATIO_TO_SIZE[aspectRatio] || '2048x2048';

    // Build request body
    const body: Record<string, any> = {
        model: `bytedance/${model}`,
        prompt,
        size,
        n: 1,
        response_format: 'b64_json',
        watermark,
    };

    // Add reference image for img2img if provided
    if (baseImage) {
        const imageBase64 = await resolveImageBase64(baseImage);
        body.image = `data:${baseImage.mimeType};base64,${imageBase64}`;
    }

    console.log(`[Seedream] Generating with model=${model}, size=${size}, aspectRatio=${aspectRatio}`);

    const response = await fetch(APIFREE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Seedream] API error:', response.status, errorText);

        if (response.status === 401) {
            throw new Error('Invalid APIFree.ai API key. Please check your APIFREE_API_KEY.');
        }
        if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait before making more requests.');
        }
        if (response.status === 402) {
            throw new Error('Insufficient APIFree.ai credits. Please top up your account.');
        }

        throw new Error(`Seedream API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // OpenAI-compatible response format
    if (data.data && data.data[0]) {
        const imageData = data.data[0];

        if (imageData.b64_json) {
            console.log('[Seedream] Successfully generated image');
            return imageData.b64_json;
        }

        // If URL returned instead of base64, fetch and convert
        if (imageData.url) {
            console.log('[Seedream] Fetching image from URL...');
            const imgResponse = await safeFetch(imageData.url);
            if (!imgResponse.ok) throw new Error('Failed to fetch generated image');
            const arrayBuffer = await imgResponse.arrayBuffer();
            return Buffer.from(arrayBuffer).toString('base64');
        }
    }

    throw new Error('No image data in Seedream response');
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
