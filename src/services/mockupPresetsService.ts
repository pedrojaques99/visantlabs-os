import type { MockupPreset, MockupPresetType } from '../types/mockupPresets.js';
import type { UploadedImage } from '../types/types.js';
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
import { normalizeImageToBase64, detectMimeType } from './reactFlowService';

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

    // 2. Load community presets
    let communityPresets: MockupPreset[] = [];
    try {
      const allCommunity = await getAllCommunityPresets();
      communityPresets = (allCommunity['mockup'] || []) as MockupPreset[];
    } catch (e) {
      console.warn('Failed to load community presets:', e);
    }

    // 3. Merge: Admin presets override static ones with same ID; then append community
    // Start with static
    const mergedMap = new Map<string, MockupPreset>();
    ALL_STATIC_PRESETS.forEach(p => mergedMap.set(p.id as string, p));

    // Override with admin
    adminPresets.forEach(p => mergedMap.set(p.id as string, p));

    // Convert back to array
    const mergedOfficial = Array.from(mergedMap.values());

    // Combine with community (community IDs should not conflict with official ideally, or simply append)
    cachedPresets = [...mergedOfficial, ...communityPresets];

    return cachedPresets;
  } catch (error) {
    console.error('Failed to load presets:', error);
    // Fallback to static
    return ALL_STATIC_PRESETS;
  } finally {
    isLoadingPresets = false;
  }
}

export const getAllPresets = (): MockupPreset[] => {
  return cachedPresets || ALL_STATIC_PRESETS;
};

export const getAllPresetsAsync = async (): Promise<MockupPreset[]> => {
  return loadPresetsFromMongoDB();
};

export const getPresetAsync = async (id: string): Promise<MockupPreset | undefined> => {
  const all = await getAllPresetsAsync();
  return all.find(p => p.id === id);
};

/**
 * Get ONLY mockup category presets (excluding angles, textures, etc.)
 * Merges Static MOCKUP_PRESETS + Admin Mockup Presets + Community Mockup Presets
 */
export async function getMockupCategoriesAsync(): Promise<MockupPreset[]> {
  try {
    // 1. Fetch official and community data
    const [official, allCommunity] = await Promise.all([
      fetchAllOfficialPresets(),
      getAllCommunityPresets()
    ]);

    // 2. Prepare sources
    const staticPresets = MOCKUP_PRESETS;
    const adminPresets = official.mockupPresets.map(p => ({
      ...p,
      referenceImageUrl: p.referenceImageUrl || '',
    }));
    const communityPresets = (allCommunity['mockup'] || []) as MockupPreset[];

    // 3. Merge: Admin overrides Static by ID
    const mergedMap = new Map<string, MockupPreset>();

    // Add static first
    staticPresets.forEach(p => mergedMap.set(p.id as string, p));

    // Override/Add admin
    adminPresets.forEach(p => mergedMap.set(p.id as string, p));

    // 4. Return merged official + community
    return [...Array.from(mergedMap.values()), ...communityPresets];

  } catch (error) {
    console.warn('Failed to fetch mockup categories, returning defaults:', error);
    return MOCKUP_PRESETS;
  }
}

export const getPreset = (id: string): MockupPreset | undefined => {
  const all = getAllPresets();
  return all.find(p => p.id === id);
};

export const loadReferenceImage = async (preset: MockupPreset): Promise<{ base64: string; mimeType: string } | null> => {
  if (!preset.referenceImageUrl || preset.referenceImageUrl.trim() === '') {
    return null;
  }

  try {
    const base64 = await normalizeImageToBase64(preset.referenceImageUrl);
    const mimeType = detectMimeType(preset.referenceImageUrl);
    return { base64, mimeType };
  } catch (error) {
    console.error(`Failed to load reference image for preset ${preset.id}:`, error);
    return null;
  }
};

export const updatePresetsCache = (presets: MockupPreset[]) => {
  cachedPresets = presets;
};

export const clearPresetsCache = () => {
  cachedPresets = null;
  clearUnifiedCache();
};

export const mockupPresetsService = {
  getAll: getAllPresets,
  getAllAsync: getAllPresetsAsync,
  getCategoriesAsync: getMockupCategoriesAsync,
  getById: getPreset,
  getByIdAsync: getPresetAsync,
  loadReferenceImage,
  updateCache: updatePresetsCache,
  clearCache: clearPresetsCache
};
