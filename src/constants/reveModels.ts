import type { Resolution, AspectRatio } from '../types/types';

// ── Model IDs (single source of truth) ────────────────────────────────────────
export const REVE_MODELS = {
  /** Reve Image 1.0 — Flagship, best text rendering (TypoGuard), 98% prompt adherence */
  REVE_1: 'reve-image-1.0' as const,
} as const;

export type ReveModelId = (typeof REVE_MODELS)[keyof typeof REVE_MODELS];

// ── Ordered list for UI display ────────────────────────────────────────────────
export const REVE_MODEL_LIST: ReveModelId[] = [REVE_MODELS.REVE_1];

// ── Supported aspect ratios ───────────────────────────────────────────────────
export const REVE_ASPECT_RATIOS: AspectRatio[] = [
  '1:1',
  '16:9',
  '9:16',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
];

// ── Per-model configuration ────────────────────────────────────────────────────
export interface ReveModelConfig {
  label: string;
  badge?: 'latest' | 'popular' | 'fast';
  description: string;
  defaultResolution: Resolution;
  supportedResolutions: Resolution[];
  providerDomain: string;
  supportsEdit: boolean;
  supportsRemix: boolean;
  deprecated?: boolean;
}

export const REVE_MODEL_CONFIG: Record<ReveModelId, ReveModelConfig> = {
  [REVE_MODELS.REVE_1]: {
    label: 'Reve 1',
    badge: 'latest',
    description: 'TypoGuard text rendering, 98% prompt adherence',
    defaultResolution: '2K',
    supportedResolutions: ['1K', '2K'],
    providerDomain: 'reve.com',
    supportsEdit: true,
    supportsRemix: true,
  },
};

// ── Aspect ratio mapping (our format → REVE format) ──────────────────────────
// REVE accepts aspect_ratio as "W:H" string — same as ours
export function resolveReveAspectRatio(aspectRatio?: AspectRatio): string {
  if (!aspectRatio) return '1:1';
  if (REVE_ASPECT_RATIOS.includes(aspectRatio)) return aspectRatio;
  return '1:1';
}

// ── Helper functions ───────────────────────────────────────────────────────────

export function isReveModel(model: string): model is ReveModelId {
  return REVE_MODEL_LIST.includes(model as ReveModelId);
}

export function getReveModelConfig(model: string): ReveModelConfig | undefined {
  return REVE_MODEL_CONFIG[model as ReveModelId];
}
