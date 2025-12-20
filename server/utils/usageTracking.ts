// Usage tracking utilities for Gemini API billing

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

// Gemini API Pricing (as of 2024)
// Note: Update these based on actual Google Gemini pricing
const GEMINI_PRICING = {
  'gemini-2.5-flash-image': {
    costPerImage: 0.002, // $0.002 per image (example pricing, adjust based on actual)
    // For models with input image, may have different pricing
    costPerImageWithInput: 0.004, // Slightly higher if input image is provided
  },
  'gemini-3-pro-image-preview': {
    costPerImage: 0.03, // $0.03 per image (approximate)
    // May vary by resolution, but using base cost for now
  },
  'gemini-2.5-flash': {
    costPer1KTokens: 0.075, // $0.075 per 1K tokens (for text generation)
  },
};

// Credit costs per model/resolution
import type { GeminiModel, Resolution } from '../../types';

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
        return 10;
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
 * Video generation costs 15 credits per video
 */
export function getVideoCreditsRequired(): number {
  return 15;
}

/**
 * Calculate cost for image generation
 */
export function calculateImageGenerationCost(
  imagesCount: number,
  model: string = 'gemini-2.5-flash-image',
  hasInputImage: boolean = false,
  resolution?: Resolution
): number {
  const pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING];

  if (!pricing) {
    console.warn(`Unknown model pricing for ${model}, using default`);
    return imagesCount * 0.002; // Default fallback
  }

  if ('costPerImage' in pricing) {
    let costPerImage = hasInputImage && 'costPerImageWithInput' in pricing && pricing.costPerImageWithInput
      ? pricing.costPerImageWithInput
      : pricing.costPerImage;

    // Adjust cost for 3 Pro based on resolution (if needed)
    if (model === 'gemini-3-pro-image-preview' && resolution) {
      // Base cost is for 1K, adjust for higher resolutions
      // This is approximate - actual API pricing may vary
      const resolutionMultiplier = resolution === '2K' ? 1.67 : resolution === '4K' ? 3.33 : 1;
      costPerImage = costPerImage * resolutionMultiplier;
    }

    return imagesCount * costPerImage;
  }

  // Fallback
  return imagesCount * 0.002;
}

/**
 * Calculate cost for text generation (tokens-based)
 */
export function calculateTextGenerationCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'gemini-2.5-flash'
): number {
  const pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING];

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

