import type { GeminiModel, Resolution, AspectRatio } from '../types/types';

// ── Model IDs (single source of truth) ─────────────────────────────────────
export const GEMINI_MODELS = {
  /** High-end intelligence for branding strategy & complex reasoning */
  PRO_2_0: 'gemini-2.0-pro-exp-02-05' as const,
  /** Fast, multimodal, and reliable for most tasks */
  FLASH_2_0: 'gemini-2.0-flash' as const,
  /** Professional grade with massive context window (2M tokens) */
  PRO_1_5: 'gemini-1.5-pro' as const,
  /** Lightweight and optimized for cost/speed */
  FLASH_1_5: 'gemini-1.5-flash' as const,
  /** Image generation models */
  IMAGE_FLASH: 'gemini-2.5-flash-image' as const,
  IMAGE_NB2: 'gemini-3.1-flash-image-preview' as const,
  IMAGE_PRO: 'gemini-3-pro-image-preview' as const,
  // Backward-compatible aliases (deprecated, use IMAGE_* variants)
  FLASH: 'gemini-2.5-flash-image' as const,
  NB2: 'gemini-3.1-flash-image-preview' as const,
  PRO: 'gemini-3-pro-image-preview' as const,
  // Text model alias (for chat/non-image generation)
  TEXT: 'gemini-2.0-flash' as const,
} as const;

export const DEFAULT_MODEL: GeminiModel = GEMINI_MODELS.PRO_2_0;
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
  [GEMINI_MODELS.PRO_2_0]: {
    label: 'Gemini 2.0 Pro',
    emoji: '🧠',
    maxHandles: 4,
    maxRefImages: 5,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: true,
    supportsSearchGrounding: true,
    inputTokenLimit: 2_000_000,
  },
  [GEMINI_MODELS.FLASH_2_0]: {
    label: 'Gemini 2.0 Flash',
    emoji: '⚡',
    maxHandles: 4,
    maxRefImages: 10,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: true,
    inputTokenLimit: 1_000_000,
  },
  [GEMINI_MODELS.PRO_1_5]: {
    label: 'Gemini 1.5 Pro',
    emoji: '💎',
    maxHandles: 4,
    maxRefImages: 5,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 2_000_000,
  },
  [GEMINI_MODELS.FLASH_1_5]: {
    label: 'Gemini 1.5 Flash',
    emoji: '🚀',
    maxHandles: 2,
    maxRefImages: 1,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 1_000_000,
  },
  [GEMINI_MODELS.IMAGE_FLASH]: {
    label: 'Image HD',
    emoji: '🎨',
    maxHandles: 2,
    maxRefImages: 1,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 65_536,
  },
  [GEMINI_MODELS.IMAGE_NB2]: {
    label: 'NB2',
    emoji: '💎',
    maxHandles: 4,
    maxRefImages: 3,
    defaultResolution: '1K',
    supportsImageConfig: true,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 65_536,
  },
  [GEMINI_MODELS.IMAGE_PRO]: {
    label: 'Pro',
    emoji: '💎',
    maxHandles: 4,
    maxRefImages: 5,
    defaultResolution: '1K',
    supportsImageConfig: true,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 65_536,
  },
};

/** List of models suitable for Chat/Expert conversation */
export const CHAT_MODELS: string[] = [
  GEMINI_MODELS.PRO_2_0,
  GEMINI_MODELS.FLASH_2_0,
  GEMINI_MODELS.PRO_1_5,
  GEMINI_MODELS.FLASH_1_5,
];

export const IMAGE_MODELS: string[] = [
  GEMINI_MODELS.IMAGE_FLASH,
  GEMINI_MODELS.IMAGE_NB2,
  GEMINI_MODELS.IMAGE_PRO,
];

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
  return MODEL_CONFIG[model] ?? MODEL_CONFIG[GEMINI_MODELS.FLASH_2_0];
}

/** All image generation model IDs (excludes text-only) */
export const AVAILABLE_IMAGE_MODELS: GeminiModel[] = [
  GEMINI_MODELS.IMAGE_FLASH,
  GEMINI_MODELS.IMAGE_NB2,
  GEMINI_MODELS.IMAGE_PRO,
];
