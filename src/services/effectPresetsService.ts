import { EffectPreset } from '../types/effectPresets';
import { getPresetsByTypeSync, getPresetsByType } from './unifiedPresetService';
import type { PresetType } from './unifiedPresetService';

// Constants for initial state or fallback
// Constants removed to avoid circular dependency / shadowing.
// Import EFFECT_PRESETS from types/effectPresets directly if needed.

/**
 * Get all effect presets
 * First tries to fetch from cache/API via unified service
 * Fallback to empty array if nothing available
 */
export const getAllEffectPresets = (): EffectPreset[] => {
    return (getPresetsByTypeSync('effect' as PresetType) as unknown as EffectPreset[]) || [];
};

/**
 * Get all effect presets asynchronously
 * Ensures data is loaded from API
 */
export const getAllEffectPresetsAsync = async (): Promise<EffectPreset[]> => {
    const presets = await getPresetsByType('effect' as PresetType);
    return (presets as unknown as EffectPreset[]) || [];
};

export const effectPresetsService = {
    getAll: getAllEffectPresets,
    getAllAsync: getAllEffectPresetsAsync,
};
