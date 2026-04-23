/**
 * generationContext
 *
 * Single source of truth for resolving provider, resolution, and aspect ratio
 * from a model ID. Used by all canvas generation handlers and components.
 */

import type { GeminiModel, SeedreamModel, ImageProvider, Resolution, AspectRatio } from '@/types/types';
import { isAdvancedModel, getDefaultResolution, DEFAULT_ASPECT_RATIO } from '@/constants/geminiModels';
import { isSeedreamModel, getSeedreamModelConfig } from '@/constants/seedreamModels';
import { isOpenAIImageModel, getOpenAIImageModelConfig } from '@/constants/openaiModels';

export interface GenerationContext {
  provider: ImageProvider;
  /** Effective resolution to pass to the API (undefined for basic Gemini models that don't use it) */
  resolution: Resolution | undefined;
  /** Effective aspect ratio (undefined for basic Gemini models) */
  aspectRatio: AspectRatio | undefined;
}

export interface GenerationContextOverrides {
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
}

/**
 * Derive the full generation context (provider + resolution + aspectRatio)
 * from a model ID and optional user overrides.
 *
 * Rules:
 * - Seedream models: always 'seedream' provider, resolution required (default from config)
 * - Gemini advanced models: 'gemini' provider, resolution required (default from config)
 * - Gemini basic models: 'gemini' provider, no resolution/aspectRatio (API ignores them)
 */
export function resolveGenerationContext(
  model: GeminiModel | SeedreamModel | string,
  overrides: GenerationContextOverrides = {}
): GenerationContext {
  if (isSeedreamModel(model)) {
    const sdConfig = getSeedreamModelConfig(model);
    return {
      provider: 'seedream',
      resolution: overrides.resolution ?? sdConfig?.defaultResolution ?? '2K',
      aspectRatio: overrides.aspectRatio ?? DEFAULT_ASPECT_RATIO,
    };
  }

  if (isOpenAIImageModel(model)) {
    const oaiConfig = getOpenAIImageModelConfig(model);
    return {
      provider: 'openai',
      resolution: overrides.resolution ?? oaiConfig?.defaultResolution ?? '1K',
      aspectRatio: overrides.aspectRatio ?? DEFAULT_ASPECT_RATIO,
    };
  }

  const geminiModel = model as GeminiModel;
  const advanced = isAdvancedModel(geminiModel);
  return {
    provider: 'gemini',
    resolution: advanced ? (overrides.resolution ?? getDefaultResolution(geminiModel) ?? '1K') : undefined,
    aspectRatio: advanced ? (overrides.aspectRatio ?? DEFAULT_ASPECT_RATIO) : undefined,
  };
}

/** Convenience: derive provider only */
export function resolveProvider(model: string): ImageProvider {
  return isSeedreamModel(model) ? 'seedream' : isOpenAIImageModel(model) ? 'openai' : 'gemini';
}
