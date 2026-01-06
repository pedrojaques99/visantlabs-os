import { migrateLegacyPreset } from '../types/communityPrompts';
import type { PromptCategory } from '../types/communityPrompts';

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
    return cachedPresets || { 
      '3d': [], 'presets': [], 'aesthetics': [], 'themes': [],
      // Compatibilidade
      mockup: [], angle: [], texture: [], ambience: [], luminance: [] 
    };
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    const response = await fetch('/api/community/presets/public');
    if (response.ok) {
      const data = await response.json();
      // Migrar presets legados e estruturar por categoria
      cachedPresets = {
        '3d': (data['3d'] || []).map(migrateLegacyPreset),
        'presets': (data['presets'] || []).map(migrateLegacyPreset),
        'aesthetics': (data['aesthetics'] || []).map(migrateLegacyPreset),
        'themes': (data['themes'] || []).map(migrateLegacyPreset),
        // Compatibilidade com formato antigo
        mockup: (data.mockup || []).map(migrateLegacyPreset),
        angle: (data.angle || []).map(migrateLegacyPreset),
        texture: (data.texture || []).map(migrateLegacyPreset),
        ambience: (data.ambience || []).map(migrateLegacyPreset),
        luminance: (data.luminance || []).map(migrateLegacyPreset),
      };
      return cachedPresets;
    }
  } catch (error) {
    console.warn('Failed to load community presets from API, using empty fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  return { 
    '3d': [], 'presets': [], 'aesthetics': [], 'themes': [],
    // Compatibilidade
    mockup: [], angle: [], texture: [], ambience: [], luminance: [] 
  };
}

/**
 * Get community presets by type (legacy - mantém compatibilidade)
 */
export async function getCommunityPresetsByType(presetType: 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance'): Promise<any[]> {
  const presets = await loadPresetsFromAPI();
  return presets[presetType] || [];
}

/**
 * Get prompts by category (nova função)
 */
export async function getPromptsByCategory(category: PromptCategory): Promise<any[]> {
  const presets = await loadPresetsFromAPI();
  if (category === 'all') {
    // Retornar todos, incluindo categorias antigas e novas
    return [
      ...(presets['3d'] || []),
      ...(presets['presets'] || []),
      ...(presets['aesthetics'] || []),
      ...(presets['themes'] || []),
      ...(presets['mockup'] || []),
      ...(presets['angle'] || []),
      ...(presets['texture'] || []),
      ...(presets['ambience'] || []),
      ...(presets['luminance'] || []),
    ];
  }
  return presets[category] || [];
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

/**
 * Get global community stats
 */
export async function getCommunityStats(): Promise<{ totalUsers: number; totalPresets: number; totalBlankMockups: number }> {
  try {
    const response = await fetch('/api/community/stats');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to fetch community stats:', error);
  }
  return { totalUsers: 0, totalPresets: 0, totalBlankMockups: 0 };
}


