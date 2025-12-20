import type { LuminancePreset, LuminancePresetType } from '../types/luminancePresets';
import { LUMINANCE_PRESETS } from '../types/luminancePresets';

// Cache for MongoDB presets
let cachedPresets: LuminancePreset[] | null = null;
let isLoadingPresets = false;

/**
 * Load presets from MongoDB API with fallback to TypeScript
 */
async function loadPresetsFromMongoDB(): Promise<LuminancePreset[]> {
  if (isLoadingPresets) {
    // Wait for ongoing load
    while (isLoadingPresets) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedPresets || LUMINANCE_PRESETS;
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    const response = await fetch('/api/admin/presets/public');
    if (response.ok) {
      const data = await response.json();
      if (data.luminancePresets && data.luminancePresets.length > 0) {
        cachedPresets = data.luminancePresets;
        return cachedPresets;
      }
    }
  } catch (error) {
    console.warn('Failed to load luminance presets from MongoDB, using TypeScript fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  return LUMINANCE_PRESETS;
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeLuminancePresets(): Promise<void> {
  await loadPresetsFromMongoDB();
}

/**
 * Get a specific luminance preset by ID (synchronous, uses cache)
 */
export function getLuminancePreset(presetId: LuminancePresetType | string): LuminancePreset | undefined {
  const presets = cachedPresets || LUMINANCE_PRESETS;
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available luminance presets (synchronous, uses cache)
 */
export function getAllLuminancePresets(): LuminancePreset[] {
  return cachedPresets || LUMINANCE_PRESETS;
}

/**
 * Get a specific luminance preset by ID (async, loads from MongoDB)
 */
export async function getLuminancePresetAsync(presetId: LuminancePresetType | string): Promise<LuminancePreset | undefined> {
  const presets = await loadPresetsFromMongoDB();
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available luminance presets (async, loads from MongoDB)
 */
export async function getAllLuminancePresetsAsync(): Promise<LuminancePreset[]> {
  return await loadPresetsFromMongoDB();
}
















