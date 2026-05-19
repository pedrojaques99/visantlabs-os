/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MockupsService {
    /**
     * List mockups
     * List mockups
     * @param limit
     * @param skip
     * @returns any[] List of mockups
     * @throws ApiError
     */
    public static getMockups(
        limit?: number,
        skip?: number,
    ): CancelablePromise<any[]> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/mockups',
            query: {
                'limit': limit,
                'skip': skip,
            },
        });
    }
    /**
     * Generate mockup using AI
     * Generate product mockup from image using Gemini or Claude AI
     * @param requestBody
     * @returns any Mockup generated successfully
     * @throws ApiError
     */
    public static postMockupsGenerate(
        requestBody: {
            promptText: string;
            baseImage: string;
            width?: number;
            height?: number;
            resolution?: 'hd' | '1k' | '2k' | '4k';
            model?: 'gemini-2.5-flash-image' | 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview' | 'seedream-4.5' | 'seedream-4.0' | 'gpt-image-2';
            /**
             * Image generation provider. Defaults to gemini.
             */
            provider?: 'gemini' | 'seedream' | 'openai';
        },
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/mockups/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request parameters`,
            },
        });
    }
    /**
     * Get mockup by ID
     * Get mockup by ID
     * @param id
     * @returns any Mockup details
     * @throws ApiError
     */
    public static getMockupsId(
        id: string,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/mockups/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Mockup not found`,
            },
        });
    }
    /**
     * Update mockup
     * Update mockup
     * @param id
     * @param requestBody
     * @returns any Mockup updated
     * @throws ApiError
     */
    public static putMockupsId(
        id: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/mockups/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete mockup
     * Delete mockup
     * @param id
     * @returns any Mockup deleted
     * @throws ApiError
     */
    public static deleteMockupsId(
        id: string,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/mockups/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Generate multiple mockup images in parallel
     * Generate up to 20 mockup images in parallel from an array of prompts. All images share the same model and output settings.
     * @param requestBody
     * @returns any Batch generation results
     * @throws ApiError
     */
    public static postMockupsBatchGenerate(
        requestBody: {
            /**
             * Array of prompts (max 20)
             */
            prompts: Array<string>;
            provider?: 'gemini' | 'openai' | 'seedream';
            model?: string;
            aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
            resolution?: '1K' | '2K' | '4K';
            brandGuidelineId?: string;
            baseImage?: {
                url?: string;
                base64?: string;
            };
        },
    ): CancelablePromise<{
        total?: number;
        results?: Array<{
            index?: number;
            success?: boolean;
            data?: Record<string, any>;
            error?: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/mockups/batch-generate',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Generate multiple mockup images in parallel.
     * Generate multiple mockup images in parallel. prompts can be an array of strings OR an array of objects { promptText, referenceImages?, baseImage? } to pass per-item reference images (e.g. brand logos). All items share the same model, provider, and output settings. Max 20 per call.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static batchGenerateMockups(
        requestBody: {
            /**
             * Array of prompts (string) or prompt objects with per-item referenceImages (max 20)
             */
            prompts: Array<(string | {
                promptText: string;
                /**
                 * Per-prompt reference images (e.g. brand logo URLs)
                 */
                referenceImages?: Array<{
                    url?: string;
                    base64?: string;
                    mimeType?: string;
                }>;
                /**
                 * Per-prompt base image for img2img
                 */
                baseImage?: Record<string, any>;
            })>;
            /**
             * Image generation provider. Default: openai
             */
            provider?: 'gemini' | 'openai' | 'seedream';
            /**
             * Model name. For openai: gpt-image-1 or gpt-image-2. For gemini: gemini-2.0-flash-exp-image-generation.
             */
            model?: string;
            /**
             * Aspect ratio for all images. Default: 1:1
             */
            aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
            /**
             * Output resolution for all images. Default: 1K
             */
            resolution?: '1K' | '2K' | '4K';
            /**
             * Brand guideline id to inject brand context into all prompts automatically
             */
            brandGuidelineId?: string;
            /**
             * Optional base image URL applied to all generations (image-to-image)
             */
            baseImageUrl?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/batch_generate_mockups',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * List all public/blank mockup templates available in the platform (no auth required).
     * List all public/blank mockup templates available in the platform (no auth required).
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static listPublicMockups(
        requestBody: any,
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/list_public_mockups',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * List all mockups for the authenticated user.
     * List all mockups for the authenticated user.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static listMockups(
        requestBody: any,
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/list_mockups',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Get a single mockup by ID.
     * Get a single mockup by ID.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getMockup(
        requestBody: {
            /**
             * Mockup ID
             */
            mockupId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_mockup',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Delete a mockup by ID.
     * Delete a mockup by ID.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static deleteMockup(
        requestBody: {
            /**
             * Mockup ID
             */
            mockupId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/delete_mockup',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Get mockup generation usage statistics for the current billing period.
     * Get mockup generation usage statistics for the current billing period.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getMockupUsageStats(
        requestBody: any,
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_mockup_usage_stats',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
}
