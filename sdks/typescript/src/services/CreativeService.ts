/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CreativeService {
    /**
     * Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset.
     * Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset. If brandId is provided, the plan is automatically biased by that brand's learned edit history.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static createCreativePlan(
        requestBody: {
            /**
             * Creative brief / user intent
             */
            prompt: string;
            /**
             * Aspect ratio of the creative
             */
            format: '1:1' | '9:16' | '16:9' | '4:5';
            /**
             * Optional brand guideline id for brand-aware generation
             */
            brandId?: string;
            /**
             * Inline brand context if brandId is not available
             */
            brandContext?: {
                name?: string;
                colors?: Array<string>;
                fonts?: Array<string>;
                voice?: string;
                keywords?: Array<string>;
                hasLogos?: boolean;
            };
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/create_creative_plan',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Query the raw creative edit event stream (observability).
     * Query the raw creative edit event stream (observability). Newest first. Filter by brandId or creativeId.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static listCreativeEvents(
        requestBody: {
            brandId?: string;
            creativeId?: string;
            limit?: number;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/list_creative_events',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Get aggregate creative metrics (creatives count, avg edits per creative, first-try acceptance rate).
     * Get aggregate creative metrics (creatives count, avg edits per creative, first-try acceptance rate). Optionally scoped to a brand.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getCreativeMetrics(
        requestBody: {
            /**
             * Optional brand filter
             */
            brandId?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_creative_metrics',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
}
