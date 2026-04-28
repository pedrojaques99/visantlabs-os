import type { AspectRatio } from '../types/types';

// ── Provider types ─────────────────────────────────────────────────────────────
export type VideoProvider = 'veo' | 'kling';

// ── Shared types ───────────────────────────────────────────────────────────────
export type VideoMode = 'standard' | 'fast' | 'std' | 'pro' | '4k';
export type KlingAspectRatio = '16:9' | '9:16' | '1:1';

// ── Unified model capabilities interface ──────────────────────────────────────
export interface VideoModelCapabilities {
  label: string;
  badge?: 'latest' | 'popular' | 'fast' | 'pro' | 'reasoning';
  provider: VideoProvider;
  providerDomain: string;
  description: string;

  // Quality modes shown in UI
  modes: VideoMode[];
  defaultMode: VideoMode;

  // Duration options as strings (Kling: "5", "10" / Veo: "5s", "10s")
  durations: string[];
  defaultDuration: string;

  // Aspect ratios
  aspectRatios: string[];

  // Capability flags
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsStartEndFrame: boolean;
  supportsMultiShot: boolean;
  supportsCameraControl: boolean;
  supportsMotionBrush: boolean;
  supportsSound: boolean;
  supportsVideoExtension: boolean;
  supportsCfgScale: boolean;
  supportsNegativePrompt: boolean;
  supportsLoop: boolean;
  supportsSeed: boolean;

  // Resolution per mode for display
  resolutionByMode: Partial<Record<VideoMode, string>>;
}

// ── Model IDs ──────────────────────────────────────────────────────────────────
export const VIDEO_MODEL_IDS = {
  // Google Veo
  VEO_3_1: 'veo-3.1-generate-preview',
  VEO_3_1_FAST: 'veo-3.1-fast-generate-preview',
  // Kling
  KLING_V3_OMNI: 'kling-v3-omni',
  KLING_V3: 'kling-v3',
  KLING_V2_6: 'kling-v2-6',
  KLING_V2_5_TURBO: 'kling-v2-5-turbo',
  KLING_V2_1_MASTER: 'kling-v2-1-master',
  KLING_V2_1: 'kling-v2-1',
  KLING_V2_MASTER: 'kling-v2-master',
  KLING_V1_6: 'kling-v1-6',
  KLING_V1_5: 'kling-v1-5',
  KLING_V1: 'kling-v1',
} as const;

export type VideoModelId = typeof VIDEO_MODEL_IDS[keyof typeof VIDEO_MODEL_IDS];

// ── Ordered list for UI display ────────────────────────────────────────────────
export const VIDEO_MODEL_LIST: VideoModelId[] = [
  VIDEO_MODEL_IDS.VEO_3_1,
  VIDEO_MODEL_IDS.VEO_3_1_FAST,
  VIDEO_MODEL_IDS.KLING_V3_OMNI,
  VIDEO_MODEL_IDS.KLING_V3,
  VIDEO_MODEL_IDS.KLING_V2_6,
  VIDEO_MODEL_IDS.KLING_V2_5_TURBO,
  VIDEO_MODEL_IDS.KLING_V2_1_MASTER,
  VIDEO_MODEL_IDS.KLING_V2_1,
  VIDEO_MODEL_IDS.KLING_V2_MASTER,
  VIDEO_MODEL_IDS.KLING_V1_6,
  VIDEO_MODEL_IDS.KLING_V1_5,
  VIDEO_MODEL_IDS.KLING_V1,
];

const VEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1'];
const KLING_ASPECT_RATIOS = ['16:9', '9:16', '1:1'];

// ── Unified capabilities registry ─────────────────────────────────────────────
export const VIDEO_MODEL_CONFIG: Record<VideoModelId, VideoModelCapabilities> = {
  // ── Google Veo ───────────────────────────────────────────────────────────────
  [VIDEO_MODEL_IDS.VEO_3_1]: {
    label: 'Veo 3.1',
    badge: 'latest',
    provider: 'veo',
    providerDomain: 'google.com',
    description: 'Google Veo 3.1 — native audio, 5s/10s',
    modes: ['standard'],
    defaultMode: 'standard',
    durations: ['5s', '10s'],
    defaultDuration: '5s',
    aspectRatios: VEO_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: true,
    supportsVideoExtension: true,
    supportsCfgScale: false,
    supportsNegativePrompt: false,
    supportsLoop: true,
    supportsSeed: true,
    resolutionByMode: { standard: '1080p' },
  },
  [VIDEO_MODEL_IDS.VEO_3_1_FAST]: {
    label: 'Veo 3.1 Fast',
    badge: 'fast',
    provider: 'veo',
    providerDomain: 'google.com',
    description: 'Google Veo 3.1 Fast — lower cost, quicker',
    modes: ['standard', 'fast'],
    defaultMode: 'fast',
    durations: ['5s', '10s'],
    defaultDuration: '5s',
    aspectRatios: VEO_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: true,
    supportsVideoExtension: true,
    supportsCfgScale: false,
    supportsNegativePrompt: false,
    supportsLoop: true,
    supportsSeed: true,
    resolutionByMode: { standard: '720p', fast: '720p' },
  },

  // ── Kling ────────────────────────────────────────────────────────────────────
  [VIDEO_MODEL_IDS.KLING_V3_OMNI]: {
    label: 'Kling v3 Omni',
    badge: 'latest',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Native 4K, 3-15s, multi-shot, omni model',
    modes: ['std', 'pro', '4k'],
    defaultMode: 'pro',
    durations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: true,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: false,
    supportsVideoExtension: false,
    supportsCfgScale: false,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '1080p', '4k': '4K' },
  },
  [VIDEO_MODEL_IDS.KLING_V3]: {
    label: 'Kling v3',
    badge: 'popular',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Native 4K, 3-15s, multi-shot, motion control',
    modes: ['std', 'pro', '4k'],
    defaultMode: 'pro',
    durations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: true,
    supportsCameraControl: true,
    supportsMotionBrush: false,
    supportsSound: false,
    supportsVideoExtension: false,
    supportsCfgScale: false,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '1080p', '4k': '4K' },
  },
  [VIDEO_MODEL_IDS.KLING_V2_6]: {
    label: 'Kling v2.6',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Voice control (pro), motion control, 5s/10s',
    modes: ['std', 'pro'],
    defaultMode: 'pro',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: true,
    supportsVideoExtension: false,
    supportsCfgScale: false,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '1080p' },
  },
  [VIDEO_MODEL_IDS.KLING_V2_5_TURBO]: {
    label: 'Kling v2.5 Turbo',
    badge: 'fast',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Fast generation, std/pro, 5s/10s',
    modes: ['std', 'pro'],
    defaultMode: 'std',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: false,
    supportsVideoExtension: false,
    supportsCfgScale: false,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '1080p' },
  },
  [VIDEO_MODEL_IDS.KLING_V2_1_MASTER]: {
    label: 'Kling v2.1 Master',
    badge: 'pro',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Premium quality, 5s/10s, 1080p',
    modes: ['pro'],
    defaultMode: 'pro',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: false,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: false,
    supportsVideoExtension: false,
    supportsCfgScale: false,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { pro: '1080p' },
  },
  [VIDEO_MODEL_IDS.KLING_V2_1]: {
    label: 'Kling v2.1',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Image-to-video, std/pro, 5s/10s',
    modes: ['std', 'pro'],
    defaultMode: 'pro',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: false,
    supportsVideoExtension: false,
    supportsCfgScale: false,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '1080p' },
  },
  [VIDEO_MODEL_IDS.KLING_V2_MASTER]: {
    label: 'Kling v2 Master',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Balanced quality, 5s/10s, 720p',
    modes: ['pro'],
    defaultMode: 'pro',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: false,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: false,
    supportsVideoExtension: false,
    supportsCfgScale: false,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { pro: '720p' },
  },
  [VIDEO_MODEL_IDS.KLING_V1_6]: {
    label: 'Kling v1.6',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Multi-image, multi-elements, video effects',
    modes: ['std', 'pro'],
    defaultMode: 'std',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: false,
    supportsMotionBrush: false,
    supportsSound: false,
    supportsVideoExtension: true,
    supportsCfgScale: true,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '1080p' },
  },
  [VIDEO_MODEL_IDS.KLING_V1_5]: {
    label: 'Kling v1.5',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Motion brush, camera control (pro), start/end frame',
    modes: ['std', 'pro'],
    defaultMode: 'pro',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: false,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: true,
    supportsMotionBrush: true,
    supportsSound: false,
    supportsVideoExtension: true,
    supportsCfgScale: true,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '1080p' },
  },
  [VIDEO_MODEL_IDS.KLING_V1]: {
    label: 'Kling v1',
    provider: 'kling',
    providerDomain: 'klingai.com',
    description: 'Camera control (std), motion brush, effects',
    modes: ['std', 'pro'],
    defaultMode: 'std',
    durations: ['5', '10'],
    defaultDuration: '5',
    aspectRatios: KLING_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsStartEndFrame: true,
    supportsMultiShot: false,
    supportsCameraControl: true,
    supportsMotionBrush: true,
    supportsSound: false,
    supportsVideoExtension: true,
    supportsCfgScale: true,
    supportsNegativePrompt: true,
    supportsLoop: false,
    supportsSeed: false,
    resolutionByMode: { std: '720p', pro: '720p' },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getVideoModelConfig(model: string): VideoModelCapabilities | undefined {
  return VIDEO_MODEL_CONFIG[model as VideoModelId];
}

export function isKlingModel(model: string): boolean {
  return model.startsWith('kling-');
}

export function isVeoModel(model: string): boolean {
  return model.startsWith('veo-');
}

export function getVideoProvider(model: string): VideoProvider {
  return isKlingModel(model) ? 'kling' : 'veo';
}

/** Build Select options for model picker */
export function buildModelOptions(token = '') {
  return VIDEO_MODEL_LIST.map(id => {
    const cfg = VIDEO_MODEL_CONFIG[id];
    const icon = cfg.providerDomain ? (
      {
        type: 'logo',
        domain: cfg.providerDomain,
        token,
      }
    ) : undefined;
    return {
      value: id,
      label: cfg.label,
      badge: cfg.badge,
      _icon: icon,
    };
  });
}

/** Filter duration options to those valid for a given model */
export function getDurationOptions(model: string): Array<{ value: string; label: string }> {
  const cfg = getVideoModelConfig(model);
  if (!cfg) return [{ value: '5s', label: '5s' }];
  return cfg.durations.map(d => ({ value: d, label: `${d}${isVeoModel(model) ? '' : 's'}` }));
}

/** Filter mode options for a given model */
export function getModeOptions(model: string): Array<{ value: string; label: string }> {
  const cfg = getVideoModelConfig(model);
  if (!cfg || cfg.modes.length <= 1) return [];
  const labels: Record<VideoMode, string> = {
    standard: 'Standard',
    fast: 'Fast',
    std: 'Standard',
    pro: 'Pro',
    '4k': '4K Native',
  };
  return cfg.modes.map(m => ({ value: m, label: labels[m] ?? m }));
}
