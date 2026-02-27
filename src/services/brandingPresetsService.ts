import { BrandingPreset } from '../types/brandingPresets';
import { getPresetsByTypeSync, getPresetsByType } from './unifiedPresetService';
import type { PresetType } from './unifiedPresetService';
export const getAllBrandingPresets = (): BrandingPreset[] => {
    return (getPresetsByTypeSync('branding' as PresetType) as unknown as BrandingPreset[]) || [];
};

/**
 * Get all branding presets asynchronously
 * Ensures data is loaded from API
 */
export const getAllBrandingPresetsAsync = async (): Promise<BrandingPreset[]> => {
    const presets = await getPresetsByType('branding' as PresetType);
    return (presets as unknown as BrandingPreset[]) || [];
};

export const brandingPresetsService = {
    getAll: getAllBrandingPresets,
    getAllAsync: getAllBrandingPresetsAsync,
};
