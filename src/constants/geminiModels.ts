import type { GeminiModel, Resolution, AspectRatio } from '../types/types';

// ── Model IDs (single source of truth) ─────────────────────────────────────
export const GEMINI_MODELS = {
  /** Nano Banana - legacy high-speed model, 1024px fixed */
  FLASH: 'gemini-2.5-flash-image' as const,
  /** Nano Banana 2 - high-efficiency with 512px/1K/2K/4K, thinking, image search */
  NB2: 'gemini-3.1-flash-image-preview' as const,
  /** Nano Banana Pro - professional asset production with thinking + search */
  PRO: 'gemini-3-pro-image-preview' as const,
  /** Text-only model for prompt generation, analysis, etc. */
  TEXT: 'gemini-2.5-flash' as const,
} as const;

export const DEFAULT_MODEL: GeminiModel = GEMINI_MODELS.FLASH;
export const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';

// ── Per-model configuration ────────────────────────────────────────────────
export interface ModelConfig {
  label: string;
  emoji: string;
  /** Max input image handles on canvas nodes */
  maxHandles: number;
  /** Max reference images (excluding the base image) */
  maxRefImages: number;
  /** Default resolution when model is first selected (undefined = no resolution control) */
  defaultResolution: Resolution | undefined;
  /** Whether the model supports resolution/aspectRatio via imageConfig */
  supportsImageConfig: boolean;
  /** Whether the model supports thinkingConfig */
  supportsThinking: boolean;
  /** Whether the model supports Google Search grounding */
  supportsSearchGrounding: boolean;
  /** Input token limit from official docs */
  inputTokenLimit: number;
}

export const MODEL_CONFIG: Record<string, ModelConfig> = {
  [GEMINI_MODELS.FLASH]: {
    label: 'HD',
    emoji: '⛏️',
    maxHandles: 2,
    maxRefImages: 1,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 65_536,
  },
  [GEMINI_MODELS.NB2]: {
    label: 'NB2',
    emoji: '🍌',
    maxHandles: 4,
    maxRefImages: 13,
    defaultResolution: '1K',
    supportsImageConfig: true,
    supportsThinking: true,
    supportsSearchGrounding: true,
    inputTokenLimit: 131_072,
  },
  [GEMINI_MODELS.PRO]: {
    label: '4K Pro',
    emoji: '⛏️💎',
    maxHandles: 4,
    maxRefImages: 3,
    defaultResolution: '4K',
    supportsImageConfig: true,
    supportsThinking: true,
    supportsSearchGrounding: true,
    inputTokenLimit: 65_536,
  },
};

// ── Helper functions ───────────────────────────────────────────────────────

/** Check if model supports resolution/aspectRatio controls (imageConfig API) */
export function isAdvancedModel(model: string): boolean {
  return MODEL_CONFIG[model]?.supportsImageConfig === true;
}

/** Get max input handles for canvas nodes */
export function getMaxHandles(model: string): number {
  return MODEL_CONFIG[model]?.maxHandles ?? 2;
}

/** Get max reference images (excludes base image) */
export function getMaxRefImages(model: string): number {
  return MODEL_CONFIG[model]?.maxRefImages ?? 1;
}

/** Get total max images (base + references) */
export function getMaxTotalImages(model: string): number {
  return 1 + getMaxRefImages(model);
}

/** Get default resolution for a model (undefined = no resolution control) */
export function getDefaultResolution(model: string): Resolution | undefined {
  return MODEL_CONFIG[model]?.defaultResolution;
}

/** Get model config, falling back to FLASH config */
export function getModelConfig(model: string): ModelConfig {
  return MODEL_CONFIG[model] ?? MODEL_CONFIG[GEMINI_MODELS.FLASH];
}

/** All image generation model IDs (excludes text-only) */
export const IMAGE_MODELS: GeminiModel[] = [
  GEMINI_MODELS.FLASH,
  GEMINI_MODELS.NB2,
  GEMINI_MODELS.PRO,
];
