import type { Resolution } from '../types/types';

export const OPENAI_IMAGE_MODELS = {
  GPT_IMAGE_2: 'gpt-image-2' as const,
} as const;

export type OpenAIImageModelId = typeof OPENAI_IMAGE_MODELS[keyof typeof OPENAI_IMAGE_MODELS];

export const OPENAI_IMAGE_MODEL_LIST: OpenAIImageModelId[] = [
  OPENAI_IMAGE_MODELS.GPT_IMAGE_2,
];

export interface OpenAIImageModelConfig {
  label: string;
  description: string;
  /** Resolutions mapped to OpenAI size params */
  supportedResolutions: Resolution[];
  defaultResolution: Resolution;
  /** Whether model supports image editing (i2i) */
  supportsImageEdit: boolean;
  providerDomain: string;
}

/** Maps our Resolution tokens to OpenAI size strings */
export const OPENAI_SIZE_MAP: Record<Resolution, string> = {
  '512px': '1024x1024',
  'HD':    '1024x1024',
  '1K':    '1024x1024',
  '2K':    '1536x1024',
  '4K':    '1024x1536',
  '720p':  '1024x1024',
  '1080p': '1536x1024',
};

/** Maps our Resolution tokens to OpenAI quality strings */
export const OPENAI_QUALITY_MAP: Record<Resolution, 'low' | 'medium' | 'high'> = {
  '512px': 'low',
  'HD':    'medium',
  '1K':    'medium',
  '2K':    'high',
  '4K':    'high',
  '720p':  'medium',
  '1080p': 'high',
};

export const OPENAI_IMAGE_MODEL_CONFIG: Record<OpenAIImageModelId, OpenAIImageModelConfig> = {
  [OPENAI_IMAGE_MODELS.GPT_IMAGE_2]: {
    label: 'GPT Image 2',
    description: 'OpenAI GPT Image 2 — high-quality t2i and image editing',
    supportedResolutions: ['1K', '2K', '4K'],
    defaultResolution: '1K',
    supportsImageEdit: true,
    providerDomain: 'openai.com',
  },
};

export function isOpenAIImageModel(model: string): model is OpenAIImageModelId {
  return OPENAI_IMAGE_MODEL_LIST.includes(model as OpenAIImageModelId);
}

export function getOpenAIImageModelConfig(model: string): OpenAIImageModelConfig | undefined {
  return OPENAI_IMAGE_MODEL_CONFIG[model as OpenAIImageModelId];
}
