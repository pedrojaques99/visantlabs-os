/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AiService {
    /**
     * Improve an image generation prompt
     * Refine and enhance a prompt to produce better AI image generation results.
     * @param requestBody
     * @returns any Improved prompt text
     * @throws ApiError
     */
    public static postAiImprovePrompt(
        requestBody: {
            /**
             * The prompt to improve
             */
            prompt: string;
        },
    ): CancelablePromise<{
        improved?: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/improve-prompt',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Generate an optimized image prompt from structured inputs
     * Build a high-quality image generation prompt from design type, style tags, colors, and optional brand context.
     * @param requestBody
     * @returns any Generated prompt
     * @throws ApiError
     */
    public static postAiGenerateSmartPrompt(
        requestBody: {
            /**
             * Type of design (e.g. product mockup, social media post)
             */
            designType: string;
            additionalPrompt?: string;
            aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
            brandingTags?: Array<string>;
            brandGuidelineId?: string;
            negativePrompt?: string;
        },
    ): CancelablePromise<{
        prompt?: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/generate-smart-prompt',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Generate variations of an existing prompt
     * Generate variations of an existing prompt
     * @param requestBody
     * @returns any Array of prompt variations
     * @throws ApiError
     */
    public static postAiSuggestPromptVariations(
        requestBody: {
            prompt: string;
        },
    ): CancelablePromise<{
        variations?: Array<string>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/suggest-prompt-variations',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Describe / extract prompt from an image
     * Analyze an image and return a detailed description suitable for use as a generation prompt.
     * @param requestBody
     * @returns any Image description / extracted prompt
     * @throws ApiError
     */
    public static postAiDescribeImage(
        requestBody: {
            image: {
                url?: string;
                base64?: string;
                mimeType?: string;
            };
        },
    ): CancelablePromise<{
        description?: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/describe-image',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Extract dominant color palette from an image
     * Analyze an image and return hex codes, color names, semantic roles (primary/accent/background/neutral), and frequency.
     * @param requestBody
     * @returns any Extracted color palette
     * @throws ApiError
     */
    public static postAiExtractColors(
        requestBody: {
            image: {
                url?: string;
                base64?: string;
                mimeType?: string;
            };
        },
    ): CancelablePromise<{
        colors?: Array<{
            hex?: string;
            name?: string;
            role?: 'primary' | 'secondary' | 'accent' | 'background' | 'neutral';
            frequency?: 'dominant' | 'common' | 'rare';
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/extract-colors',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Generate brand or product name suggestions
     * Generate creative and memorable name suggestions from a brief. Optionally biased by a brand guideline.
     * @param requestBody
     * @returns any Name suggestions with rationale
     * @throws ApiError
     */
    public static postAiGenerateNaming(
        requestBody: {
            /**
             * Brand or product description
             */
            brief: string;
            /**
             * Number of name suggestions
             */
            count?: number;
            /**
             * Naming style (invented word, metaphor, compound, real word)
             */
            style?: string;
            brandGuidelineId?: string;
        },
    ): CancelablePromise<{
        names?: Array<{
            name?: string;
            rationale?: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/ai/generate-naming',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
