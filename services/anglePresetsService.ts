import type { AnglePreset, AnglePresetType } from '../types/anglePresets.js';
import { ANGLE_PRESETS } from '../types/anglePresets.js';

// Cache for MongoDB presets
let cachedPresets: AnglePreset[] | null = null;
let isLoadingPresets = false;

/**
 * Load presets from MongoDB API with fallback to TypeScript
 */
async function loadPresetsFromMongoDB(): Promise<AnglePreset[]> {
  if (isLoadingPresets) {
    // Wait for ongoing load
    while (isLoadingPresets) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedPresets || ANGLE_PRESETS;
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    const response = await fetch('/api/admin/presets/public');
    if (response.ok) {
      const data = await response.json();
      if (data.anglePresets && data.anglePresets.length > 0) {
        cachedPresets = data.anglePresets;
        return cachedPresets;
      }
    }
  } catch (error) {
    console.warn('Failed to load angle presets from MongoDB, using TypeScript fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  return ANGLE_PRESETS;
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeAnglePresets(): Promise<void> {
  await loadPresetsFromMongoDB();
}

/**
 * Get a specific angle preset by ID (synchronous, uses cache)
 */
export function getAnglePreset(angleId: AnglePresetType | string): AnglePreset | undefined {
  const presets = cachedPresets || ANGLE_PRESETS;
  return presets.find(preset => preset.id === angleId);
}

/**
 * Get all available angle presets (synchronous, uses cache)
 */
export function getAllAnglePresets(): AnglePreset[] {
  return cachedPresets || ANGLE_PRESETS;
}

/**
 * Get a specific angle preset by ID (async, loads from MongoDB)
 */
export async function getAnglePresetAsync(angleId: AnglePresetType | string): Promise<AnglePreset | undefined> {
  const presets = await loadPresetsFromMongoDB();
  return presets.find(preset => preset.id === angleId);
}

/**
 * Get all available angle presets (async, loads from MongoDB)
 */
export async function getAllAnglePresetsAsync(): Promise<AnglePreset[]> {
  return await loadPresetsFromMongoDB();
}
