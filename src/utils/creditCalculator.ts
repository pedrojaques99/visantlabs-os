import type { GeminiModel, Resolution, SeedreamModel, ImageProvider } from '../types/types';
import { GEMINI_MODELS, MODEL_CONFIG, AVAILABLE_IMAGE_MODELS } from '../constants/geminiModels';
import { isSeedreamModel } from '../constants/seedreamModels';
import { isOpenAIImageModel } from '../constants/openaiModels';

/**
 * Get credits required for image generation based on model, resolution, and provider
 * This function matches the backend implementation in server/utils/usageTracking.ts
 */
export function getCreditsRequired(
  model: GeminiModel | SeedreamModel | string,
  resolution?: Resolution,
  provider?: ImageProvider
): number {
  // Guard against undefined model
  if (!model) {
    return 2; // Default fallback
  }

  // OpenAI GPT Image 2 (~$0.05-$0.21/image, token-based)
  if (provider === 'openai' || isOpenAIImageModel(model)) {
    switch (resolution) {
      case '512px':
      case 'HD':
      case '1K':
        return 2;
      case '2K':
        return 3;
      case '4K':
        return 4;
      default:
        return 2;
    }
  }

  // Seedream / Seededit models (BytePlus API, ~$0.025-$0.055/image)
  if (provider === 'seedream' || isSeedreamModel(model)) {
    switch (resolution) {
      case '2K':
        return 2;
      case '3K':
        return 3;
      case '4K':
        return 4;
      default:
        return 2;
    }
  }

  // Gemini image models (FLASH/IMAGE_FLASH, NB2/IMAGE_NB2, PRO/IMAGE_PRO are aliases)
  if (model === GEMINI_MODELS.FLASH || model === GEMINI_MODELS.IMAGE_FLASH) {
    return 1;
  }

  if (model === GEMINI_MODELS.NB2 || model === GEMINI_MODELS.IMAGE_NB2) {
    switch (resolution) {
      case '512px':
        return 1;
      case '1K':
      case 'HD':
        return 2;
      case '2K':
        return 3;
      case '4K':
        return 4; // Official: $0.151 / $0.039 = 3.87 → 4 credits
      default:
        return 2;
    }
  }

  if (model === GEMINI_MODELS.PRO || model === GEMINI_MODELS.IMAGE_PRO) {
    switch (resolution) {
      case '1K':
      case 'HD':
        return 3;
      case '2K':
        return 5;
      case '4K':
        return 7;
      default:
        return 3;
    }
  }

  // Veo video models - pricing based on official docs ($0.15-$0.40/sec)
  // Intermediate values balancing real cost vs user experience
  if (String(model).startsWith('veo-')) {
    const isFast = String(model).includes('fast');
    // Fast: 15 credits, Standard: 40 credits
    return isFast ? 15 : 40;
  }

  // Fallback
  return 1;
}

/**
 * Generate credit yield table rows from single source of truth.
 * Used by CreditPackagesModal to show "images per model/resolution".
 */
const IMAGE_RESOLUTIONS: Record<string, Resolution[]> = {
  [GEMINI_MODELS.IMAGE_PRO]: ['1K', '2K', '4K'],
  [GEMINI_MODELS.IMAGE_NB2]: ['512px', '1K', '2K', '4K'],
};

export function getCreditYieldRows(): { label: string; cost: number }[] {
  const rows: { label: string; cost: number }[] = [];

  for (const modelId of AVAILABLE_IMAGE_MODELS) {
    const config = MODEL_CONFIG[modelId];
    if (!config) continue;

    const resolutions = IMAGE_RESOLUTIONS[modelId];
    if (!resolutions) {
      rows.push({ label: config.label, cost: getCreditsRequired(modelId, undefined, 'gemini') });
    } else {
      for (const res of resolutions) {
        rows.push({ label: `${config.label} ${res}`, cost: getCreditsRequired(modelId, res, 'gemini') });
      }
    }
  }

  return rows;
}

/**
 * Get credits required for branding step generation
 * Each step uses gemini-2.5-flash for text generation
 */
export function getBrandingStepCredits(stepNumber: number): number {
  // Each branding step costs 1 credit (using gemini-2.5-flash)
  return 1;
}

/**
 * Get total credits required for complete branding analysis
 */
export function getTotalBrandingCredits(): number {
  // 10 steps total (1-9 analysis steps + moodboard)
  return 10;
}

/**
 * Get credits required for video generation
 * Based on official Veo 3.1 pricing ($0.15-$0.40/sec for 8 second videos)
 * @param model - Veo model identifier
 * @returns Credits required (15 for fast, 40 for standard)
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
 * Get credits required for chat message
 * Rule: 1 credit every 4 messages sent by the user
 * 
 * @param userMessageCount - Total number of messages sent by the user (before adding the new one)
 * @returns Number of credits to deduct (0 or 1)
 * 
 * @example
 * getChatMessageCreditsRequired(1) // 0 - first message
 * getChatMessageCreditsRequired(2) // 0 - second message
 * getChatMessageCreditsRequired(3) // 0 - third message
 * getChatMessageCreditsRequired(4) // 1 - fourth message (charge 1 credit)
 */
export function getChatMessageCreditsRequired(userMessageCount: number): number {
  if (userMessageCount < 0) {
    console.warn('userMessageCount cannot be negative, using 0');
    return 0;
  }

  // Every 4 messages, charge 1 credit
  // If messageCount is a multiple of 4, charge 1 credit
  return userMessageCount % 4 === 0 && userMessageCount > 0 ? 1 : 0;
}

/**
 * Get remaining messages until next credit charge
 * Useful for showing visual indicator in UI
 */
export function getMessagesUntilNextCredit(userMessageCount: number): number {
  const remainder = userMessageCount % 4;
  return remainder === 0 ? 4 : 4 - remainder;
}