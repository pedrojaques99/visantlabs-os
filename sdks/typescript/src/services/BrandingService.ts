/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BrandingService {
    /**
     * Generate a branding step (persona, archetype, SWOT, colors, moodboard, etc.)
     * Multi-step branding generation engine. Each step generates a specific brand asset using AI.
     * Step values:
     * - 1: Market Research — benchmarking paragraph
     * - 5: Competitors — competitive landscape
     * - 6: References — visual design inspirations
     * - 7: SWOT — strengths/weaknesses/opportunities/threats
     * - 8: Color Palettes — AI color recommendations with hex codes
     * - 9: Visual Elements — icons, patterns, textures
     * - 10: Persona — audience persona (demographics, psychographics, pain points)
     * - 11: Concept Ideas — product mockup and usage scenarios
     * - 12: Moodboard — mood and aesthetic direction
     * - 13: Archetypes — brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.)
     * @param requestBody
     * @returns any Generated branding step result
     * @throws ApiError
     */
    public static postBrandingGenerateStep(
        requestBody: {
            /**
             * Branding step to generate
             */
            step: 1 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
            /**
             * Brand or product brief
             */
            prompt: string;
            /**
             * Prior branding data for context-aware generation (e.g. { marketResearch, swot, colors })
             */
            previousData?: Record<string, any>;
        },
    ): CancelablePromise<{
        result?: Record<string, any>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/branding/generate-step',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                402: `Insufficient credits`,
            },
        });
    }
}
