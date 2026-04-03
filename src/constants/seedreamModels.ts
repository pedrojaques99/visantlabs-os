import type { Resolution, AspectRatio } from '../types/types';

// ── Model IDs (single source of truth) ────────────────────────────────────────
export const SEEDREAM_MODELS = {
  /** Seedream 4.5 — Latest flagship, t2i + i2i, 2K/4K, batch, up to 14 ref images */
  SD_4_5: 'seedream-4.5' as const,
  /** Seedream 4.0 — t2i + i2i, 1K/2K/4K, batch, up to 14 ref images */
  SD_4_0: 'seedream-4.0' as const,
  /** Seedream 3.0 text-to-image — t2i only, lower res (512px–2K), seed + guidance_scale */
  SD_3_T2I: 'seedream-3.0-t2i' as const,
  /** Seededit 3.0 image-to-image — i2i edit only, adaptive size, seed + guidance_scale */
  SE_3_I2I: 'seededit-3.0-i2i' as const,
} as const;

export type SeedreamModelId = typeof SEEDREAM_MODELS[keyof typeof SEEDREAM_MODELS];

// ── Ordered list for UI display ────────────────────────────────────────────────
export const SEEDREAM_IMAGE_MODELS: SeedreamModelId[] = [
  SEEDREAM_MODELS.SD_4_5,
  SEEDREAM_MODELS.SD_4_0,
  SEEDREAM_MODELS.SD_3_T2I,
  SEEDREAM_MODELS.SE_3_I2I,
];

// ── Per-model configuration ────────────────────────────────────────────────────
export interface SeedreamModelConfig {
  label: string;
  /** Short description shown in UI tooltips */
  description: string;
  /**
   * Maximum reference images (excluding the base/source image).
   * maxTotalImages = maxRefImages + 1 (base). 0 = t2i only, no image input.
   * API hard cap: total input + output images ≤ 15.
   */
  maxRefImages: number;
  /** Whether model requires an input image (i2i only) */
  requiresImage: boolean;
  /** Supports batch output (sequential_image_generation) */
  supportsBatch: boolean;
  /** Supports seed parameter (3.0 models only) */
  supportsSeed: boolean;
  /** Supports guidance_scale parameter (3.0 models only) */
  supportsGuidanceScale: boolean;
  /** Default guidance_scale value (if supported) */
  defaultGuidanceScale?: number;
  /** Resolution keywords accepted by the API (method 1) */
  resolutionKeywords: Resolution[];
  /** Default resolution keyword */
  defaultResolution: Resolution;
  /** Whether size is adaptive (seededit-3.0-i2i — no user size control) */
  adaptiveSize: boolean;
}

export const SEEDREAM_MODEL_CONFIG: Record<SeedreamModelId, SeedreamModelConfig> = {
  [SEEDREAM_MODELS.SD_4_5]: {
    label: 'Seedream 4.5',
    description: 'Latest — 2K/4K, batch, multi-ref',
    maxRefImages: 14,
    requiresImage: false,
    supportsBatch: true,
    supportsSeed: false,
    supportsGuidanceScale: false,
    resolutionKeywords: ['2K', '4K'],
    defaultResolution: '2K',
    adaptiveSize: false,
  },
  [SEEDREAM_MODELS.SD_4_0]: {
    label: 'Seedream 4.0',
    description: '1K/2K/4K, batch, multi-ref',
    maxRefImages: 14,
    requiresImage: false,
    supportsBatch: true,
    supportsSeed: false,
    supportsGuidanceScale: false,
    resolutionKeywords: ['1K', '2K', '4K'],
    defaultResolution: '2K',
    adaptiveSize: false,
  },
  [SEEDREAM_MODELS.SD_3_T2I]: {
    label: 'Seedream 3.0',
    description: 'Text-to-image, seed control',
    maxRefImages: 0,
    requiresImage: false,
    supportsBatch: false,
    supportsSeed: true,
    supportsGuidanceScale: true,
    defaultGuidanceScale: 2.5,
    resolutionKeywords: ['512px', '1K', '2K'],
    defaultResolution: '1K',
    adaptiveSize: false,
  },
  [SEEDREAM_MODELS.SE_3_I2I]: {
    label: 'Seededit 3.0',
    description: 'Image editing, adaptive size',
    maxRefImages: 1,
    requiresImage: true,
    supportsBatch: false,
    supportsSeed: true,
    supportsGuidanceScale: true,
    defaultGuidanceScale: 5.5,
    resolutionKeywords: [],
    defaultResolution: '1K', // unused — adaptiveSize=true
    adaptiveSize: true,
  },
};

// ── Size presets: aspect ratio → pixel dimensions per model ───────────────────
// Used when user selects an aspect ratio and wants pixel-level control (method 2)
export interface SizePreset {
  ratio: AspectRatio;
  /** Pixel dimensions string passed as `size` to the API, e.g. "2048x2048" */
  size: string;
  label?: string;
}

/** Presets for seedream-4.5 and seedream-4.0 (same pixel recommendations per docs) */
export const SEEDREAM_4X_SIZE_PRESETS: SizePreset[] = [
  { ratio: '1:1',  size: '2048x2048' },
  { ratio: '4:3',  size: '2304x1728' },
  { ratio: '3:4',  size: '1728x2304' },
  { ratio: '16:9', size: '2560x1440' },
  { ratio: '9:16', size: '1440x2560' },
  { ratio: '3:2',  size: '2496x1664' },
  { ratio: '2:3',  size: '1664x2496' },
  { ratio: '21:9', size: '3024x1296' },
];

/** Presets for seedream-3.0-t2i (lower res range) */
export const SEEDREAM_3_T2I_SIZE_PRESETS: SizePreset[] = [
  { ratio: '1:1',  size: '1024x1024' },
  { ratio: '4:3',  size: '1152x864'  },
  { ratio: '3:4',  size: '864x1152'  },
  { ratio: '16:9', size: '1280x720'  },
  { ratio: '9:16', size: '720x1280'  },
  { ratio: '3:2',  size: '1248x832'  },
  { ratio: '2:3',  size: '832x1248'  },
  { ratio: '21:9', size: '1512x648'  },
];

/** Get size presets for a given model */
export function getSeedreamSizePresets(model: SeedreamModelId): SizePreset[] {
  switch (model) {
    case SEEDREAM_MODELS.SD_4_5:
    case SEEDREAM_MODELS.SD_4_0:
      return SEEDREAM_4X_SIZE_PRESETS;
    case SEEDREAM_MODELS.SD_3_T2I:
      return SEEDREAM_3_T2I_SIZE_PRESETS;
    case SEEDREAM_MODELS.SE_3_I2I:
      return []; // adaptive size — no user-selectable presets
  }
}

/**
 * Resolve the `size` value to pass to the API for a given model + resolution keyword + aspect ratio.
 * Priority: if aspect ratio is provided, use pixel dimensions (method 2).
 * Otherwise use resolution keyword (method 1) if supported.
 */
export function resolveSeedreamSize(
  model: SeedreamModelId,
  resolution: Resolution,
  aspectRatio?: AspectRatio,
): string | 'adaptive' | undefined {
  const config = SEEDREAM_MODEL_CONFIG[model];

  if (config.adaptiveSize) return 'adaptive';

  // Method 2: exact pixel dimensions from aspect ratio
  if (aspectRatio) {
    const presets = getSeedreamSizePresets(model);
    const match = presets.find(p => p.ratio === aspectRatio);
    if (match) return match.size;
  }

  // Method 1: resolution keyword
  if (config.resolutionKeywords.includes(resolution)) return resolution;

  // Fallback to default resolution
  return config.defaultResolution;
}

// ── Helper functions ───────────────────────────────────────────────────────────

export function isSeedreamModel(model: string): model is SeedreamModelId {
  return Object.values(SEEDREAM_MODELS).includes(model as SeedreamModelId);
}

export function getSeedreamModelConfig(model: string): SeedreamModelConfig | undefined {
  if (!isSeedreamModel(model)) return undefined;
  return SEEDREAM_MODEL_CONFIG[model];
}

export function seedreamSupportsSeed(model: string): boolean {
  return getSeedreamModelConfig(model)?.supportsSeed ?? false;
}

export function seedreamSupportsGuidanceScale(model: string): boolean {
  return getSeedreamModelConfig(model)?.supportsGuidanceScale ?? false;
}

export function seedreamRequiresImage(model: string): boolean {
  return getSeedreamModelConfig(model)?.requiresImage ?? false;
}
