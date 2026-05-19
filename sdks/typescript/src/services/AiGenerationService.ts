/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AiGenerationService {
    /**
     * Improve and refine an existing image generation prompt to make it more detailed and effective.
     * Improve and refine an existing image generation prompt to make it more detailed and effective.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static improvePrompt(
        requestBody: {
            /**
             * The prompt to improve
             */
            prompt: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/improve_prompt',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate an optimized image generation prompt from structured inputs (design type, tags, colors, aspect ratio).
     * Generate an optimized image generation prompt from structured inputs (design type, tags, colors, aspect ratio). Optionally biased by a base image or brand guideline.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateSmartPrompt(
        requestBody: {
            /**
             * Type of design (e.g. product mockup, social media post, banner)
             */
            designType: string;
            /**
             * Free-text creative direction to include
             */
            additionalPrompt?: string;
            aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
            /**
             * Brand style tags
             */
            brandingTags?: Array<string>;
            categoryTags?: Array<string>;
            locationTags?: Array<string>;
            angleTags?: Array<string>;
            lightingTags?: Array<string>;
            effectTags?: Array<string>;
            materialTags?: Array<string>;
            /**
             * URL of a reference image
             */
            baseImageUrl?: string;
            /**
             * Brand guideline id for brand-aware prompt
             */
            brandGuidelineId?: string;
            /**
             * Things to exclude from the image
             */
            negativePrompt?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_smart_prompt',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate multiple creative variations of an existing prompt.
     * Generate multiple creative variations of an existing prompt.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static suggestPromptVariations(
        requestBody: {
            /**
             * Base prompt to vary
             */
            prompt: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/suggest_prompt_variations',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Reverse-engineer a descriptive prompt from an image (URL or base64).
     * Reverse-engineer a descriptive prompt from an image (URL or base64). Useful for replicating a visual style.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static extractPromptFromImage(
        requestBody: {
            /**
             * URL of the image to analyze
             */
            imageUrl: string;
            /**
             * MIME type of the image (default: image/png)
             */
            mimeType?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/extract_prompt_from_image',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Extract a dominant color palette from an image (URL or base64).
     * Extract a dominant color palette from an image (URL or base64). Returns hex codes, color names, semantic roles (primary/accent/etc.) and frequency.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static extractColors(
        requestBody: {
            /**
             * URL of the image to analyze
             */
            imageUrl: string;
            /**
             * MIME type (default: image/png)
             */
            mimeType?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/extract_colors',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate creative brand or product name suggestions from a brief.
     * Generate creative brand or product name suggestions from a brief. Optionally biased by a brand guideline. Returns names with rationale.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateNaming(
        requestBody: {
            /**
             * Description of the brand, product, or concept to name
             */
            brief: string;
            /**
             * Number of name suggestions (default: 10)
             */
            count?: number;
            /**
             * Naming style preference (e.g. invented word, metaphor, compound, real word)
             */
            style?: string;
            /**
             * Brand guideline id for brand-aware naming
             */
            brandGuidelineId?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_naming',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate a detailed audience persona (demographics, psychographics, pain points, motivations) from a brand brief.
     * Generate a detailed audience persona (demographics, psychographics, pain points, motivations) from a brand brief.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generatePersona(
        requestBody: {
            /**
             * Brand or product brief
             */
            prompt: string;
            /**
             * Optional prior market research context
             */
            marketResearch?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_persona',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.
     * Generate brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.) from a brand brief.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateArchetype(
        requestBody: {
            /**
             * Brand or product brief
             */
            prompt: string;
            /**
             * Optional prior market research context
             */
            marketResearch?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_archetype',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate creative mockup/usage scenario ideas for a product or brand.
     * Generate creative mockup/usage scenario ideas for a product or brand.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateConceptIdeas(
        requestBody: {
            /**
             * Brand or product brief
             */
            prompt: string;
            /**
             * Optional prior branding data (persona, colors, archetype) for richer ideas
             */
            previousData?: Record<string, any>;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_concept_ideas',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate AI-recommended color palettes for a brand from a brief and optional SWOT/references context.
     * Generate AI-recommended color palettes for a brand from a brief and optional SWOT/references context.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateColorPalettes(
        requestBody: {
            /**
             * Brand or product brief
             */
            prompt: string;
            /**
             * Optional prior branding data (swot, references)
             */
            previousData?: Record<string, any>;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_color_palettes',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate a market benchmarking paragraph for a brand or product brief.
     * Generate a market benchmarking paragraph for a brand or product brief.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateMarketResearch(
        requestBody: {
            /**
             * Brand or product brief
             */
            prompt: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_market_research',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate a SWOT analysis (strengths, weaknesses, opportunities, threats) for a brand brief.
     * Generate a SWOT analysis (strengths, weaknesses, opportunities, threats) for a brand brief.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateSwot(
        requestBody: {
            /**
             * Brand or product brief
             */
            prompt: string;
            /**
             * Optional prior market research and competitors data
             */
            previousData?: Record<string, any>;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_swot',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate a moodboard direction (aesthetic, vibe, visual mood) for a brand brief.
     * Generate a moodboard direction (aesthetic, vibe, visual mood) for a brand brief.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateMoodboard(
        requestBody: {
            /**
             * Brand or product brief
             */
            prompt: string;
            /**
             * Optional prior branding data for richer moodboard
             */
            previousData?: Record<string, any>;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_moodboard',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Generate a single mockup image using AI (text-to-image or image-to-image).
     * Generate a single mockup image using AI (text-to-image or image-to-image). Supports gpt-image-1, gpt-image-2 (OpenAI), seedream, and gemini models. Returns the generated mockup object with imageUrl. For multiple mockups use batch_generate_mockups.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static generateMockup(
        requestBody: {
            /**
             * Prompt describing the image to generate
             */
            promptText: string;
            /**
             * Image generation provider. Default: openai
             */
            provider?: 'gemini' | 'openai' | 'seedream';
            /**
             * Model name. For openai: gpt-image-1 or gpt-image-2. For gemini: gemini-2.0-flash-exp-image-generation. For seedream: seedream-3-0.
             */
            model?: string;
            /**
             * Aspect ratio. Default: 1:1
             */
            aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
            /**
             * Output resolution. Default: 1K
             */
            resolution?: '1K' | '2K' | '4K';
            /**
             * URL of a base image for image-to-image generation
             */
            baseImageUrl?: string;
            /**
             * Brand guideline id to inject brand context into the prompt automatically
             */
            brandGuidelineId?: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/generate_mockup',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
}
