import {
    SEEDANCE_VIDEO_MODELS,
    SEEDANCE_VIDEO_MODEL_CONFIG,
    isSeedanceModel,
} from '../../src/constants/seedanceModels.js';
import type { SeedanceVideoModelId } from '../../src/constants/seedanceModels.js';
import { safeFetch } from '../utils/securityValidation.js';

// ── BytePlus API endpoints ────────────────────────────────────────────────────
const BYTEPLUS_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations';
const SUBMIT_ENDPOINT = `${BYTEPLUS_BASE}/tasks`;
const RESULT_ENDPOINT = (taskId: string) => `${BYTEPLUS_BASE}/tasks/${taskId}`;

// Polling configuration
const POLL_INTERVAL_MS = 5000; // 5 seconds between polls
const MAX_POLL_ATTEMPTS = 60;  // Max 5 minutes of polling

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface SeedanceGenerateParams {
    model: SeedanceVideoModelId;
    prompt: string;
    startFrame?: string;   // base64 data URL or https URL for first_frame
    endFrame?: string;     // base64 data URL or https URL for last_frame
    referenceImages?: string[];  // reference_image URLs/base64
    referenceAudio?: string;     // reference_audio URL/base64
    aspectRatio?: string;
    duration?: string;
    generateAudio?: boolean;
    seed?: number;
}

export interface SeedanceGenerateResult {
    videoUrl: string;
    lastFrameUrl?: string;
    seed: number;
}

type ContentRole = 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio';

interface ContentItem {
    type: 'text' | 'image_url' | 'video_url' | 'audio_url';
    text?: string;
    image_url?: { url: string };
    video_url?: { url: string };
    audio_url?: { url: string };
    role?: ContentRole;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Generate video using Seedance via BytePlus API (async submit + poll)
 */
export async function generateSeedanceVideo(params: SeedanceGenerateParams): Promise<SeedanceGenerateResult> {
    const {
        model = SEEDANCE_VIDEO_MODELS.V2_0,
        prompt,
        startFrame,
        endFrame,
        referenceImages,
        referenceAudio,
        aspectRatio = '16:9',
        duration = '5s',
        generateAudio,
        seed,
    } = params;

    // Validate model
    const modelConfig = SEEDANCE_VIDEO_MODEL_CONFIG[model];
    if (!modelConfig) {
        throw new Error(`Unknown Seedance model: ${model}`);
    }

    // Resolve API key
    const apiKey = process.env.BYTEPLUS_API_KEY;
    if (!apiKey) {
        throw new Error('No BytePlus API key available. Configure BYTEPLUS_API_KEY on the server.');
    }

    // Build content array
    const content: ContentItem[] = [
        { type: 'text', text: prompt },
    ];

    if (startFrame) {
        content.push({
            type: 'image_url',
            image_url: { url: startFrame },
            role: 'first_frame',
        });
    }

    if (endFrame) {
        content.push({
            type: 'image_url',
            image_url: { url: endFrame },
            role: 'last_frame',
        });
    }

    if (referenceImages) {
        for (const img of referenceImages) {
            content.push({
                type: 'image_url',
                image_url: { url: img },
                role: 'reference_image',
            });
        }
    }

    if (referenceAudio) {
        content.push({
            type: 'audio_url',
            audio_url: { url: referenceAudio },
            role: 'reference_audio',
        });
    }

    // Build request body
    const body: Record<string, unknown> = {
        model,
        content,
        ratio: aspectRatio,
        duration,
    };

    if (typeof generateAudio === 'boolean') {
        body.generate_audio = generateAudio;
    }

    if (typeof seed === 'number') {
        body.seed = seed;
    }

    const usedSeed = typeof seed === 'number' ? seed : -1;

    console.log(`[Seedance] Submitting: model=${model}, ratio=${aspectRatio}, duration=${duration}, seed=${usedSeed !== -1 ? usedSeed : 'random'}`);

    // Step 1: Submit task
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
        console.error('[Seedance] Submit error:', submitResponse.status, errorText);

        if (submitResponse.status === 401) {
            throw new Error('Invalid BytePlus API key. Please check your BYTEPLUS_API_KEY.');
        }
        if (submitResponse.status === 402) {
            throw new Error('Insufficient BytePlus credits. Please top up your account.');
        }

        throw new Error(`Seedance submit failed: ${submitResponse.status} - ${errorText}`);
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.id;

    if (!taskId) {
        console.error('[Seedance] No task id in response:', JSON.stringify(submitData, null, 2));
        throw new Error('No task id returned from Seedance API');
    }

    console.log(`[Seedance] Task submitted. ID: ${taskId}. Polling for result...`);

    // Step 2: Poll for result
    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        attempts++;

        const pollResponse = await safeFetch(RESULT_ENDPOINT(taskId), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!pollResponse.ok) {
            console.error(`[Seedance] Poll error: ${pollResponse.status}`);
            continue; // Keep trying
        }

        const pollData = await pollResponse.json();
        const status = pollData.status;

        console.log(`[Seedance] Poll attempt ${attempts}: status=${status}`);

        if (status === 'succeeded') {
            const output = pollData.output;
            if (!output?.video_url) {
                throw new Error('No video_url in Seedance response');
            }

            const resultSeed = pollData.seed ?? usedSeed;
            console.log(`[Seedance] Video generated successfully. seed=${resultSeed}`);

            return {
                videoUrl: output.video_url,
                lastFrameUrl: output.last_frame_url,
                seed: resultSeed,
            };
        }

        if (status === 'failed' || status === 'expired') {
            const error = pollData.error?.message || pollData.error || 'Unknown error';
            console.error('[Seedance] Generation failed:', error);
            throw new Error(`Seedance generation failed: ${error}`);
        }

        // Status is 'queued' or 'running' — continue polling
    }

    throw new Error('Seedance generation timed out after 5 minutes');
}
