// Centralized pricing for Gemini and Veo models
// Single source of truth for all pricing calculations

import type { GeminiModel, Resolution } from '../types/types';
import { GEMINI_MODELS } from '../constants/geminiModels.js';


/**
 * Pricing constants (in USD)
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 */
export const PRICING = {
  IMAGE: {
    // Gemini 2.5 Flash (HD) - fixed resolution ~1K
    GEMINI_2_5: 0.039, // gemini-2.5-flash-image
    // Gemini 3.1 Flash (NB2) - variable resolution
    NB2_512: 0.045,    // gemini-3.1-flash-image-preview 512px
    NB2_1K: 0.067,     // gemini-3.1-flash-image-preview 1K (official: $0.067)
    NB2_2K: 0.101,     // gemini-3.1-flash-image-preview 2K (official: $0.101)
    NB2_4K: 0.151,     // gemini-3.1-flash-image-preview 4K (official: $0.151)
    // Gemini 3 Pro - variable resolution (estimated, no official image pricing)
    GEMINI_1K: 0.134,  // gemini-3-pro-image-preview with 1K resolution
    GEMINI_2K: 0.17,   // gemini-3-pro-image-preview with 2K resolution
    GEMINI_4K: 0.24,   // gemini-3-pro-image-preview with 4K resolution
  },
  VIDEO: {
    // Veo 3.1 pricing per second (official docs)
    VEO_STANDARD_PER_SEC: 0.40,  // veo-3.1-generate-preview (720p/1080p)
    VEO_FAST_PER_SEC: 0.15,      // veo-3.1-fast-generate-preview (720p/1080p)
    VEO_STANDARD_4K_PER_SEC: 0.60, // veo-3.1-generate-preview (4K)
    VEO_FAST_4K_PER_SEC: 0.35,     // veo-3.1-fast-generate-preview (4K)
    // Default duration for credit calculations (typical Veo output)
    DEFAULT_DURATION_SEC: 8,
  },
} as const;

/**
 * Get the pricing for a specific image model and resolution
 * @param model - The Gemini model used
 * @param resolution - Optional resolution (only applies to gemini-3-pro-image-preview)
 * @returns Price per image in USD
 */
export function getImagePricing(
  model: GeminiModel | string,
  resolution?: Resolution | string | null
): number {
  // Gemini 2.5 Flash (HD)
  if (model === GEMINI_MODELS.FLASH) {
    return PRICING.IMAGE.GEMINI_2_5;
  }

  // Gemini 3.1 Flash (NB2) - pricing varies by resolution
  if (model === GEMINI_MODELS.NB2) {
    if (resolution === '512px') {
      return PRICING.IMAGE.NB2_512;
    }
    if (resolution === '1K' || resolution === 'HD') {
      return PRICING.IMAGE.NB2_1K;
    }
    if (resolution === '2K') {
      return PRICING.IMAGE.NB2_2K;
    }
    if (resolution === '4K') {
      return PRICING.IMAGE.NB2_4K;
    }
    // Default to 1K if resolution not specified
    return PRICING.IMAGE.NB2_1K;
  }

  // Gemini 3 Pro - pricing varies by resolution
  if (model === GEMINI_MODELS.PRO) {
    if (resolution === '1K' || resolution === 'HD') {
      return PRICING.IMAGE.GEMINI_1K;
    }
    if (resolution === '2K') {
      return PRICING.IMAGE.GEMINI_2K;
    }
    if (resolution === '4K') {
      return PRICING.IMAGE.GEMINI_4K;
    }
    // Default to 1K if resolution not specified
    return PRICING.IMAGE.GEMINI_1K;
  }

  // Fallback to Gemini 2.5 pricing for unknown models
  return PRICING.IMAGE.GEMINI_2_5;
}

/**
 * Calculate total cost for image generation
 * @param imagesCount - Number of images generated
 * @param model - The Gemini model used
 * @param resolution - Optional resolution (only applies to gemini-3-pro-image-preview)
 * @returns Total cost in USD
 */
export function calculateImageCost(
  imagesCount: number,
  model: GeminiModel | string = GEMINI_MODELS.FLASH,
  resolution?: Resolution | string | null
): number {
  const pricePerImage = getImagePricing(model, resolution);
  return imagesCount * pricePerImage;
}

/**
 * Get the pricing for video generation
 * @param model - Veo model (standard or fast)
 * @param durationSec - Video duration in seconds (default: 8)
 * @param is4K - Whether output is 4K resolution
 * @returns Price per video in USD
 */
export function getVideoPricing(
  model: 'standard' | 'fast' = 'standard',
  durationSec: number = PRICING.VIDEO.DEFAULT_DURATION_SEC,
  is4K: boolean = false
): number {
  let pricePerSec: number;

  if (model === 'fast') {
    pricePerSec = is4K ? PRICING.VIDEO.VEO_FAST_4K_PER_SEC : PRICING.VIDEO.VEO_FAST_PER_SEC;
  } else {
    pricePerSec = is4K ? PRICING.VIDEO.VEO_STANDARD_4K_PER_SEC : PRICING.VIDEO.VEO_STANDARD_PER_SEC;
  }

  return pricePerSec * durationSec;
}

/**
 * Calculate total cost for video generation
 * @param videosCount - Number of videos generated (default: 1)
 * @param model - Veo model (standard or fast)
 * @param durationSec - Video duration in seconds (default: 8)
 * @param is4K - Whether output is 4K resolution
 * @returns Total cost in USD
 */
export function calculateVideoCost(
  videosCount: number = 1,
  model: 'standard' | 'fast' = 'standard',
  durationSec: number = PRICING.VIDEO.DEFAULT_DURATION_SEC,
  is4K: boolean = false
): number {
  return videosCount * getVideoPricing(model, durationSec, is4K);
}

/**
 * Check if a resolution is considered high resolution (2K or 4K)
 * @param resolution - The resolution to check
 * @returns true if resolution is 2K or 4K
 */
export function isHighResolution(resolution: string | undefined | null): boolean {
  if (!resolution) return false;
  const resLower = resolution.toLowerCase();
  return resLower.includes('2k') || resLower.includes('4k') || resLower.includes('8k');
}









