import type { AspectRatio } from '../types/types';

// ── API Base ──────────────────────────────────────────────────────────────────
export const KLING_API_BASE = 'https://api-singapore.klingai.com';

// ── Model IDs (single source of truth) ────────────────────────────────────────
export const KLING_VIDEO_MODELS = {
  /** Kling v3 Omni — Latest, 3-15s, std/pro/4k, multi-shot, native 4K */
  V3_OMNI: 'kling-v3-omni' as const,
  /** Kling v3 — 3-15s, std/pro/4k, multi-shot, motion control */
  V3: 'kling-v3' as const,
  /** Kling v2.6 — std/pro, voice control (pro), motion control */
  V2_6: 'kling-v2-6' as const,
  /** Kling v2.5 Turbo — std/pro, fast generation */
  V2_5_TURBO: 'kling-v2-5-turbo' as const,
  /** Kling v2.1 Master — 5s/10s, premium quality */
  V2_1_MASTER: 'kling-v2-1-master' as const,
  /** Kling v2.1 — std/pro image-to-video */
  V2_1: 'kling-v2-1' as const,
  /** Kling v2 Master — 5s/10s, 720p */
  V2_MASTER: 'kling-v2-master' as const,
  /** Kling v1.6 — std/pro, multi-image, multi-elements */
  V1_6: 'kling-v1-6' as const,
  /** Kling v1.5 — pro image-to-video, motion brush, camera control */
  V1_5: 'kling-v1-5' as const,
  /** Kling v1 — std/pro, camera control (std), motion brush */
  V1: 'kling-v1' as const,
  /** Kling Video O1 — reasoning-based, std/pro, 5s/10s only */
  VIDEO_O1: 'kling-video-o1' as const,
} as const;

export type KlingVideoModelId = typeof KLING_VIDEO_MODELS[keyof typeof KLING_VIDEO_MODELS];

// ── Mode and quality tiers ────────────────────────────────────────────────────
export type KlingMode = 'std' | 'pro' | '4k';

// ── Aspect ratios supported by Kling video API ────────────────────────────────
export const KLING_VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;
export type KlingVideoAspectRatio = typeof KLING_VIDEO_ASPECT_RATIOS[number];

// ── Duration options (seconds as string, per API spec) ────────────────────────
export type KlingDuration = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15';

// ── Ordered list for UI display ────────────────────────────────────────────────
export const KLING_VIDEO_MODEL_LIST: KlingVideoModelId[] = [
  KLING_VIDEO_MODELS.V3_OMNI,
  KLING_VIDEO_MODELS.V3,
  KLING_VIDEO_MODELS.V2_6,
  KLING_VIDEO_MODELS.V2_5_TURBO,
  KLING_VIDEO_MODELS.V2_1_MASTER,
  KLING_VIDEO_MODELS.V2_1,
  KLING_VIDEO_MODELS.V2_MASTER,
  KLING_VIDEO_MODELS.V1_6,
  KLING_VIDEO_MODELS.V1_5,
  KLING_VIDEO_MODELS.V1,
  KLING_VIDEO_MODELS.VIDEO_O1,
];

// ── Per-model configuration ────────────────────────────────────────────────────
export interface KlingVideoModelConfig {
  label: string;
  badge?: 'latest' | 'popular' | 'fast' | 'pro' | 'reasoning';
  description: string;
  /** Supported quality modes */
  supportedModes: KlingMode[];
  defaultMode: KlingMode;
  /** Supported durations in seconds (as strings, per API) */
  supportedDurations: KlingDuration[];
  defaultDuration: KlingDuration;
  /** Max duration depends on mode */
  maxDurationByMode?: Partial<Record<KlingMode, KlingDuration>>;
  /** Supports text-to-video */
  supportsTextToVideo: boolean;
  /** Supports image-to-video (start frame) */
  supportsImageToVideo: boolean;
  /** Supports start + end frame (both frames) */
  supportsStartEndFrame: boolean;
  /** Supports multi-shot generation */
  supportsMultiShot: boolean;
  /** Supports camera control */
  supportsCameraControl: boolean;
  /** Supports motion brush */
  supportsMotionBrush: boolean;
  /** Supports voice control (sound param) */
  supportsSound: boolean;
  /** Supports video extension */
  supportsVideoExtension: boolean;
  /** Supports cfg_scale param (v1.x only) */
  supportsCfgScale: boolean;
  /** Supports negative_prompt */
  supportsNegativePrompt: boolean;
  /** Output resolution by mode */
  resolutionByMode: Partial<Record<KlingMode, string>>;
  /** Domain for Logo.dev */
  providerDomain: string;
}

export const KLING_VIDEO_MODEL_CONFIG: Record<KlingVideoModelId, KlingVideoModelConfig> = {
  [KLING_VIDEO_MODELS.V3_OMNI]: {
    label: 'Kling v3 Omni',
    badge: 'latest',
    description: 'Native 4K, 3-15s, multi-shot, video reference',
    supportedModes: ['std', 'pro', '4k'],
    defaultMode: 'pro',
    supportedDurations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p', '4k': '4K' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V3]: {
    label: 'Kling v3',
    badge: 'popular',
    description: 'Native 4K, 3-15s, multi-shot, motion control',
    supportedModes: ['std', 'pro', '4k'],
    defaultMode: 'pro',
    supportedDurations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p', '4k': '4K' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V2_6]: {
    label: 'Kling v2.6',
    description: 'Voice control (pro), motion control, 5s/10s',
    supportedModes: ['std', 'pro'],
    defaultMode: 'pro',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V2_5_TURBO]: {
    label: 'Kling v2.5 Turbo',
    badge: 'fast',
    description: 'Fast generation, std/pro, 5s/10s',
    supportedModes: ['std', 'pro'],
    defaultMode: 'std',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V2_1_MASTER]: {
    label: 'Kling v2.1 Master',
    badge: 'pro',
    description: 'Premium quality, 5s/10s, 1080p',
    supportedModes: ['pro'],
    defaultMode: 'pro',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { pro: '1080p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V2_1]: {
    label: 'Kling v2.1',
    description: 'Image-to-video, std/pro, 5s/10s',
    supportedModes: ['std', 'pro'],
    defaultMode: 'pro',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V2_MASTER]: {
    label: 'Kling v2 Master',
    description: 'Balanced quality, 5s/10s, 720p',
    supportedModes: ['pro'],
    defaultMode: 'pro',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { pro: '720p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V1_6]: {
    label: 'Kling v1.6',
    description: 'Multi-image, multi-elements, video effects',
    supportedModes: ['std', 'pro'],
    defaultMode: 'std',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V1_5]: {
    label: 'Kling v1.5',
    description: 'Motion brush, camera control (pro), start/end frame',
    supportedModes: ['std', 'pro'],
    defaultMode: 'pro',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.V1]: {
    label: 'Kling v1',
    description: 'Camera control (std), motion brush, effects',
    supportedModes: ['std', 'pro'],
    defaultMode: 'std',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '720p' },
    providerDomain: 'klingai.com',
  },
  [KLING_VIDEO_MODELS.VIDEO_O1]: {
    label: 'Kling Video O1',
    badge: 'reasoning',
    description: 'Reasoning-based generation, 5s/10s only',
    supportedModes: ['std', 'pro'],
    defaultMode: 'pro',
    supportedDurations: ['5', '10'],
    defaultDuration: '5',
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
    resolutionByMode: { std: '720p', pro: '1080p' },
    providerDomain: 'klingai.com',
  },
};

// ── API Endpoint helpers ───────────────────────────────────────────────────────

export const KLING_ENDPOINTS = {
  TEXT_TO_VIDEO: '/v1/videos/text2video',
  IMAGE_TO_VIDEO: '/v1/videos/image2video',
  GET_VIDEO_TASK: (taskId: string) => `/v1/videos/text2video/${taskId}`,
  GET_IMAGE_VIDEO_TASK: (taskId: string) => `/v1/videos/image2video/${taskId}`,
  EXTEND_VIDEO: '/v1/videos/video-extensions',
  IMAGE_GENERATION: '/v1/images/generations',
  GET_IMAGE_TASK: (taskId: string) => `/v1/images/generations/${taskId}`,
  ACCOUNT_INFO: '/v1/account/costs',
} as const;

// ── Camera control types ───────────────────────────────────────────────────────

export type KlingCameraControlType =
  | 'simple'
  | 'down_back'
  | 'forward_up'
  | 'right_turn_forward'
  | 'left_turn_forward';

export interface KlingCameraConfig {
  horizontal?: number;  // [-10, 10]
  vertical?: number;    // [-10, 10]
  pan?: number;         // [-10, 10]
  tilt?: number;        // [-10, 10]
  roll?: number;        // [-10, 10]
  zoom?: number;        // [-10, 10]
}

export interface KlingCameraControl {
  type: KlingCameraControlType;
  config?: KlingCameraConfig;
}

// ── Request / Response types ──────────────────────────────────────────────────

export interface KlingTextToVideoRequest {
  model_name?: KlingVideoModelId;
  prompt?: string;
  negative_prompt?: string;
  /** Whether to generate multi-shot video */
  multi_shot?: boolean;
  shot_type?: 'customize' | 'intelligence';
  multi_prompt?: Array<{ index: number; prompt: string; duration: string }>;
  cfg_scale?: number;
  mode?: KlingMode;
  camera_control?: KlingCameraControl;
  aspect_ratio?: KlingVideoAspectRatio;
  duration?: KlingDuration;
  sound?: 'on' | 'off';
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}

export interface KlingImageToVideoRequest {
  model_name?: KlingVideoModelId;
  prompt?: string;
  negative_prompt?: string;
  /** Base64 or URL of start frame image */
  image?: string;
  /** Base64 or URL of end frame image */
  image_tail?: string;
  cfg_scale?: number;
  mode?: KlingMode;
  aspect_ratio?: KlingVideoAspectRatio;
  duration?: KlingDuration;
  sound?: 'on' | 'off';
  camera_control?: KlingCameraControl;
  callback_url?: string;
  external_task_id?: string;
}

export type KlingTaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed';

export interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_info: { external_task_id?: string };
    task_status: KlingTaskStatus;
    task_status_msg?: string;
    created_at: number;
    updated_at: number;
    task_result?: {
      videos?: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
  };
}

// ── Helper functions ───────────────────────────────────────────────────────────

export function isKlingVideoModel(model: string): model is KlingVideoModelId {
  return Object.values(KLING_VIDEO_MODELS).includes(model as KlingVideoModelId);
}

export function getKlingModelConfig(model: string): KlingVideoModelConfig | undefined {
  if (!isKlingVideoModel(model)) return undefined;
  return KLING_VIDEO_MODEL_CONFIG[model];
}

export function klingSupportsMode(model: string, mode: KlingMode): boolean {
  return getKlingModelConfig(model)?.supportedModes.includes(mode) ?? false;
}

export function klingSupportsTextToVideo(model: string): boolean {
  return getKlingModelConfig(model)?.supportsTextToVideo ?? false;
}

export function klingSupportsImageToVideo(model: string): boolean {
  return getKlingModelConfig(model)?.supportsImageToVideo ?? false;
}

export function klingResolutionForMode(model: string, mode: KlingMode): string | undefined {
  return getKlingModelConfig(model)?.resolutionByMode[mode];
}
