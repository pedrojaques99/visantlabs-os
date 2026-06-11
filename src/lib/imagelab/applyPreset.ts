/**
 * Shared ImageLab preset application.
 *
 * Both the community preset library (`ImageLabPresetLibrary`) and the personal
 * saved-presets panel (`ImageLabSavePreset`) previously carried byte-identical
 * copies of this apply logic. It lives here once.
 *
 * Community/saved presets are arbitrary JSON — a hostile or stale preset can
 * carry out-of-range numeric values (e.g. `frequency: 1e9`, negative `dotSize`)
 * that would push the GLSL renderer into NaN/overflow territory and blank the
 * canvas. `clampSettings` bounds every known numeric field to the range the
 * UI sliders allow before the values reach the stores. Unknown keys, colors,
 * booleans and enum strings pass through untouched (the stores validate those).
 */
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useTextureFilterStore } from '@/stores/textureFilterStore';
import { useRisoStore } from '@/stores/risoStore';
import { useShaderLabStore } from '@/stores/shaderLabStore';

export interface ImageLabPresetData {
  mode: ImageLabMode | 'shaders';
  settings: Record<string, any>;
  layers?: any[];
}

type Bound = readonly [min: number, max: number];

/**
 * Per-key numeric bounds. Mirrors the slider ranges in the control panels.
 * Keys absent from this table are not clamped (colors, enums, booleans, and
 * any field without a slider). Shared keys (e.g. `frequency`, `contrast`) use
 * a range that is valid across every mode that exposes them.
 */
const NUMERIC_BOUNDS: Record<string, Bound> = {
  // Shared screen/dither params
  frequency: [5, 200],
  dotSize: [0, 3],
  contrast: [0, 3],
  lightness: [-1, 1],
  blur: [0, 20],
  threshold: [0, 1],
  roughness: [0, 10],
  fuzz: [0, 1],
  randomness: [0, 1],
  paperNoise: [0, 1],
  inkNoise: [0, 1],
  paperAlpha: [0, 1],
  // Halftone CMYK
  blendMode: [0, 2],
  cyanAngle: [0, 180],
  magentaAngle: [0, 180],
  yellowAngle: [0, 180],
  blackAngle: [0, 180],
  cyanAlpha: [0, 1],
  magentaAlpha: [0, 1],
  yellowAlpha: [0, 1],
  blackAlpha: [0, 1],
  effectOpacity: [0, 1],
  // Riso
  inkDropout: [0, 1],
  misregistration: [0, 20],
  edgeBleed: [0, 10],
  colorCount: [1, 8],
  // Texture
  opacity: [0, 1],
  scale: [0.05, 10],
  rotation: [-360, 360],
  offsetX: [-2000, 2000],
  offsetY: [-2000, 2000],
  tileGapX: [0, 500],
  tileGapY: [0, 500],
};

const clamp = (n: number, [min, max]: Bound): number => Math.min(max, Math.max(min, n));

/**
 * Returns a copy of `settings` with every known numeric field clamped to its
 * valid range. Non-finite numbers (NaN/Infinity from a corrupt preset) are
 * dropped so the store keeps its current/default value instead of breaking.
 */
export function clampSettings(settings: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(settings)) {
    const bound = NUMERIC_BOUNDS[key];
    if (bound && typeof value === 'number') {
      if (!Number.isFinite(value)) continue; // drop NaN/Infinity
      out[key] = clamp(value, bound);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Applies a preset to the relevant ImageLab store, switching the active mode
 * first. Settings are clamped before being written. Returns false if the
 * preset has no usable mode.
 */
export function applyImageLabPreset(preset: { data?: ImageLabPresetData }): boolean {
  const data = preset.data;
  if (!data?.mode) return false;

  const { mode, settings, layers } = data;
  const safe = clampSettings(settings || {});
  useImageLabStore.getState().setMode(mode);

  if (mode === 'halftone') {
    const store = useHalftoneStore.getState();
    Object.entries(safe).forEach(([k, v]) => store.updateSetting(k as any, v));
  } else if (mode === 'texture') {
    const store = useTextureFilterStore.getState();
    Object.entries(safe).forEach(([k, v]) => store.updateSetting(k as any, v));
  } else if (mode === 'riso') {
    const store = useRisoStore.getState();
    Object.entries(safe).forEach(([k, v]) => store.updateSetting(k as any, v));
    if (layers) store.setLayers(layers);
  } else if (mode === 'shaders') {
    const store = useShaderLabStore.getState();
    if (safe.shaderType) store.setShaderType(safe.shaderType);
    if (safe.values)
      Object.entries(safe.values).forEach(([k, v]) => store.setShaderValue(k, v as number));
  }
  return true;
}
