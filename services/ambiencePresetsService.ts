import type { AmbiencePreset, AmbiencePresetType } from '../types/ambiencePresets';
import { AMBIENCE_PRESETS } from '../types/ambiencePresets';

// Cache for MongoDB presets
let cachedPresets: AmbiencePreset[] | null = null;
let isLoadingPresets = false;

/**
 * Load presets from MongoDB API with fallback to TypeScript
 */
async function loadPresetsFromMongoDB(): Promise<AmbiencePreset[]> {
  if (isLoadingPresets) {
    // Wait for ongoing load
    while (isLoadingPresets) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedPresets || AMBIENCE_PRESETS;
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    const response = await fetch('/api/admin/presets/public');
    if (response.ok) {
      const data = await response.json();
      if (data.ambiencePresets && data.ambiencePresets.length > 0) {
        cachedPresets = data.ambiencePresets;
        return cachedPresets;
      }
    }
  } catch (error) {
    console.warn('Failed to load ambience presets from MongoDB, using TypeScript fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  return AMBIENCE_PRESETS;
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeAmbiencePresets(): Promise<void> {
  await loadPresetsFromMongoDB();
}

/**
 * Get a specific ambience preset by ID (synchronous, uses cache)
 */
export function getAmbiencePreset(presetId: AmbiencePresetType | string): AmbiencePreset | undefined {
  const presets = cachedPresets || AMBIENCE_PRESETS;
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available ambience presets (synchronous, uses cache)
 */
export function getAllAmbiencePresets(): AmbiencePreset[] {
  return cachedPresets || AMBIENCE_PRESETS;
}

/**
 * Get a specific ambience preset by ID (async, loads from MongoDB)
 */
export async function getAmbiencePresetAsync(presetId: AmbiencePresetType | string): Promise<AmbiencePreset | undefined> {
  const presets = await loadPresetsFromMongoDB();
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available ambience presets (async, loads from MongoDB)
 */
export async function getAllAmbiencePresetsAsync(): Promise<AmbiencePreset[]> {
  return await loadPresetsFromMongoDB();
}
















