// Centralized pricing for Gemini and Veo models
// Single source of truth for all pricing calculations

import type { GeminiModel, Resolution } from '../types';

/**
 * Pricing constants (in USD)
 */
export const PRICING = {
  IMAGE: {
    GEMINI_2_5: 0.039, // gemini-2.5-flash-image
    GEMINI_1K: 0.134,  // gemini-3-pro-image-preview with 1K resolution
    GEMINI_2K: 0.17,   // gemini-3-pro-image-preview with 2K resolution
    GEMINI_4K: 0.24,   // gemini-3-pro-image-preview with 4K resolution
  },
  VIDEO: {
    VEO_3: 1.60, // All Veo 3 models (veo-3.1-generate-preview, veo-3, etc.)
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
  // Gemini 2.5 Flash
  if (model === 'gemini-2.5-flash-image') {
    return PRICING.IMAGE.GEMINI_2_5;
  }

  // Gemini 3 Pro - pricing varies by resolution
  if (model === 'gemini-3-pro-image-preview') {
    if (resolution === '1K') {
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
  model: GeminiModel | string = 'gemini-2.5-flash-image',
  resolution?: Resolution | string | null
): number {
  const pricePerImage = getImagePricing(model, resolution);
  return imagesCount * pricePerImage;
}

/**
 * Get the pricing for video generation
 * @returns Price per video in USD
 */
export function getVideoPricing(): number {
  return PRICING.VIDEO.VEO_3;
}

/**
 * Calculate total cost for video generation
 * @param videosCount - Number of videos generated (default: 1)
 * @returns Total cost in USD
 */
export function calculateVideoCost(videosCount: number = 1): number {
  return videosCount * PRICING.VIDEO.VEO_3;
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




