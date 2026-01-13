import type { AnglePreset, AnglePresetType } from '../types/anglePresets.js';

import { getPresetsByType, getPresetsByTypeSync, getPresetByIdSync, fetchAllOfficialPresets } from './unifiedPresetService';

/**
 * Get a specific angle preset by ID (synchronous, uses cache)
 */
export function getAnglePreset(angleId: AnglePresetType | string): AnglePreset | undefined {
  return getPresetByIdSync('angle', angleId);
}

/**
 * Get all available angle presets (synchronous, uses cache)
 */
export function getAllAnglePresets(): AnglePreset[] {
  return getPresetsByTypeSync('angle');
}

/**
 * Get a specific angle preset by ID (async, loads from MongoDB)
 */
export async function getAnglePresetAsync(angleId: AnglePresetType | string): Promise<AnglePreset | undefined> {
  const presets = await getPresetsByType('angle');
  return presets.find(preset => preset.id === angleId);
}

/**
 * Get all available angle presets (async, loads from MongoDB)
 */
export async function getAllAnglePresetsAsync(): Promise<AnglePreset[]> {
  return await getPresetsByType('angle');
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeAnglePresets(): Promise<void> {
  await fetchAllOfficialPresets();
}

