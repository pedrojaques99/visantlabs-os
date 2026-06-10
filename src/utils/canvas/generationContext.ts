/**
 * generationContext
 *
 * Single source of truth for resolving provider, resolution, and aspect ratio
 * from a model ID. Used by all canvas generation handlers and components.
 */

import type {
  GeminiModel,
  SeedreamModel,
  ImageProvider,
  Resolution,
  AspectRatio,
} from '@/types/types';
import {
  isAdvancedModel,
  getDefaultResolution,
  DEFAULT_ASPECT_RATIO,
} from '@/constants/geminiModels';
import { isSeedreamModel, getSeedreamModelConfig } from '@/constants/seedreamModels';
import { isOpenAIImageModel, getOpenAIImageModelConfig } from '@/constants/openaiModels';
import { isImagenModel } from '@/constants/imagenModels';
import { isIdeogramModel } from '@/constants/ideogramModels';
import { isReveModel } from '@/constants/reveModels';

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
    resolution: advanced
      ? overrides.resolution ?? getDefaultResolution(geminiModel) ?? '1K'
      : undefined,
    aspectRatio: advanced ? overrides.aspectRatio ?? DEFAULT_ASPECT_RATIO : undefined,
  };
}

/**
 * Whether a model supports output config controls (aspect ratio + resolution).
 * Single source of truth — used by UI components and generation handlers.
 */
export function supportsOutputConfig(model: string): boolean {
  if (isSeedreamModel(model)) {
    const cfg = getSeedreamModelConfig(model);
    return !cfg?.adaptiveSize;
  }
  if (isOpenAIImageModel(model)) return true;
  return isAdvancedModel(model as GeminiModel);
}

/** Convenience: derive provider only — SSOT for all provider detection */
export function resolveProvider(model: string): ImageProvider {
  if (isSeedreamModel(model)) return 'seedream';
  if (isOpenAIImageModel(model)) return 'openai';
  if (isImagenModel(model)) return 'imagen';
  if (isIdeogramModel(model)) return 'ideogram';
  if (isReveModel(model)) return 'reve';
  return 'gemini';
}
