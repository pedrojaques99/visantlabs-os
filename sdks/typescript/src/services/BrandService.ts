/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BrandService {
    /**
     * Get learned brand preferences aggregated from user edit history.
     * Get learned brand preferences aggregated from user edit history. Returns font-size bias, color overrides, logo position bias, commonly removed roles, and human-readable patches. Use this to understand how a brand's actual usage diverges from AI defaults.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getBrandInsights(
        requestBody: {
            /**
             * Brand guideline id
             */
            brandId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_brand_insights',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * List all available brand guidelines with ids and names.
     * List all available brand guidelines with ids and names.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static listBrandGuidelines(
        requestBody: any,
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/list_brand_guidelines',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Fetch the full brand guideline for a given id.
     * Fetch the full brand guideline for a given id. Includes identity, colors, typography, logos, voice, gradients, shadows, motion tokens, borders, strategy, editorial guidelines, and validation state. Use this to get LLM-ready brand context before generating any brand-aware content.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getBrandGuideline(
        requestBody: {
            brandId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_brand_guideline',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Patch a brand guideline with new data.
     * Patch a brand guideline with new data. Accepts any subset of fields: identity, colors, typography, gradients, shadows, motion, borders, strategy, guidelines, tokens, validation. All fields are optional — only provided fields are updated.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static updateBrandGuideline(
        requestBody: {
            /**
             * Brand guideline id to update
             */
            brandId: string;
            /**
             * Partial brand guideline data to merge
             */
            data: {
                identity?: Record<string, any>;
                colors?: any[];
                typography?: any[];
                gradients?: any[];
                shadows?: any[];
                motion?: Record<string, any>;
                borders?: any[];
                strategy?: Record<string, any>;
                guidelines?: Record<string, any>;
                tokens?: Record<string, any>;
                validation?: Record<string, any>;
                tags?: Record<string, any>;
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
            url: '/api/mcp/tools/update_brand_guideline',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Mark a brand guideline section as approved or needs_work.
     * Mark a brand guideline section as approved or needs_work. Section names: colors, typography, logos, identity, strategy, editorial, gradients, shadows, motion, borders, tokens.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static validateBrandSection(
        requestBody: {
            brandId: string;
            /**
             * Section name to validate
             */
            section: string;
            /**
             * Validation state to set
             */
            state: 'approved' | 'needs_work' | 'pending';
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/validate_brand_section',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Get a structured LLM-ready design system context for a brand.
     * Get a structured LLM-ready design system context for a brand. Returns colors with semantic roles, typography with intent, spacing/radius tokens, shadows, gradients, motion tokens, and borders — formatted as a concise JSON optimized for AI code generation and design decisions.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getBrandDesignSystem(
        requestBody: {
            brandId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_brand_design_system',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
}
