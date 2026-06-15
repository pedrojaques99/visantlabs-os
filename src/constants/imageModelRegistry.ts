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
  /** Provider has no system-wide key; the user must supply their own (BYOK) for it to work. */
  requiresByok?: boolean;
}

const GEMINI_IMAGE_IDS = [GEMINI_MODELS.IMAGE_NB2, GEMINI_MODELS.IMAGE_PRO] as const;

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
      // Seedream has no system fallback key in production — flag it so agents/UIs
      // can warn before selecting it (E2E audit 2026-06-11).
      requiresByok: true,
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
      supportsLogoRef: c.supportsI2I,
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
      supportsLogoRef: c.supportsEdit,
    };
  }),
];

/**
 * Default model for all generation entry points.
 * Gemini Nano Banana 2 (IMAGE_NB2): most reliable provider in production (E2E audit
 * 2026-06-11) and already the repo-wide DEFAULT_MODEL. Chosen over IMAGE_PRO to keep
 * the silent global default on the cost-efficient workhorse rather than the
 * reasoning-tier PRO. The registry order (gpt-image first) feeds docs, so we expose
 * the default explicitly instead of reordering / relying on IMAGE_MODEL_IDS[0].
 */
export const DEFAULT_IMAGE_MODEL_ID = GEMINI_MODELS.IMAGE_NB2;

/**
 * All image model IDs from the registry — single source of truth for tool enums.
 * Used by MCP tools, chat tool registry, and doc generators.
 */
export const IMAGE_MODEL_IDS = IMAGE_MODEL_REGISTRY.map((m) => m.id) as [string, ...string[]];

/**
 * Unique image provider names derived from the registry.
 * Used by MCP tools, OpenAPI spec, and provider enums.
 */
export const IMAGE_PROVIDERS = [...new Set(IMAGE_MODEL_REGISTRY.map((m) => m.provider))] as [
  string,
  ...string[],
];
