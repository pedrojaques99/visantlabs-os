// Usage tracking utilities for Gemini API billing

import { calculateImageCost } from '../../src/utils/pricing.js';
import type { GeminiModel, Resolution } from '../../src/types/types.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { OPENAI_IMAGE_MODELS, isOpenAIImageModel } from '../../src/constants/openaiModels.js';
import { isSeedreamModel } from '../../src/constants/seedreamModels.js';
import { lookupCredits } from '../lib/pricing-data.js';

export type FeatureType = 'brandingmachine' | 'mockupmachine' | 'canvas' | 'branding' | 'figma';

export interface UsageRecord {
  userId: string;
  imagesGenerated: number; // Number of images generated in this request
  timestamp: Date;
  promptLength?: number; // Character count of prompt
  inputTokens?: number; // Number of input tokens
  outputTokens?: number; // Number of output tokens
  hasInputImage: boolean; // Whether input image was provided
  model: string; // Model used (e.g., GEMINI_MODELS.IMAGE_FLASH)
  cost: number; // Calculated cost in USD
  requestId?: string; // Optional request ID for tracking
  feature?: FeatureType; // Feature where credits were used (brandingmachine, mockupmachine, canvas)
  apiKeySource?: 'user' | 'system'; // Source of the API key used
}

// Text generation pricing (tokens-based)
// Prices are per 1 million tokens (USD)
const TEXT_GENERATION_PRICING: Record<string, { inputPricePer1M: number; outputPricePer1M: number }> = {
  [GEMINI_MODELS.FLASH_3]: {
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.40,
  },
  [GEMINI_MODELS.PRO_3_1]: {
    inputPricePer1M: 1.25,
    outputPricePer1M: 5.00,
  },
  [GEMINI_MODELS.FLASH_2_5]: {
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
  },
};

/**
 * Get credits required for image generation based on model and resolution.
 * Derives values from CREDIT_COSTS in pricing-data.ts (single source of truth).
 */
export function getCreditsRequired(
  model: GeminiModel | string,
  resolution?: Resolution
): number {
  const lookup = lookupCredits(model, resolution ? `${resolution}${resolution === '1K' || resolution === 'HD' ? ' (HD)' : ''}` : undefined);
  if (lookup !== undefined) return lookup;

  if (isOpenAIImageModel(model)) {
    switch (resolution) {
      case '512px':
      case 'HD':
      case '1K':    return 2;
      case '2K':    return 3;
      case '4K':    return 4;
      case '1080p': return 3;
      default:      return 2;
    }
  }

  if (isSeedreamModel(model)) {
    switch (resolution) {
      case '2K':  return 2;
      case '3K':  return 3;
      case '4K':  return 4;
      default:    return 2;
    }
  }

  if (model === GEMINI_MODELS.FLASH || model === GEMINI_MODELS.IMAGE_FLASH) return 1;

  if (model === GEMINI_MODELS.NB2 || model === GEMINI_MODELS.IMAGE_NB2) {
    switch (resolution) {
      case '512px': return 1;
      case '1K':
      case 'HD':    return 2;
      case '2K':    return 3;
      case '4K':    return 4;
      default:      return 2;
    }
  }

  if (model === GEMINI_MODELS.PRO || model === GEMINI_MODELS.IMAGE_PRO) {
    switch (resolution) {
      case '1K':
      case 'HD':  return 3;
      case '2K':  return 5;
      case '4K':  return 7;
      default:    return 3;
    }
  }

  return 1;
}

/**
 * Get credits required for video generation.
 * Covers Veo, Seedance, and Kling models.
 */
export function getVideoCreditsRequired(model?: string): number {
  if (model?.startsWith('seedance-')) {
    const isFast = model.includes('fast') || model.includes('lite');
    return isFast ? 20 : 35;
  }
  if (model?.startsWith('kling-')) {
    const isPro = model.includes('master') || model.includes('pro') || model.includes('4k');
    return isPro ? 30 : 20;
  }
  const isFast = model?.includes('fast') ?? false;
  return isFast ? 15 : 40;
}

/**
 * Calculate cost for image generation
 * Uses centralized pricing from utils/pricing.ts
 */
export function calculateImageGenerationCost(
  imagesCount: number,
  model: string = GEMINI_MODELS.IMAGE_FLASH,
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
  model: string = GEMINI_MODELS.TEXT
): number {
  const pricing = TEXT_GENERATION_PRICING[model] || TEXT_GENERATION_PRICING[GEMINI_MODELS.TEXT];

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
  model: string = GEMINI_MODELS.IMAGE_FLASH,
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
