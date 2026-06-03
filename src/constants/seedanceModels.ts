// ── Seedance (BytePlus) Video Models ──────────────────────────────────────────

export type SeedanceVideoProvider = 'seedance';

// ── Model IDs ──────────────────────────────────────────────────────────────────
export const SEEDANCE_VIDEO_MODELS = {
  V2_0: 'seedance-2-0' as const,
  V2_0_FAST: 'seedance-2-0-fast' as const,
  V1_5_PRO: 'seedance-1-5-pro' as const,
  V1_0_PRO: 'seedance-1-0-pro' as const,
  V1_0_PRO_FAST: 'seedance-1-0-pro-fast' as const,
  V1_0_LITE: 'seedance-1-0-lite' as const,
} as const;

export type SeedanceVideoModelId =
  (typeof SEEDANCE_VIDEO_MODELS)[keyof typeof SEEDANCE_VIDEO_MODELS];

// ── Ordered list for UI display ────────────────────────────────────────────────
export const SEEDANCE_VIDEO_MODEL_LIST: SeedanceVideoModelId[] = [
  SEEDANCE_VIDEO_MODELS.V2_0,
  SEEDANCE_VIDEO_MODELS.V2_0_FAST,
  SEEDANCE_VIDEO_MODELS.V1_5_PRO,
  SEEDANCE_VIDEO_MODELS.V1_0_PRO,
  SEEDANCE_VIDEO_MODELS.V1_0_PRO_FAST,
  SEEDANCE_VIDEO_MODELS.V1_0_LITE,
];

// ── Capabilities interface ─────────────────────────────────────────────────────
export interface SeedanceVideoModelConfig {
  label: string;
  badge?: 'latest' | 'popular' | 'fast' | 'pro' | 'lite';
  description: string;
  providerDomain: string;
  deprecated?: boolean;

  durations: string[];
  defaultDuration: string;
  aspectRatios: string[];

  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsAudioInput: boolean;
  supportsVideoInput: boolean;
  supportsGenerateAudio: boolean;
  supportsDraftMode: boolean;
  supportsLastFrameReturn: boolean;
  supportsFlexTier: boolean;
}

// ── Shared aspect ratio presets ────────────────────────────────────────────────
const SEEDANCE_V2_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const SEEDANCE_V1_ASPECT_RATIOS = ['16:9', '9:16', '1:1'];

// ── Capabilities registry ──────────────────────────────────────────────────────
export const SEEDANCE_VIDEO_MODEL_CONFIG: Record<SeedanceVideoModelId, SeedanceVideoModelConfig> = {
  [SEEDANCE_VIDEO_MODELS.V2_0]: {
    label: 'Seedance 2.0',
    badge: 'latest',
    description: 'Multimodal (text+image+video+audio), audio generation, 5s/10s',
    providerDomain: 'bytedance.com',
    durations: ['5s', '10s'],
    defaultDuration: '5s',
    aspectRatios: SEEDANCE_V2_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudioInput: true,
    supportsVideoInput: true,
    supportsGenerateAudio: true,
    supportsDraftMode: false,
    supportsLastFrameReturn: true,
    supportsFlexTier: true,
  },
  [SEEDANCE_VIDEO_MODELS.V2_0_FAST]: {
    label: 'Seedance 2.0 Fast',
    badge: 'fast',
    description: 'Multimodal fast variant — lower cost, quicker generation',
    providerDomain: 'bytedance.com',
    durations: ['5s', '10s'],
    defaultDuration: '5s',
    aspectRatios: SEEDANCE_V2_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudioInput: true,
    supportsVideoInput: true,
    supportsGenerateAudio: true,
    supportsDraftMode: false,
    supportsLastFrameReturn: true,
    supportsFlexTier: true,
  },
  [SEEDANCE_VIDEO_MODELS.V1_5_PRO]: {
    label: 'Seedance 1.5 Pro',
    badge: 'pro',
    description: 'Image-to-video + text-to-video, audio, draft mode, 5s/10s',
    providerDomain: 'bytedance.com',
    durations: ['5s', '10s'],
    defaultDuration: '5s',
    aspectRatios: SEEDANCE_V1_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudioInput: false,
    supportsVideoInput: false,
    supportsGenerateAudio: true,
    supportsDraftMode: true,
    supportsLastFrameReturn: true,
    supportsFlexTier: true,
  },
  [SEEDANCE_VIDEO_MODELS.V1_0_PRO]: {
    label: 'Seedance 1.0 Pro',
    badge: 'pro',
    description: 'Text-to-video + image-to-video, 5s/10s',
    providerDomain: 'bytedance.com',
    deprecated: true,
    durations: ['5s', '10s'],
    defaultDuration: '5s',
    aspectRatios: SEEDANCE_V1_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudioInput: false,
    supportsVideoInput: false,
    supportsGenerateAudio: false,
    supportsDraftMode: false,
    supportsLastFrameReturn: true,
    supportsFlexTier: true,
  },
  [SEEDANCE_VIDEO_MODELS.V1_0_PRO_FAST]: {
    label: 'Seedance 1.0 Pro Fast',
    badge: 'fast',
    description: 'Faster variant of 1.0 Pro',
    providerDomain: 'bytedance.com',
    deprecated: true,
    durations: ['5s', '10s'],
    defaultDuration: '5s',
    aspectRatios: SEEDANCE_V1_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudioInput: false,
    supportsVideoInput: false,
    supportsGenerateAudio: false,
    supportsDraftMode: false,
    supportsLastFrameReturn: true,
    supportsFlexTier: true,
  },
  [SEEDANCE_VIDEO_MODELS.V1_0_LITE]: {
    label: 'Seedance 1.0 Lite',
    badge: 'lite',
    description: 'Lightweight, text-to-video + image-to-video, 5s only',
    providerDomain: 'bytedance.com',
    deprecated: true,
    durations: ['5s'],
    defaultDuration: '5s',
    aspectRatios: SEEDANCE_V1_ASPECT_RATIOS,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsAudioInput: false,
    supportsVideoInput: false,
    supportsGenerateAudio: false,
    supportsDraftMode: false,
    supportsLastFrameReturn: false,
    supportsFlexTier: true,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function isSeedanceModel(model: string): boolean {
  return model.startsWith('seedance-');
}

export function getSeedanceModelConfig(model: string): SeedanceVideoModelConfig | undefined {
  return SEEDANCE_VIDEO_MODEL_CONFIG[model as SeedanceVideoModelId];
}
