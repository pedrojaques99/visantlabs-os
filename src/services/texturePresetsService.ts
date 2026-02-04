import type { TexturePreset, TexturePresetType } from '../types/texturePresets.js';
import { TEXTURE_PRESETS } from '../types/texturePresets.js';

import { getPresetsByType, getPresetsByTypeSync, getPresetByIdSync, fetchAllOfficialPresets } from './unifiedPresetService';

/**
 * Get a specific texture preset by ID (synchronous, uses cache)
 */
export function getTexturePreset(presetId: TexturePresetType | string): TexturePreset | undefined {
  return getPresetByIdSync('texture', presetId);
}

/**
 * Get all available texture presets (synchronous, uses cache)
 */
export function getAllTexturePresets(): TexturePreset[] {
  return getPresetsByTypeSync('texture');
}

/**
 * Get a specific texture preset by ID (async, loads from MongoDB)
 */
export async function getTexturePresetAsync(presetId: TexturePresetType | string): Promise<TexturePreset | undefined> {
  const presets = await getPresetsByType('texture');
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available texture presets (async, loads from MongoDB)
 */
export async function getAllTexturePresetsAsync(): Promise<TexturePreset[]> {
  return await getPresetsByType('texture');
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeTexturePresets(): Promise<void> {
  await fetchAllOfficialPresets();
}

export const texturePresetsService = {
  getById: getTexturePreset,
  getAll: getAllTexturePresets,
  getByIdAsync: getTexturePresetAsync,
  getAllAsync: getAllTexturePresetsAsync,
  initialize: initializeTexturePresets
};

















