/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BrandGuidelinesService {
    /**
     * Get public brand guideline
     * Returns full brand guideline data for a public slug. No authentication required.
     * @param slug
     * @returns any Brand guideline data
     * @throws ApiError
     */
    public static getBrandGuidelinesPublicSlug(
        slug: string,
    ): CancelablePromise<{
        guideline?: {
            _id?: string;
            name?: string;
            isPublic?: boolean;
            publicSlug?: string;
            identity?: Record<string, any>;
            colors?: Record<string, any>;
            typography?: Record<string, any>;
            logos?: any[];
            guidelines?: any[];
        };
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/brand-guidelines/public/{slug}',
            path: {
                'slug': slug,
            },
            errors: {
                404: `Brand guideline not found or not public`,
            },
        });
    }
    /**
     * Get brand context for LLMs
     * Returns LLM-ready formatted brand context. Perfect for AI agents and MCP integrations. No authentication required.
     * @param slug
     * @param format
     * @param output
     * @returns any Brand context
     * @throws ApiError
     */
    public static getBrandGuidelinesPublicSlugContext(
        slug: string,
        format?: string,
        output?: string,
    ): CancelablePromise<{
        slug?: string;
        brandName?: string;
        format?: string;
        context?: string;
        data?: {
            colors?: Record<string, any>;
            typography?: Record<string, any>;
            guidelines?: any[];
            tokens?: Record<string, any>;
        };
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/brand-guidelines/public/{slug}/context',
            path: {
                'slug': slug,
            },
            query: {
                'format': format,
                'output': output,
            },
            errors: {
                404: `Brand guideline not found or not public`,
            },
        });
    }
}
