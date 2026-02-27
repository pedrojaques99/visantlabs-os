import type { AmbiencePreset, AmbiencePresetType } from '../types/ambiencePresets.js';

import { getPresetsByType, getPresetsByTypeSync, getPresetByIdSync, fetchAllOfficialPresets } from './unifiedPresetService';

/**
 * Get a specific ambience preset by ID (synchronous, uses cache)
 */
export function getAmbiencePreset(presetId: AmbiencePresetType | string): AmbiencePreset | undefined {
  return getPresetByIdSync('ambience', presetId);
}

/**
 * Get all available ambience presets (synchronous, uses cache)
 */
export function getAllAmbiencePresets(): AmbiencePreset[] {
  return getPresetsByTypeSync('ambience');
}

/**
 * Get a specific ambience preset by ID (async, loads from MongoDB)
 */
export async function getAmbiencePresetAsync(presetId: AmbiencePresetType | string): Promise<AmbiencePreset | undefined> {
  const presets = await getPresetsByType('ambience');
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available ambience presets (async, loads from MongoDB)
 */
export async function getAllAmbiencePresetsAsync(): Promise<AmbiencePreset[]> {
  return await getPresetsByType('ambience');
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializeAmbiencePresets(): Promise<void> {
  await fetchAllOfficialPresets();
}

export const ambiencePresetsService = {
  getById: getAmbiencePreset,
  getAll: getAllAmbiencePresets,
  getByIdAsync: getAmbiencePresetAsync,
  getAllAsync: getAllAmbiencePresetsAsync,
  initialize: initializeAmbiencePresets
};

















