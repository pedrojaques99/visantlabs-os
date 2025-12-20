import type { MockupPreset, MockupPresetType } from '../types/mockupPresets';
import type { UploadedImage } from '../types';
import { MOCKUP_PRESETS } from '../types/mockupPresets';

// Cache for MongoDB presets
let cachedPresets: MockupPreset[] | null = null;
let isLoadingPresets = false;

/**
 * Load presets from MongoDB API and merge with TypeScript defaults
 * MongoDB presets take priority over defaults with same ID
 * Also includes community presets
 */
async function loadPresetsFromMongoDB(): Promise<MockupPreset[]> {
  if (isLoadingPresets) {
    // Wait for ongoing load
    while (isLoadingPresets) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedPresets || MOCKUP_PRESETS;
  }

  if (cachedPresets) {
    return cachedPresets;
  }

  isLoadingPresets = true;
  try {
    // Load admin presets
    const adminResponse = await fetch('/api/admin/presets/public');
    let adminPresets: MockupPreset[] = [];
    
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      if (adminData.mockupPresets && Array.isArray(adminData.mockupPresets) && adminData.mockupPresets.length > 0) {
        // Normalize admin presets to ensure referenceImageUrl is always a string
        adminPresets = adminData.mockupPresets.map((p: any) => ({
          ...p,
          referenceImageUrl: p.referenceImageUrl || '',
        }));
      }
    }

    // Load community presets
    let communityPresets: MockupPreset[] = [];
    try {
      const communityResponse = await fetch('/api/community/presets/public');
      if (communityResponse.ok) {
        const communityData = await communityResponse.json();
        console.log('[mockupPresetsService] Community presets response:', {
          hasMockup: !!communityData.mockup,
          mockupCount: communityData.mockup?.length || 0,
          mockupIds: communityData.mockup?.map((p: any) => p.id) || [],
        });
        if (communityData.mockup && Array.isArray(communityData.mockup) && communityData.mockup.length > 0) {
          // Normalize community presets to ensure referenceImageUrl is always a string
          communityPresets = communityData.mockup.map((p: any) => ({
            ...p,
            referenceImageUrl: p.referenceImageUrl || '',
          }));
          console.log('[mockupPresetsService] Normalized community presets:', communityPresets.map(p => ({ id: p.id, name: p.name })));
        }
      } else {
        console.warn('[mockupPresetsService] Community presets API returned non-ok status:', communityResponse.status, communityResponse.statusText);
      }
    } catch (communityError) {
      console.error('[mockupPresetsService] Failed to load community presets, continuing without them:', communityError);
    }
    
    // Merge all presets: admin presets take priority, then community, then defaults
    // Create maps for quick lookup
    const defaultPresetsMap = new Map(MOCKUP_PRESETS.map(p => [p.id, p]));
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
    
    // Add default presets that don't exist in admin or community
    MOCKUP_PRESETS.forEach(defaultPreset => {
      if (!adminPresetsMap.has(defaultPreset.id) && !communityPresetsMap.has(defaultPreset.id)) {
        merged.push(defaultPreset);
      }
    });
    
    cachedPresets = merged;
    // Log presets with referenceImageUrl for debugging
    const presetsWithRefImage = merged.filter(p => p.referenceImageUrl && p.referenceImageUrl.trim() !== '');
    console.log(`[mockupPresetsService] Loaded ${merged.length} presets (${adminPresets.length} admin, ${communityPresets.length} community, ${MOCKUP_PRESETS.length} defaults)`);
    if (presetsWithRefImage.length > 0) {
      console.log(`[mockupPresetsService] Presets with referenceImageUrl: ${presetsWithRefImage.length}`, 
        presetsWithRefImage.map(p => ({ id: p.id, refImageUrl: p.referenceImageUrl.substring(0, 50) }))
      );
    }
    return cachedPresets;
  } catch (error) {
    console.warn('Failed to load presets from MongoDB, using TypeScript fallback:', error);
  } finally {
    isLoadingPresets = false;
  }

  // If MongoDB failed or returned empty, use defaults
  cachedPresets = MOCKUP_PRESETS;
  return MOCKUP_PRESETS;
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
  await loadPresetsFromMongoDB();
}

/**
 * Clear cache (useful when you want to force a reload on next access)
 */
export function clearPresetsCache(): void {
  cachedPresets = null;
}

/**
 * Update cache with presets (called by modal after loading)
 * Invalidates cache to force reload that includes community presets
 */
export function updatePresetsCache(presets: MockupPreset[]): void {
  // Invalidate cache to force a full reload that includes community presets
  // This ensures community presets are always included
  cachedPresets = null;
}

/**
 * Get a specific preset by ID (synchronous, uses cache)
 */
export function getPreset(presetId: MockupPresetType | string): MockupPreset | undefined {
  const presets = cachedPresets || MOCKUP_PRESETS;
  return presets.find(preset => preset.id === presetId);
}

/**
 * Get all available presets (synchronous, uses cache)
 */
export function getAllPresets(): MockupPreset[] {
  return cachedPresets || MOCKUP_PRESETS;
}

/**
 * Get a specific preset by ID (async, loads from MongoDB)
 * If not found in cache, clears cache and tries again to ensure community presets are loaded
 */
export async function getPresetAsync(presetId: MockupPresetType | string): Promise<MockupPreset | undefined> {
  let presets = await loadPresetsFromMongoDB();
  let found = presets.find(preset => preset.id === presetId);
  
  // If not found, clear cache and try again (in case community presets weren't loaded)
  if (!found) {
    console.warn(`[mockupPresetsService] Preset ${presetId} not found in cache, clearing cache and retrying...`);
    cachedPresets = null;
    presets = await loadPresetsFromMongoDB();
    found = presets.find(preset => preset.id === presetId);
  }
  
  if (!found) {
    console.error(`[mockupPresetsService] Preset not found after retry: ${presetId}. Available preset IDs:`, presets.map(p => p.id).slice(0, 20));
  } else {
    console.log(`[mockupPresetsService] Found preset: ${presetId}`, { name: found.name, hasRefImage: !!found.referenceImageUrl });
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
    console.warn(`No reference image URL for preset ${preset.id}`);
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









