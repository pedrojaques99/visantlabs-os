// Usage tracking utilities for Gemini API billing

import { calculateImageCost } from '../../src/utils/pricing.js';
import type { GeminiModel, Resolution } from '../../src/types/types.js';

export type FeatureType = 'brandingmachine' | 'mockupmachine' | 'canvas' | 'branding';

export interface UsageRecord {
  userId: string;
  imagesGenerated: number; // Number of images generated in this request
  timestamp: Date;
  promptLength?: number; // Character count of prompt
  inputTokens?: number; // Number of input tokens
  outputTokens?: number; // Number of output tokens
  hasInputImage: boolean; // Whether input image was provided
  model: string; // Model used (e.g., 'gemini-2.5-flash-image')
  cost: number; // Calculated cost in USD
  requestId?: string; // Optional request ID for tracking
  feature?: FeatureType; // Feature where credits were used (brandingmachine, mockupmachine, canvas)
  apiKeySource?: 'user' | 'system'; // Source of the API key used
}

// Text generation pricing (tokens-based)
// Prices are per 1 million tokens (USD)
const TEXT_GENERATION_PRICING = {
  'gemini-2.5-flash': {
    inputPricePer1M: 0.30,
    outputPricePer1M: 2.50,
  },
  'gemini-3-pro-preview': { // Applies to analysis/text tasks using this model
    inputPricePer1M: 2.00,
    outputPricePer1M: 12.00,
  },
};

/**
 * Get credits required for image generation based on model and resolution
 */
export function getCreditsRequired(
  model: GeminiModel,
  resolution?: Resolution
): number {
  if (model === 'gemini-2.5-flash-image') {
    return 1;
  }

  if (model === 'gemini-3-pro-image-preview') {
    switch (resolution) {
      case '1K':
        return 3;
      case '2K':
        return 5;
      case '4K':
        return 7;
      default:
        // Default to 1K if resolution not specified
        return 3;
    }
  }

  // Fallback to 1 credit for unknown models
  return 1;
}

/**
 * Get credits required for video generation
 * Video generation costs 20 credits per video
 */
export function getVideoCreditsRequired(): number {
  return 20;
}

/**
 * Calculate cost for image generation
 * Uses centralized pricing from utils/pricing.ts
 */
export function calculateImageGenerationCost(
  imagesCount: number,
  model: string = 'gemini-2.5-flash-image',
  hasInputImage: boolean = false,
  resolution?: Resolution
): number {
  // Note: hasInputImage is kept for API compatibility but not used in pricing
  // as the new pricing structure doesn't differentiate based on input image
  return calculateImageCost(imagesCount, model, resolution);
}

/**
 * Calculate cost for text generation (tokens-based)
 * Supports separate input and output token pricing
 */
export function calculateTextGenerationCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'gemini-2.5-flash'
): number {
  const normalizedModel = model.includes('gemini-3-pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
  const pricing = TEXT_GENERATION_PRICING[normalizedModel as keyof typeof TEXT_GENERATION_PRICING];

  if (!pricing) {
    console.warn(`Unknown text model pricing for ${model}, using Flash rates as fallback`);
    // Fallback to Flash rates
    return (inputTokens / 1_000_000) * 0.30 + (outputTokens / 1_000_000) * 2.50;
  }

  // Calculate cost: (Tokens / 1M) * PricePer1M
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;

  return inputCost + outputCost;
}

/**
 * Create a usage record for billing
 */
export function createUsageRecord(
  userId: string,
  imagesGenerated: number,
  model: string = 'gemini-2.5-flash-image',
  hasInputImage: boolean = false,
  promptLength?: number,
  resolution?: Resolution,
  feature?: FeatureType,
  apiKeySource: 'user' | 'system' = 'system',
  inputTokens?: number,
  outputTokens?: number
): UsageRecord {
  // Determine if this is an image/video generation or text/analysis task
  let cost = 0;

  if (imagesGenerated > 0) {
    // It's an image generation
    cost = calculateImageGenerationCost(imagesGenerated, model, hasInputImage, resolution);
  } else if (inputTokens !== undefined || outputTokens !== undefined) {
    // It's a text/analysis task (prompt generation, categorization, etc.)
    cost = calculateTextGenerationCost(inputTokens || 0, outputTokens || 0, model);
  }

  return {
    userId,
    imagesGenerated,
    timestamp: new Date(),
    promptLength,
    inputTokens,
    outputTokens,
    hasInputImage,
    model,
    cost,
    feature,
    apiKeySource,
  };
}
