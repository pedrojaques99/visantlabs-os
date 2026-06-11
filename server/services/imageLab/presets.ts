/**
 * ImageLab Presets — server-side view.
 *
 * The preset data now has a single source of truth in `shared/imagelab/presets.ts`
 * (same pattern as the shared Riso shaders). This module re-exports it cast to
 * the server-side settings interfaces. Client and server can no longer drift —
 * both import the same shared module — so the old "kept in sync via the type
 * system" caveat is gone.
 */
import type { HalftoneSettings, RisoFullPreset, TextureBlendMode } from './types.js';
import {
  HALFTONE_PRESETS_DATA,
  RISO_FULL_PRESETS_DATA,
  TEXTURE_PRESETS_DATA,
} from '../../../shared/imagelab/presets.js';

export const HALFTONE_PRESETS = HALFTONE_PRESETS_DATA as Record<
  string,
  Partial<HalftoneSettings>
>;

export const RISO_FULL_PRESETS = RISO_FULL_PRESETS_DATA as unknown as Record<
  string,
  RisoFullPreset
>;

export const TEXTURE_PRESETS = TEXTURE_PRESETS_DATA as Record<
  string,
  {
    opacity: number;
    scale: number;
    blendMode: TextureBlendMode;
    tileMode?: boolean;
    tileGapX?: number;
    tileGapY?: number;
    maskMode?: boolean;
    maskInvert?: boolean;
  }
>;

// ── Shader types list (for list_presets) ──

export const SHADER_TYPES = [
  'halftone',
  'vhs',
  'ascii',
  'matrixDither',
  'upscale',
  'dither',
  'duotone',
  'filmGrain',
  'pixelate',
  'posterize',
  'chromaticAberration',
  'crtScanlines',
  'edgeDetect',
  'glitch',
] as const;
