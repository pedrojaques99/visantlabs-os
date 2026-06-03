import type { Resolution } from '../types/types';

export const IMAGEN_MODELS = {
  IMAGEN_4_FAST: 'imagen-4.0-fast-generate-001' as const,
  IMAGEN_4: 'imagen-4.0-generate-001' as const,
  IMAGEN_4_ULTRA: 'imagen-4.0-ultra-generate-001' as const,
} as const;

export type ImagenModelId = (typeof IMAGEN_MODELS)[keyof typeof IMAGEN_MODELS];

export const IMAGEN_MODEL_LIST: ImagenModelId[] = [
  IMAGEN_MODELS.IMAGEN_4_FAST,
  IMAGEN_MODELS.IMAGEN_4,
  IMAGEN_MODELS.IMAGEN_4_ULTRA,
];

export interface ImagenModelConfig {
  label: string;
  badge?: 'latest' | 'popular' | 'fast';
  description: string;
  defaultResolution: Resolution;
  supportedResolutions: Resolution[];
  providerDomain: string;
  deprecated?: boolean;
}

export const IMAGEN_MODEL_CONFIG: Record<ImagenModelId, ImagenModelConfig> = {
  [IMAGEN_MODELS.IMAGEN_4_FAST]: {
    label: 'Imagen 4 Fast',
    badge: 'fast',
    description: 'Fastest, lowest cost',
    defaultResolution: '1K',
    supportedResolutions: ['1K'],
    providerDomain: 'google.com',
  },
  [IMAGEN_MODELS.IMAGEN_4]: {
    label: 'Imagen 4',
    badge: 'popular',
    description: 'Best quality/cost balance, text rendering',
    defaultResolution: '1K',
    supportedResolutions: ['1K', '2K'],
    providerDomain: 'google.com',
  },
  [IMAGEN_MODELS.IMAGEN_4_ULTRA]: {
    label: 'Imagen 4 Ultra',
    badge: 'latest',
    description: 'Maximum quality, photorealistic',
    defaultResolution: '2K',
    supportedResolutions: ['1K', '2K'],
    providerDomain: 'google.com',
  },
};

export function isImagenModel(model: string): model is ImagenModelId {
  return IMAGEN_MODEL_LIST.includes(model as ImagenModelId);
}

export function getImagenModelConfig(model: string): ImagenModelConfig | undefined {
  return IMAGEN_MODEL_CONFIG[model as ImagenModelId];
}
