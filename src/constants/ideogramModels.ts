import type { Resolution, AspectRatio } from '../types/types';

// ── Model IDs (single source of truth) ────────────────────────────────────────
export const IDEOGRAM_MODELS = {
  /** Ideogram V4 — Latest flagship, best text rendering, structured JSON prompts, 2K native */
  V4: 'ideogram-v4' as const,
  /** Ideogram V3 — 60+ style presets, character/style references, color palettes */
  V3: 'ideogram-v3' as const,
} as const;

export type IdeogramModelId = (typeof IDEOGRAM_MODELS)[keyof typeof IDEOGRAM_MODELS];

// ── Ordered list for UI display ────────────────────────────────────────────────
export const IDEOGRAM_MODEL_LIST: IdeogramModelId[] = [IDEOGRAM_MODELS.V4, IDEOGRAM_MODELS.V3];

// ── Rendering speed tiers ─────────────────────────────────────────────────────
export type IdeogramRenderingSpeed = 'FLASH' | 'TURBO' | 'DEFAULT' | 'QUALITY';

export const IDEOGRAM_SPEED_TIERS: { value: IdeogramRenderingSpeed; label: string }[] = [
  { value: 'TURBO', label: 'Turbo' },
  { value: 'DEFAULT', label: 'Default' },
  { value: 'QUALITY', label: 'Quality' },
];

// ── Per-model configuration ────────────────────────────────────────────────────
export interface IdeogramModelConfig {
  label: string;
  badge?: 'latest' | 'popular' | 'fast';
  description: string;
  defaultResolution: Resolution;
  supportedResolutions: Resolution[];
  defaultSpeed: IdeogramRenderingSpeed;
  supportedSpeeds: IdeogramRenderingSpeed[];
  providerDomain: string;
  deprecated?: boolean;
}

export const IDEOGRAM_MODEL_CONFIG: Record<IdeogramModelId, IdeogramModelConfig> = {
  [IDEOGRAM_MODELS.V4]: {
    label: 'Ideogram 4',
    badge: 'latest',
    description: 'Best text rendering, structured prompts, 2K native',
    defaultResolution: '2K',
    supportedResolutions: ['1K', '2K'],
    defaultSpeed: 'DEFAULT',
    supportedSpeeds: ['TURBO', 'DEFAULT', 'QUALITY'],
    providerDomain: 'ideogram.ai',
  },
  [IDEOGRAM_MODELS.V3]: {
    label: 'Ideogram 3',
    badge: 'popular',
    description: '60+ style presets, character refs, color palettes',
    defaultResolution: '1K',
    supportedResolutions: ['1K', '2K'],
    defaultSpeed: 'TURBO',
    supportedSpeeds: ['FLASH', 'TURBO', 'DEFAULT', 'QUALITY'],
    providerDomain: 'ideogram.ai',
  },
};

// ── Aspect ratio mapping (our format → Ideogram format) ───────────────────────
// Ideogram uses "WxH" format (e.g. "16x9"), we use "W:H" (e.g. "16:9")
export const IDEOGRAM_ASPECT_MAP: Partial<Record<AspectRatio, string>> = {
  '1:1': '1x1',
  '16:9': '16x9',
  '9:16': '9x16',
  '4:3': '4x3',
  '3:4': '3x4',
  '3:2': '3x2',
  '2:3': '2x3',
  '4:5': '4x5',
  '5:4': '5x4',
  '21:9': '3x1',
};

// ── Resolution mapping (our format → Ideogram pixel dimensions) ───────────────
export const IDEOGRAM_RESOLUTION_MAP: Record<Resolution, { width: number; height: number } | null> =
  {
    '512px': { width: 512, height: 512 },
    HD: { width: 1024, height: 1024 },
    '1K': { width: 1024, height: 1024 },
    '2K': { width: 1536, height: 1024 },
    '3K': { width: 1536, height: 1024 },
    '4K': { width: 2048, height: 1248 },
    '720p': { width: 1024, height: 1024 },
    '1080p': { width: 1536, height: 1024 },
  };

// ── Helper functions ───────────────────────────────────────────────────────────

export function isIdeogramModel(model: string): model is IdeogramModelId {
  return IDEOGRAM_MODEL_LIST.includes(model as IdeogramModelId);
}

export function getIdeogramModelConfig(model: string): IdeogramModelConfig | undefined {
  return IDEOGRAM_MODEL_CONFIG[model as IdeogramModelId];
}

/**
 * Resolve the Ideogram aspect_ratio param from our AspectRatio type.
 * Falls back to "1x1" if no mapping exists.
 */
export function resolveIdeogramAspectRatio(aspectRatio?: AspectRatio): string {
  if (!aspectRatio) return '1x1';
  return IDEOGRAM_ASPECT_MAP[aspectRatio] ?? '1x1';
}
