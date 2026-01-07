import type { LuminancePreset, LuminancePresetType } from '../types/luminancePresets.js';
import { LUMINANCE_PRESETS } from '../types/luminancePresets.js';

import { getPresetsByType, getPresetsByTypeSync, getPresetByIdSync, fetchAllOfficialPresets } from './unifiedPresetService';

/**
 * Get a specific luminance preset by ID (synchronous, uses cache)
 */
export function getLuminancePreset(presetId: LuminancePresetType | string): LuminancePreset | undefined {
  return getPresetByIdSync('luminance', presetId);
}

/**
 * Get all available luminance presets (synchronous, uses cache)
 */
export function getAllLuminancePresets(): LuminancePreset[] {
  return getPresetsByTypeSync('luminance');
}

/**
 * Get a specific luminance preset by ID (async, loads from MongoDB)
 */
export async function getLuminancePresetAsync(presetId: LuminancePresetType | string): Promise<LuminancePreset | undefined> {
  const presets = await getPresetsByType('luminance');
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available luminance presets (async, loads from MongoDB)
 */
export async function getAllLuminancePresetsAsync(): Promise<LuminancePreset[]> {
  return await getPresetsByType('luminance');
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeLuminancePresets(): Promise<void> {
  await fetchAllOfficialPresets();
}

















