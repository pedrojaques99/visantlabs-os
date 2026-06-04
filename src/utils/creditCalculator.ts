import type { GeminiModel, Resolution, SeedreamModel, ImageProvider } from '../types/types';
import { GEMINI_MODELS, MODEL_CONFIG, AVAILABLE_IMAGE_MODELS } from '../constants/geminiModels';
import { isSeedreamModel } from '../constants/seedreamModels';
import { isOpenAIImageModel } from '../constants/openaiModels';
import { isImagenModel } from '../constants/imagenModels';
import { isIdeogramModel } from '../constants/ideogramModels';
import { isReveModel } from '../constants/reveModels';

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

  // Imagen 4 (Google, fixed price per image)
  if (provider === 'imagen' || isImagenModel(model)) {
    const m = String(model);
    if (m.includes('fast')) return 1;
    if (m.includes('ultra')) return 2;
    return resolution === '2K' ? 2 : 1;
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

  // REVE models (~$0.10-0.15/image, 1 Reve credit = 2 Visant credits base)
  if (provider === 'reve' || isReveModel(model)) {
    switch (resolution) {
      case '512px':
      case 'HD':
      case '1K':
        return 2;
      case '2K':
        return 3;
      default:
        return 2;
    }
  }

  // Ideogram models (~$0.03-$0.09/image depending on speed)
  if (provider === 'ideogram' || isIdeogramModel(model)) {
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

  // Veo video models - pricing based on official docs ($0.05-$0.40/sec)
  if (String(model).startsWith('veo-')) {
    const m = String(model);
    if (m.includes('lite')) return 8;
    if (m.includes('fast')) return 15;
    return 40;
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
        rows.push({
          label: `${config.label} ${res}`,
          cost: getCreditsRequired(modelId, res, 'gemini'),
        });
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
export function getVideoCreditsRequired(model?: string, mode?: string): number {
  if (!model) return 20;

  // Seedance — v2 costs more than v1
  if (model.startsWith('seedance-')) {
    if (model.includes('lite')) return 10;
    if (model.includes('fast')) return 20;
    if (model.startsWith('seedance-2')) return 35;
    return 25;
  }

  // Kling — mode-aware pricing
  if (model.startsWith('kling-')) {
    if (model === 'kling-video-o1') return mode === 'pro' ? 35 : 25;
    if (model.includes('v3-omni') || model.includes('v3')) {
      if (mode === '4k') return 40;
      if (mode === 'pro') return 30;
      return 20;
    }
    if (model.includes('master')) return 30;
    if (model.includes('turbo')) return 15;
    const isPro = mode === 'pro';
    return isPro ? 25 : 20;
  }

  // Veo
  if (model.includes('lite')) return 8;
  if (model.includes('fast')) return 15;
  return 40;
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
