import type { TexturePreset, TexturePresetType } from '../types/texturePresets';
import { TEXTURE_PRESETS } from '../types/texturePresets';

// Cache for MongoDB presets
let cachedPresets: TexturePreset[] | null = null;
let isLoadingPresets = false;

/**
 * Load presets from MongoDB API with fallback to TypeScript
 */
async function loadPresetsFromMongoDB(): Promise<TexturePreset[]> {
  if (isLoadingPresets) {
    // Wait for ongoing load
    while (isLoadingPresets) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedPresets || TEXTURE_PRESETS;
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    const response = await fetch('/api/admin/presets/public');
    if (response.ok) {
      const data = await response.json();
      if (data.texturePresets && data.texturePresets.length > 0) {
        cachedPresets = data.texturePresets;
        return cachedPresets;
      }
    }
  } catch (error) {
    console.warn('Failed to load texture presets from MongoDB, using TypeScript fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  return TEXTURE_PRESETS;
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeTexturePresets(): Promise<void> {
  await loadPresetsFromMongoDB();
}

/**
 * Get a specific texture preset by ID (synchronous, uses cache)
 */
export function getTexturePreset(presetId: TexturePresetType | string): TexturePreset | undefined {
  const presets = cachedPresets || TEXTURE_PRESETS;
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available texture presets (synchronous, uses cache)
 */
export function getAllTexturePresets(): TexturePreset[] {
  return cachedPresets || TEXTURE_PRESETS;
}

/**
 * Get a specific texture preset by ID (async, loads from MongoDB)
 */
export async function getTexturePresetAsync(presetId: TexturePresetType | string): Promise<TexturePreset | undefined> {
  const presets = await loadPresetsFromMongoDB();
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available texture presets (async, loads from MongoDB)
 */
export async function getAllTexturePresetsAsync(): Promise<TexturePreset[]> {
  return await loadPresetsFromMongoDB();
}
















