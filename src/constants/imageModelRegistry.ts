/**
 * Image Model Registry — Single source of truth for docs, AI designer, brand prompting.
 *
 * Each provider's MODEL_CONFIG is the canonical source; this file aggregates them
 * into a flat list consumed by server/routes/docs.ts and any future consumer.
 */

import { OPENAI_IMAGE_MODEL_LIST, OPENAI_IMAGE_MODEL_CONFIG } from './openaiModels';
import { GEMINI_MODELS, MODEL_CONFIG as GEMINI_MODEL_CONFIG } from './geminiModels';
import { SEEDREAM_IMAGE_MODELS, SEEDREAM_MODEL_CONFIG } from './seedreamModels';
import { IMAGEN_MODEL_LIST, IMAGEN_MODEL_CONFIG } from './imagenModels';
import { IDEOGRAM_MODEL_LIST, IDEOGRAM_MODEL_CONFIG } from './ideogramModels';
import { REVE_MODEL_LIST, REVE_MODEL_CONFIG } from './reveModels';

export interface ImageModelEntry {
  id: string;
  provider: string;
  label: string;
  description: string;
  envVar?: string;
  supportsLogoRef: boolean;
}

const GEMINI_IMAGE_IDS = [
  GEMINI_MODELS.IMAGE_NB2,
  GEMINI_MODELS.IMAGE_PRO,
] as const;

export const IMAGE_MODEL_REGISTRY: ImageModelEntry[] = [
  // OpenAI
  ...OPENAI_IMAGE_MODEL_LIST.map((id) => {
    const c = OPENAI_IMAGE_MODEL_CONFIG[id];
    return {
      id,
      provider: 'openai',
      label: c.label,
      description: c.description,
      envVar: 'OPENAI_KEY or OPENAI_API_KEY',
      supportsLogoRef: c.supportsImageEdit,
    };
  }),

  // Gemini (image models only)
  ...GEMINI_IMAGE_IDS.map((id) => {
    const c = GEMINI_MODEL_CONFIG[id];
    return {
      id,
      provider: 'gemini',
      label: c.label,
      description: `${c.label} — up to ${c.maxRefImages} ref images`,
      envVar: 'GEMINI_API_KEY',
      supportsLogoRef: true,
    };
  }),

  // Imagen
  ...IMAGEN_MODEL_LIST.map((id) => {
    const c = IMAGEN_MODEL_CONFIG[id];
    return {
      id,
      provider: 'imagen',
      label: c.label,
      description: c.description,
      envVar: 'GEMINI_API_KEY',
      supportsLogoRef: false,
    };
  }),

  // Seedream
  ...SEEDREAM_IMAGE_MODELS.map((id) => {
    const c = SEEDREAM_MODEL_CONFIG[id];
    return {
      id,
      provider: 'seedream',
      label: c.label,
      description: c.description,
      envVar: 'BYTEPLUS_API_KEY',
      supportsLogoRef: !c.requiresImage,
    };
  }),

  // Ideogram
  ...IDEOGRAM_MODEL_LIST.map((id) => {
    const c = IDEOGRAM_MODEL_CONFIG[id];
    return {
      id,
      provider: 'ideogram',
      label: c.label,
      description: c.description,
      envVar: 'IDEOGRAM_API_KEY',
      supportsLogoRef: false,
    };
  }),

  // REVE
  ...REVE_MODEL_LIST.map((id) => {
    const c = REVE_MODEL_CONFIG[id];
    return {
      id,
      provider: 'reve',
      label: c.label,
      description: c.description,
      envVar: 'REVE_API_KEY',
      supportsLogoRef: false,
    };
  }),
];
