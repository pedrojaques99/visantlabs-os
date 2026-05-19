/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CampaignsService {
    /**
     * Generate a full ad campaign from a product image and brand guidelines.
     * Generate a full ad campaign from a product image and brand guidelines. An LLM (GPT-4o) plans N distinct prompts across creative angles (benefit, social proof, urgency, lifestyle, fear, transformation, etc.) then generates all images in parallel using GPT-image-1 or Gemini. Returns a jobId for polling. Use get_campaign_results to check progress.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static createAdCampaign(
        requestBody: {
            /**
             * URL of the product photo to use as base image
             */
            productImageUrl: string;
            /**
             * Brand guideline id for brand-aware generation
             */
            brandGuidelineId?: string;
            /**
             * Creative brief describing the campaign goal
             */
            brief?: string;
            /**
             * Number of ads to generate (1-20)
             */
            count?: number;
            /**
             * Ad formats to generate. Cycles through formats if count > formats.length
             */
            formats?: Array<'square' | 'story' | 'banner' | 'portrait'>;
            /**
             * Image generation model
             */
            model?: 'gpt-image-1' | 'gpt-image-2' | 'gemini';
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/create_ad_campaign',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Poll the status and results of an ad campaign generation job started by create_ad_campaign.
     * Poll the status and results of an ad campaign generation job started by create_ad_campaign. Returns status (planning|generating|done|error), progress count, and per-ad results with imageUrl, prompt, adAngle, and format.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getCampaignResults(
        requestBody: {
            /**
             * Job id returned by create_ad_campaign
             */
            jobId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_campaign_results',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
}
