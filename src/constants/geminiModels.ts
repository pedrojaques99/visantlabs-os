import type { GeminiModel, Resolution, AspectRatio } from '../types/types';

// ── Model IDs (single source of truth) ─────────────────────────────────────
// Official names: https://ai.google.dev/gemini-api/docs/image-generation
//   Nano Banana    = gemini-2.5-flash-image         (speed, no resolution control, up to 3 ref images)
//   Nano Banana 2  = gemini-3.1-flash-image-preview (2K default, up to 10 ref images, 512px–4K)
//   Nano Banana Pro = gemini-3-pro-image-preview    (reasoning, text rendering, up to 14 ref images, 1K–4K)
export const GEMINI_MODELS = {
  /** Gemini 3.5 Flash — Most intelligent, sustained frontier performance */
  FLASH_3_5: 'gemini-3.5-flash' as const,
  /** Gemini 3.1 Pro - Flagship intelligence (1M tokens) */
  PRO_3_1: 'gemini-3.1-pro-preview' as const,
  /** Gemini 3 Flash - Optimized for performance and reasoning */
  FLASH_3: 'gemini-3-flash-preview' as const,
  /** Gemini 3.1 Flash Lite - Most cost-efficient high-volume model */
  FLASH_3_LITE: 'gemini-3.1-flash-lite-preview' as const,
  /** High-end intelligence for branding strategy & complex reasoning */
  PRO_2_0: 'gemini-3.1-pro-preview' as const,
  /** Gemini 2.5 Flash — Fast text/chat model */
  FLASH_2_5: 'gemini-2.5-flash' as const,
  /** Nano Banana — Fast image gen, no resolution control, up to 3 ref images */
  IMAGE_FLASH: 'gemini-2.5-flash-image' as const,
  /** Nano Banana 2 — High-perf 2K multimodal generation, up to 10 ref images, 512px–4K */
  IMAGE_NB2: 'gemini-3.1-flash-image-preview' as const,
  /** Nano Banana Pro — Reasoning + text rendering, up to 14 ref images, 1K–4K */
  IMAGE_PRO: 'gemini-3-pro-image-preview' as const,
  // Backward-compatible aliases (deprecated, use IMAGE_* variants)
  FLASH: 'gemini-2.5-flash-image' as const,
  NB2: 'gemini-3.1-flash-image-preview' as const,
  PRO: 'gemini-3-pro-image-preview' as const,
  // Text model alias (for chat/non-image generation)
  TEXT: 'gemini-3-flash-preview' as const,
} as const;

export const DEFAULT_MODEL: GeminiModel = GEMINI_MODELS.IMAGE_NB2;
export const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';

/**
 * Providers da cascata de texto do backend. Espelha `CheapTextProviderId` em
 * `server/lib/ai-providers/cheapText.ts` — se um lado mudar, o outro precisa
 * mudar junto (há teste de paridade).
 */
export type TextProvider = 'gemini' | 'openai' | 'groq' | 'cerebras' | 'nvidia' | 'openrouter';

/** Rótulo legível por provider, para agrupar o seletor. */
export const TEXT_PROVIDER_LABELS: Record<TextProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  groq: 'Groq',
  cerebras: 'Cerebras',
  nvidia: 'NVIDIA',
  openrouter: 'OpenRouter',
};

// ── Per-model configuration ────────────────────────────────────────────────
export interface ModelConfig {
  label: string;
  badge?: 'latest' | 'popular' | 'fast' | 'edit';
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
  /** Domain for Logo.dev integration */
  providerDomain?: string;
  /**
   * Provider da cascata de texto (`server/lib/ai-providers/cheapText.ts`).
   * Ausente = gemini, que era a premissa implícita quando tudo aqui era Gemini.
   * O seletor usa isto para agrupar e para esconder provider sem chave.
   */
  provider?: TextProvider;
  /** Hidden by default in selectors, shown when user expands "older models" */
  deprecated?: boolean;
}

export const MODEL_CONFIG: Record<string, ModelConfig> = {
  [GEMINI_MODELS.FLASH_3_5]: {
    label: 'Gemini 3.5 Flash',
    badge: 'latest',
    emoji: '🚀',
    maxHandles: 4,
    maxRefImages: 5,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: true,
    supportsSearchGrounding: true,
    inputTokenLimit: 1_000_000,
    providerDomain: 'google.com',
  },
  [GEMINI_MODELS.PRO_3_1]: {
    label: 'Gemini 3.1 Pro',
    emoji: '🌌',
    maxHandles: 4,
    maxRefImages: 5,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: true,
    supportsSearchGrounding: true,
    inputTokenLimit: 1_000_000,
    providerDomain: 'google.com',
  },
  [GEMINI_MODELS.FLASH_3]: {
    label: 'Gemini 3 Flash',
    emoji: '⚡',
    maxHandles: 4,
    maxRefImages: 10,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: true,
    inputTokenLimit: 1_000_000,
    providerDomain: 'google.com',
  },
  [GEMINI_MODELS.FLASH_3_LITE]: {
    label: 'Gemini 3.1 Lite',
    emoji: '💎',
    maxHandles: 2,
    maxRefImages: 1,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 1_000_000,
    providerDomain: 'google.com',
  },
  [GEMINI_MODELS.FLASH_2_5]: {
    label: 'Gemini 2.5 Flash',
    emoji: '⚡',
    maxHandles: 4,
    maxRefImages: 10,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: true,
    inputTokenLimit: 1_000_000,
    providerDomain: 'google.com',
    deprecated: true,
  },
  [GEMINI_MODELS.IMAGE_FLASH]: {
    label: 'Nano Banana',
    badge: 'fast',
    emoji: '🎨',
    maxHandles: 2,
    maxRefImages: 3,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 65_536,
    providerDomain: 'google.com',
    deprecated: true,
  },
  [GEMINI_MODELS.IMAGE_NB2]: {
    label: 'Nano Banana 2',
    badge: 'popular',
    emoji: '🍌',
    maxHandles: 4,
    maxRefImages: 10,
    defaultResolution: '2K',
    supportsImageConfig: true,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 1_000_000,
    providerDomain: 'google.com',
  },
  [GEMINI_MODELS.IMAGE_PRO]: {
    label: 'Nano Banana Pro',
    badge: 'latest',
    emoji: '💎',
    maxHandles: 4,
    maxRefImages: 14,
    defaultResolution: '1K',
    supportsImageConfig: true,
    supportsThinking: true,
    supportsSearchGrounding: false,
    inputTokenLimit: 65_536,
    providerDomain: 'google.com',
  },

  // ── Texto, não-Gemini ────────────────────────────────────────────────────
  // Campos de imagem (maxHandles/maxRefImages/resolution) existem só porque o
  // ModelConfig é compartilhado com o seletor de imagem; não valem para chat.
  'gpt-4o': {
    label: 'GPT-4o',
    // `popular` para aparecer SEM "Show all models". O seletor esconde por
    // padrão tudo que não é latest/popular — e uma alternativa ao Gemini que só
    // aparece depois de expandir não serve para quando o Gemini está fora.
    badge: 'popular',
    emoji: '🧠',
    maxHandles: 0,
    maxRefImages: 0,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 128_000,
    providerDomain: 'openai.com',
    provider: 'openai',
  },
  'gpt-4o-mini': {
    label: 'GPT-4o mini',
    badge: 'fast',
    emoji: '⚡',
    maxHandles: 0,
    maxRefImages: 0,
    defaultResolution: undefined,
    supportsImageConfig: false,
    supportsThinking: false,
    supportsSearchGrounding: false,
    inputTokenLimit: 128_000,
    providerDomain: 'openai.com',
    provider: 'openai',
  },
};

/**
 * Modelos de texto de OUTROS providers da cascata. Só IDs que o backend já
 * roda (`cheapText.ts`) — o seletor não pode oferecer o que a cascata não sabe
 * chamar. Os providers Llama (groq/cerebras/nvidia/openrouter) ficam de fora
 * de propósito: são env-only, sem BYOK, e existem como fallback automático —
 * escolhê-los à mão não agrega para o usuário final.
 */
export const OPENAI_CHAT_MODELS = {
  GPT_4O: 'gpt-4o' as const,
  GPT_4O_MINI: 'gpt-4o-mini' as const,
};

/** List of models suitable for Chat/Expert conversation */
export const CHAT_MODELS: string[] = [
  GEMINI_MODELS.FLASH_3_5,
  GEMINI_MODELS.PRO_3_1,
  GEMINI_MODELS.FLASH_3,
  GEMINI_MODELS.FLASH_2_5,
  OPENAI_CHAT_MODELS.GPT_4O,
  OPENAI_CHAT_MODELS.GPT_4O_MINI,
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
  return MODEL_CONFIG[model] ?? MODEL_CONFIG[GEMINI_MODELS.FLASH_2_5];
}

/**
 * Provider de texto de um modelo. Default gemini — era a premissa implícita
 * antes de a cascata existir, e todo modelo Gemini continua sem `provider`.
 */
export function textProviderForModel(modelId: string): TextProvider {
  return MODEL_CONFIG[modelId]?.provider ?? 'gemini';
}

/** Resolve any model ID to a human-readable display name */
export function getModelDisplayName(modelId: string): string {
  if (MODEL_CONFIG[modelId]) return MODEL_CONFIG[modelId].label;
  if (modelId.includes('veo') && modelId.includes('fast')) return 'Veo Fast';
  if (modelId.includes('veo')) return 'Veo Standard';
  return modelId;
}

/** All image generation model IDs (excludes text-only) */
export const AVAILABLE_IMAGE_MODELS: GeminiModel[] = [
  GEMINI_MODELS.IMAGE_FLASH,
  GEMINI_MODELS.IMAGE_NB2,
  GEMINI_MODELS.IMAGE_PRO,
];
