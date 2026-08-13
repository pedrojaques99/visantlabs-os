// Usage tracking utilities for Gemini API billing

import { calculateImageCost } from '../../src/utils/pricing.js';
import type { GeminiModel, Resolution } from '../../src/types/types.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { OPENAI_IMAGE_MODELS, isOpenAIImageModel } from '../../src/constants/openaiModels.js';
import { isSeedreamModel } from '../../src/constants/seedreamModels.js';
import { isImagenModel } from '../../src/constants/imagenModels.js';
import { isIdeogramModel } from '../../src/constants/ideogramModels.js';
import { isReveModel } from '../../src/constants/reveModels.js';
import { lookupCredits } from '../lib/pricing-data.js';
import { computeCost, isFreeModel } from '../lib/ai/cost.js';

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
  byok?: boolean; // BYOK v2 analytics: true when the user's own key covered the AI cost (0 credits)
  // §3.3 generation_created enrichment (Fase 3): was this generation on-brand,
  // and from which surface? Powers the "% on-brand" activation metric (meta 80%).
  brandGuidelineId?: string; // Brand used as context, when any
  onBrand?: boolean; // true when a brandGuidelineId was attached to the generation
  surface?: GenerationSurface; // 'ui' (default) | 'mcp' | 'copilot'
}

export type GenerationSurface = 'ui' | 'mcp' | 'copilot';

// A tabela de preço de texto mudou de casa: `server/lib/ai/cost.ts`, junto com a de imagem e
// vídeo. Duas tabelas do mesmo preço divergem em silêncio.

/**
 * Get credits required for image generation based on model and resolution.
 * Derives values from CREDIT_COSTS in pricing-data.ts (single source of truth).
 */
export function getCreditsRequired(model: GeminiModel | string, resolution?: Resolution): number {
  const lookup = lookupCredits(
    model,
    resolution
      ? `${resolution}${resolution === '1K' || resolution === 'HD' ? ' (HD)' : ''}`
      : undefined
  );
  if (lookup !== undefined) return lookup;

  if (isOpenAIImageModel(model)) {
    switch (resolution) {
      case '512px':
      case 'HD':
      case '1K':
        return 2;
      case '2K':
        return 3;
      case '4K':
        return 4;
      case '1080p':
        return 3;
      default:
        return 2;
    }
  }

  if (isReveModel(model)) {
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

  if (isIdeogramModel(model)) {
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

  if (isSeedreamModel(model)) {
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

  if (model === GEMINI_MODELS.FLASH || model === GEMINI_MODELS.IMAGE_FLASH) return 1;

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
        return 4;
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

  return 1;
}

/**
 * Get credits required for video generation.
 * Covers Veo, Seedance, and Kling models.
 *
 * This is the REAL charging path (server/routes/video.ts calls this — not
 * lookupCredits/CREDIT_COSTS, which only feeds the public /api/docs/pricing
 * payload). Veo Fast/Standard were sold below cost (~$0.08/credit vs the
 * ~$0.072/credit price-per-credit floor from the 500-credit package) — bumped
 * here to match the corrected CREDIT_COSTS entries in pricing-data.ts:
 * Fast 15→20, Standard 40→50. Seedance and Kling are priced even further
 * below cost (see pricing-data.ts CREDIT_COSTS for the per-model math) but are
 * intentionally left untouched pending explicit confirmation.
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
  return isFast ? 20 : 50;
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
 * Calculate cost for text generation (tokens-based).
 * Reexportado de `server/lib/ai/cost.ts` — a tabela de preço mora lá, junto com a de imagem e
 * vídeo, pra não existirem duas contas do mesmo gasto.
 */
export { calculateTextGenerationCost } from '../lib/ai/cost.js';

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
  outputTokens?: number,
  // New optional params at the END of the signature (repo rule).
  brandGuidelineId?: string | null,
  surface?: GenerationSurface
): UsageRecord {
  // Custo pela MESMA conta do portão (`server/lib/ai/cost.ts`).
  // A versão anterior cobrava só imagem OU token, então vídeo — que não é nenhum dos dois —
  // caía em `cost: 0`. Foi assim que 11 registros de Veo entraram zerados em dez/2025.
  const cost = computeCost(model, {
    images: imagesGenerated,
    inputTokens,
    outputTokens,
    resolution,
  });

  if (cost === 0 && !isFreeModel(model) && (imagesGenerated > 0 || inputTokens || outputTokens)) {
    console.warn(`[usage] custo 0 num modelo pago — ${model}. Confira src/utils/pricing.ts.`);
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
    // BYOK v2: usage is still recorded (analytics) even though AI cost = 0 credits.
    // Monetization of BYOK comes from maxBrands, not from a platform fee here.
    byok: apiKeySource === 'user',
    // §3.3: on-brand generation tracking (aha-moment metric).
    ...(brandGuidelineId ? { brandGuidelineId } : {}),
    onBrand: !!brandGuidelineId,
    surface: surface || 'ui',
  };
}
