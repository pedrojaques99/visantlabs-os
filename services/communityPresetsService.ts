// Cache for community presets
let cachedPresets: Record<string, any[]> | null = null;
let isLoadingPresets = false;

/**
 * Load community presets from API
 */
async function loadPresetsFromAPI(): Promise<Record<string, any[]>> {
  if (isLoadingPresets) {
    // Wait for ongoing load
    while (isLoadingPresets) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedPresets || { mockup: [], angle: [], texture: [], ambience: [], luminance: [] };
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    const response = await fetch('/api/community/presets/public');
    if (response.ok) {
      const data = await response.json();
      cachedPresets = {
        mockup: data.mockup || [],
        angle: data.angle || [],
        texture: data.texture || [],
        ambience: data.ambience || [],
        luminance: data.luminance || [],
      };
      return cachedPresets;
    }
  } catch (error) {
    console.warn('Failed to load community presets from API, using empty fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  return { mockup: [], angle: [], texture: [], ambience: [], luminance: [] };
}

/**
 * Get community presets by type
 */
export async function getCommunityPresetsByType(presetType: 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance'): Promise<any[]> {
  const presets = await loadPresetsFromAPI();
  return presets[presetType] || [];
}

/**
 * Get all community presets
 */
export async function getAllCommunityPresets(): Promise<Record<string, any[]>> {
  return await loadPresetsFromAPI();
}

/**
 * Clear cache (useful after creating/updating/deleting presets)
 */
export function clearCommunityPresetsCache(): void {
  cachedPresets = null;
}

/**
 * Initialize community presets (call this on app startup)
 */
export async function initializeCommunityPresets(): Promise<void> {
  await loadPresetsFromAPI();
}


