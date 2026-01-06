// Usage tracking utilities for Gemini API billing

import { calculateImageCost } from '../../utils/pricing.js';
import type { GeminiModel, Resolution } from '../../types';

export type FeatureType = 'brandingmachine' | 'mockupmachine' | 'canvas';

export interface UsageRecord {
  userId: string;
  imagesGenerated: number; // Number of images generated in this request
  timestamp: Date;
  promptLength?: number; // Character count of prompt
  hasInputImage: boolean; // Whether input image was provided
  model: string; // Model used (e.g., 'gemini-2.5-flash-image')
  cost: number; // Calculated cost in USD
  requestId?: string; // Optional request ID for tracking
  feature?: FeatureType; // Feature where credits were used (brandingmachine, mockupmachine, canvas)
  apiKeySource?: 'user' | 'system'; // Source of the API key used
}

// Text generation pricing (tokens-based) - kept here as it's not part of image/video pricing
const TEXT_GENERATION_PRICING = {
  'gemini-2.5-flash': {
    costPer1KTokens: 0.075, // $0.075 per 1K tokens (for text generation)
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
 * Note: Text generation pricing is kept here as it's not part of the image/video pricing structure
 */
export function calculateTextGenerationCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'gemini-2.5-flash'
): number {
  const pricing = TEXT_GENERATION_PRICING[model as keyof typeof TEXT_GENERATION_PRICING];

  if (!pricing || !('costPer1KTokens' in pricing)) {
    console.warn(`Unknown text model pricing for ${model}`);
    return 0;
  }

  // Typically input and output tokens have different pricing
  // This is a simplified calculation
  const totalTokens = inputTokens + outputTokens;
  return (totalTokens / 1000) * pricing.costPer1KTokens;
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
  apiKeySource: 'user' | 'system' = 'system'
): UsageRecord {
  return {
    userId,
    imagesGenerated,
    timestamp: new Date(),
    promptLength,
    hasInputImage,
    model,
    cost: calculateImageGenerationCost(imagesGenerated, model, hasInputImage, resolution),
    feature,
    apiKeySource,
  };
}

