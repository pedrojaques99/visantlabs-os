import { ANGLE_PRESETS, type AnglePreset } from '../types/anglePresets';
import { TEXTURE_PRESETS, type TexturePreset } from '../types/texturePresets';
import { AMBIENCE_PRESETS, type AmbiencePreset } from '../types/ambiencePresets';
import { LUMINANCE_PRESETS, type LuminancePreset } from '../types/luminancePresets';
import { MOCKUP_PRESETS, type MockupPreset } from '../types/mockupPresets';
import { BRANDING_PRESETS, type BrandingPreset } from '../types/brandingPresets';
import { EFFECT_PRESETS, type EffectPreset } from '../types/effectPresets';

export type PresetType = 'angle' | 'texture' | 'ambience' | 'luminance' | 'mockup' | 'branding' | 'effect';

export interface UnifiedPresets {
    anglePresets: AnglePreset[];
    texturePresets: TexturePreset[];
    ambiencePresets: AmbiencePreset[];
    luminancePresets: LuminancePreset[];
    mockupPresets: MockupPreset[];
    brandingPresets: BrandingPreset[];
    effectPresets: EffectPreset[];
}

// Internal cache
let cachedPresets: UnifiedPresets | null = null;
let isLoadingPromise: Promise<UnifiedPresets> | null = null;

// Default values from static files
const DEFAULT_PRESETS: UnifiedPresets = {
    anglePresets: ANGLE_PRESETS,
    texturePresets: TEXTURE_PRESETS,
    ambiencePresets: AMBIENCE_PRESETS,
    luminancePresets: LUMINANCE_PRESETS,
    mockupPresets: MOCKUP_PRESETS,
    brandingPresets: BRANDING_PRESETS,
    effectPresets: EFFECT_PRESETS,
};

/**
 * Fetch all official presets from the API
 */
export async function fetchAllOfficialPresets(): Promise<UnifiedPresets> {
    // Return cached if available
    if (cachedPresets) return cachedPresets;

    // Return ongoing promise if already loading
    if (isLoadingPromise) return isLoadingPromise;

    isLoadingPromise = (async () => {
        try {
            console.log('[UnifiedPresetService] Fetching official presets...');
            const response = await fetch('/api/admin/presets/public');
            if (response.ok) {
                const data = await response.json();

                // Merge with defaults to ensure we have all types even if API returns partial or empty
                cachedPresets = {
                    anglePresets: data.anglePresets?.length > 0 ? data.anglePresets : ANGLE_PRESETS,
                    texturePresets: data.texturePresets?.length > 0 ? data.texturePresets : TEXTURE_PRESETS,
                    ambiencePresets: data.ambiencePresets?.length > 0 ? data.ambiencePresets : AMBIENCE_PRESETS,
                    luminancePresets: data.luminancePresets?.length > 0 ? data.luminancePresets : LUMINANCE_PRESETS,
                    mockupPresets: data.mockupPresets?.length > 0 ? data.mockupPresets : MOCKUP_PRESETS,
                    brandingPresets: data.brandingPresets?.length > 0 ? data.brandingPresets : BRANDING_PRESETS,
                    effectPresets: data.effectPresets?.length > 0 ? data.effectPresets : EFFECT_PRESETS,
                };

                console.log('[UnifiedPresetService] Presets loaded successfully');
                return cachedPresets;
            }
            throw new Error(`Failed to fetch presets: ${response.statusText}`);
        } catch (error) {
            console.warn('[UnifiedPresetService] Failed to load official presets from API, using fallbacks:', error);
            cachedPresets = DEFAULT_PRESETS;
            return cachedPresets;
        } finally {
            isLoadingPromise = null;
        }
    })();

    return isLoadingPromise;
}

/**
 * Get presets of a specific type synchronously (returns cache or defaults)
 */
export function getPresetsByTypeSync<T extends PresetType>(type: T): UnifiedPresets[`${T}Presets`] {
    const cacheKey = `${type}Presets` as keyof UnifiedPresets;
    return (cachedPresets?.[cacheKey] || DEFAULT_PRESETS[cacheKey]) as UnifiedPresets[`${T}Presets`];
}

/**
 * Get presets of a specific type asynchronously (ensures fetch)
 */
export async function getPresetsByType<T extends PresetType>(type: T): Promise<UnifiedPresets[`${T}Presets`]> {
    const all = await fetchAllOfficialPresets();
    const cacheKey = `${type}Presets` as keyof UnifiedPresets;
    return all[cacheKey] as UnifiedPresets[`${T}Presets`];
}

/**
 * Get a specific preset by ID
 */
export function getPresetByIdSync<T extends PresetType>(
    type: T,
    id: string
): UnifiedPresets[`${T}Presets`][number] | undefined {
    const presets = getPresetsByTypeSync(type);
    return (presets as any[]).find(p => p.id === id);
}

/**
 * Clear cache to force reload
 */
export function clearPresetsCache(): void {
    cachedPresets = null;
}

/**
 * Initialize presets on app startup
 */
export async function initializePresets(): Promise<void> {
    await fetchAllOfficialPresets();
}
