import type { MockupPreset, MockupPresetType } from '../types/mockupPresets.js';
import type { UploadedImage } from '../types.js';
import { MOCKUP_PRESETS } from '../types/mockupPresets.js';
import { TEXTURE_PRESETS } from '../types/texturePresets.js';
import { ANGLE_PRESETS } from '../types/anglePresets.js';
import { AMBIENCE_PRESETS } from '../types/ambiencePresets.js';
import { LUMINANCE_PRESETS } from '../types/luminancePresets.js';
import { getAllCommunityPresets } from './communityPresetsService';

// Combine all static presets
const ALL_STATIC_PRESETS: MockupPreset[] = [
  ...MOCKUP_PRESETS,
  ...TEXTURE_PRESETS.map(p => ({ ...p, referenceImageUrl: '', id: p.id as string })),
  ...ANGLE_PRESETS.map(p => ({ ...p, referenceImageUrl: '', id: p.id as string })),
  ...AMBIENCE_PRESETS.map(p => ({ ...p, referenceImageUrl: '', id: p.id as string })),
  ...LUMINANCE_PRESETS.map(p => ({ ...p, referenceImageUrl: '', id: p.id as string })),
];

import { fetchAllOfficialPresets, clearPresetsCache as clearUnifiedCache } from './unifiedPresetService';

// Cache for loaded presets
let cachedPresets: MockupPreset[] | null = null;
let isLoadingPresets = false;

/**
 * Load presets from MongoDB API and merge with TypeScript defaults
 * MongoDB presets take priority over defaults with same ID
 * Also includes community presets (via communityPresetsService)
 */
async function loadPresetsFromMongoDB(): Promise<MockupPreset[]> {
  if (isLoadingPresets) {
    // Wait for ongoing load
    while (isLoadingPresets) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedPresets || ALL_STATIC_PRESETS;
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    // 1. Load official presets using unified service
    const official = await fetchAllOfficialPresets();
    const adminPresets = official.mockupPresets.map(p => ({
      ...p,
      referenceImageUrl: p.referenceImageUrl || '',
    }));

    // 2. Load community presets using the dedicated service
    let communityPresets: MockupPreset[] = [];
    try {
      const allCommunityData = await getAllCommunityPresets();

      // Flatten grouped presets into a single array
      Object.entries(allCommunityData).forEach(([type, list]) => {
        if (Array.isArray(list) && list.length > 0) {
          const typedPresets = list.map((p: any) => ({
            ...p,
            referenceImageUrl: p.referenceImageUrl || '',
            // Ensure we preserve the type info if needed by the modal/node later
            presetType: type
          }));
          communityPresets = [...communityPresets, ...typedPresets];
        }
      });

      console.log(`[mockupPresetsService] Flattened ${communityPresets.length} community presets from service.`);
    } catch (communityError) {
      console.error('[mockupPresetsService] Failed to load community presets via service:', communityError);
    }

    // 3. Merge all presets: admin presets take priority, then community, then defaults
    const adminPresetsMap = new Map(adminPresets.map((p: MockupPreset) => [p.id, p]));
    const communityPresetsMap = new Map(communityPresets.map((p: MockupPreset) => [p.id, p]));

    // Start with admin presets (highest priority)
    const merged: MockupPreset[] = [...adminPresets];

    // Add community presets that don't conflict with admin presets
    communityPresets.forEach(communityPreset => {
      if (!adminPresetsMap.has(communityPreset.id)) {
        merged.push(communityPreset);
      }
    });

    // Add static/default presets that don't exist in admin or community
    ALL_STATIC_PRESETS.forEach(staticPreset => {
      if (!adminPresetsMap.has(staticPreset.id) && !communityPresetsMap.has(staticPreset.id)) {
        merged.push(staticPreset);
      }
    });

    cachedPresets = merged;

    // Debug logging
    console.log(`[mockupPresetsService] FINAL LOAD: ${merged.length} total presets. (Admin: ${adminPresets.length}, Community: ${communityPresets.length}, Static: ${ALL_STATIC_PRESETS.length})`);

    return cachedPresets;
  } catch (error) {
    console.warn('Failed to load presets from MongoDB, using TypeScript fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  // If MongoDB failed or returned empty, use defaults
  cachedPresets = ALL_STATIC_PRESETS;
  return ALL_STATIC_PRESETS;
}

/**
 * Initialize presets (call this on app startup)
 */
export async function initializePresets(): Promise<void> {
  await loadPresetsFromMongoDB();
}

/**
 * Clear cache and reload presets (useful after admin changes or when community presets might have changed)
 */
export async function refreshPresets(): Promise<void> {
  cachedPresets = null;
  clearUnifiedCache();
  await loadPresetsFromMongoDB();
}

/**
 * Clear cache (useful when you want to force a reload on next access)
 */
export function clearPresetsCache(): void {
  cachedPresets = null;
  clearUnifiedCache();
}

/**
 * Update cache with presets (called by modal after loading)
 * Invalidates cache to force reload that includes community presets
 */
export function updatePresetsCache(presets: MockupPreset[]): void {
  // Invalidate cache to force a full reload that includes community presets
  cachedPresets = null;
  clearUnifiedCache();
}

/**
 * Get a specific preset by ID (synchronous, uses cache)
 */
export function getPreset(presetId: MockupPresetType | string): MockupPreset | undefined {
  const presets = cachedPresets || ALL_STATIC_PRESETS;
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available presets (synchronous, uses cache)
 */
export function getAllPresets(): MockupPreset[] {
  return cachedPresets || ALL_STATIC_PRESETS;
}

/**
 * Get a specific preset by ID (async, loads from MongoDB)
 * If not found in cache, clears cache and tries again to ensure community presets are loaded
 * Also explicitly checks ALL_STATIC_PRESETS as a fallback
 */
export async function getPresetAsync(presetId: MockupPresetType | string): Promise<MockupPreset | undefined> {
  let presets = await loadPresetsFromMongoDB();
  let found = presets.find(preset => preset.id === presetId);

  // If not found in loaded presets, check if it's in the static list (just in case merge failed)
  if (!found) {
    found = ALL_STATIC_PRESETS.find(p => p.id === presetId);
    if (found) {
      console.warn(`[mockupPresetsService] Preset ${presetId} found in static fallback but was missing from cached presets.`);
    }
  }

  // If still not found, clear cache and try again (deep re-fetch)
  if (!found) {
    console.warn(`[mockupPresetsService] Preset ${presetId} not found in cache or static, clearing cache and retrying...`);
    cachedPresets = null;
    presets = await loadPresetsFromMongoDB();
    found = presets.find(preset => preset.id === presetId);

    // Double check static fallback again
    if (!found) {
      found = ALL_STATIC_PRESETS.find(p => p.id === presetId);
    }
  }

  if (!found) {
    console.error(`[mockupPresetsService] Preset not found after retry: ${presetId}.`);
  } else {
    console.log(`[mockupPresetsService] Found preset: ${presetId}`, { name: found.name });
  }
  return found;
}

/**
 * Get all available presets (async, loads from MongoDB)
 */
export async function getAllPresetsAsync(): Promise<MockupPreset[]> {
  return await loadPresetsFromMongoDB();
}

/**
 * Load reference image from R2 URL and convert to UploadedImage
 */
export async function loadReferenceImage(preset: MockupPreset): Promise<UploadedImage | null> {
  if (!preset.referenceImageUrl || preset.referenceImageUrl.trim() === '') {
    // Some presets (like static textures) don't have reference images, which is fine
    // console.warn(`No reference image URL for preset ${preset.id}`);
    return null;
  }

  try {
    // Fetch image from R2 URL
    const response = await fetch(preset.referenceImageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch reference image: ${response.statusText}`);
      return null;
    }

    // Convert to blob then to base64
    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          base64,
          mimeType: blob.type || 'image/png',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error loading reference image for preset ${preset.id}:`, error);
    return null;
  }
}
