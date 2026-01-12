import { migrateLegacyPreset } from '../types/communityPrompts.js';
import type { PromptCategory } from '../types/communityPrompts.js';

// Cache for community presets
let presetsPromise: Promise<Record<string, any[]>> | null = null;
let lastToken: string | null = null;

/**
 * Load community presets from API
 */
async function loadPresetsFromAPI(): Promise<Record<string, any[]>> {
  // Dynamic import to avoid circular dependencies if any
  const { authService } = await import('./authService');
  const token = authService.getToken();

  // If we have a cached promise and the token hasn't changed, return it
  if (presetsPromise && lastToken === token) {
    return presetsPromise;
  }

  // Update token tracker
  lastToken = token;

  presetsPromise = (async () => {
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/community/presets/public', {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        // Migrar presets legados e estruturar por categoria
        return {
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
      }
    } catch (error) {
      console.warn('Failed to load community presets from API, using empty fallback:', error);
      presetsPromise = null; // Reset on error to allow retry
      lastToken = null; // Reset token on error
    }

    // Return empty fallback on error or non-ok response
    return {
      '3d': [], 'presets': [], 'aesthetics': [], 'themes': [],
      // Compatibilidade
      mockup: [], angle: [], texture: [], ambience: [], luminance: []
    };
  })();

  return presetsPromise;
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
    const allPresets = [
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

    // Remove overlapping duplicates
    const uniqueMap = new Map<string, any>();
    allPresets.forEach((preset) => {
      const id = preset._id || preset.id;
      if (id && !uniqueMap.has(id)) {
        uniqueMap.set(id, preset);
      }
    });

    return Array.from(uniqueMap.values());
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
  presetsPromise = null;
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


