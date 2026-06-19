import type { Resolution, AspectRatio } from '../types/types';

export const OPENAI_IMAGE_MODELS = {
  GPT_IMAGE_1: 'gpt-image-1' as const,
  GPT_IMAGE_2: 'gpt-image-2' as const,
} as const;

export type OpenAIImageModelId = (typeof OPENAI_IMAGE_MODELS)[keyof typeof OPENAI_IMAGE_MODELS];

export const OPENAI_IMAGE_MODEL_LIST: OpenAIImageModelId[] = [
  OPENAI_IMAGE_MODELS.GPT_IMAGE_1,
  OPENAI_IMAGE_MODELS.GPT_IMAGE_2,
];

export interface OpenAIImageModelConfig {
  label: string;
  badge?: 'latest' | 'popular' | 'fast' | 'edit';
  description: string;
  /** Resolutions mapped to OpenAI size params */
  supportedResolutions: Resolution[];
  defaultResolution: Resolution;
  /** Whether model supports image editing (i2i) */
  supportsImageEdit: boolean;
  providerDomain: string;
}

/** Maps our Resolution tokens to OpenAI size strings (square fallback) */
export const OPENAI_SIZE_MAP: Record<Resolution, string> = {
  '512px': '1024x1024',
  HD: '1024x1024',
  '1K': '1024x1024',
  '2K': '1536x1024',
  '3K': '1536x1024',
  '4K': '1024x1536',
  '720p': '1024x1024',
  '1080p': '1536x1024',
};

type Orientation = 'landscape' | 'portrait' | 'square';

const LANDSCAPE_RATIOS: AspectRatio[] = ['16:9', '4:3', '3:2', '21:9'];
const PORTRAIT_RATIOS: AspectRatio[] = ['9:16', '3:4', '2:3', '4:5'];

function getOrientation(aspectRatio?: AspectRatio): Orientation {
  if (!aspectRatio || aspectRatio === '1:1' || aspectRatio === '5:4') return 'square';
  if (LANDSCAPE_RATIOS.includes(aspectRatio)) return 'landscape';
  if (PORTRAIT_RATIOS.includes(aspectRatio)) return 'portrait';
  return 'square';
}

const OPENAI_ORIENTED_SIZE: Record<Resolution, Record<Orientation, string>> = {
  '512px': { square: '1024x1024', landscape: '1024x1024', portrait: '1024x1024' },
  HD: { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' },
  '1K': { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' },
  '2K': { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' },
  '3K': { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' },
  '4K': { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' },
  '720p': { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' },
  '1080p': { square: '1024x1024', landscape: '1536x1024', portrait: '1024x1536' },
};

/**
 * Resolve OpenAI size from resolution + aspect ratio.
 * Aspect ratio determines orientation (landscape/portrait/square),
 * then maps to the correct OpenAI size string.
 */
export function resolveOpenAISize(resolution: Resolution, aspectRatio?: AspectRatio): string {
  const orientation = getOrientation(aspectRatio);
  return OPENAI_ORIENTED_SIZE[resolution]?.[orientation] ?? '1024x1024';
}

/** Maps our Resolution tokens to OpenAI quality strings */
export const OPENAI_QUALITY_MAP: Record<Resolution, 'low' | 'medium' | 'high'> = {
  '512px': 'low',
  HD: 'medium',
  '1K': 'medium',
  '2K': 'high',
  '3K': 'high',
  '4K': 'high',
  '720p': 'medium',
  '1080p': 'high',
};

export const OPENAI_IMAGE_MODEL_CONFIG: Record<OpenAIImageModelId, OpenAIImageModelConfig> = {
  [OPENAI_IMAGE_MODELS.GPT_IMAGE_1]: {
    label: 'GPT Image 1',
    description: 'OpenAI GPT Image 1 — high-quality t2i and image editing',
    supportedResolutions: ['1K', '2K', '4K'],
    defaultResolution: '1K',
    supportsImageEdit: true,
    providerDomain: 'openai.com',
  },
  [OPENAI_IMAGE_MODELS.GPT_IMAGE_2]: {
    label: 'GPT Image 2',
    badge: 'latest' as const,
    description:
      'OpenAI GPT Image 2 — high-quality t2i and image editing (requires org verification)',
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
