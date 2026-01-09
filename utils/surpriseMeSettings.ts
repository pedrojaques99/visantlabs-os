/**
 * Persistence utilities for Surprise Me settings
 * Handles saving and loading selected tags configuration to/from localStorage
 * Logic: Only selected tags will be included in Surprise Me generations.
 */

export interface SurpriseMeSelectedTags {
  selectedCategoryTags: string[];
  selectedLocationTags: string[];
  selectedAngleTags: string[];
  selectedLightingTags: string[];
  selectedEffectTags: string[];
  selectedMaterialTags: string[];
}

const STORAGE_KEY = 'surprise-me-selected-tags-v2';

const DEFAULT_SELECTED_TAGS: SurpriseMeSelectedTags = {
  selectedCategoryTags: [], // Empty means ALL if fallback logic is applied, but user wants "unselected = excluded"
  selectedLocationTags: [],
  selectedAngleTags: [],
  selectedLightingTags: [],
  selectedEffectTags: [],
  selectedMaterialTags: [],
};

/**
 * Get selected tags from localStorage
 */
export function getSurpriseMeSelectedTags(): SurpriseMeSelectedTags {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SELECTED_TAGS;

    const parsed = JSON.parse(stored);

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_SELECTED_TAGS;
    }

    return {
      selectedCategoryTags: Array.isArray(parsed.selectedCategoryTags) ? parsed.selectedCategoryTags : [],
      selectedLocationTags: Array.isArray(parsed.selectedLocationTags) ? parsed.selectedLocationTags : [],
      selectedAngleTags: Array.isArray(parsed.selectedAngleTags) ? parsed.selectedAngleTags : [],
      selectedLightingTags: Array.isArray(parsed.selectedLightingTags) ? parsed.selectedLightingTags : [],
      selectedEffectTags: Array.isArray(parsed.selectedEffectTags) ? parsed.selectedEffectTags : [],
      selectedMaterialTags: Array.isArray(parsed.selectedMaterialTags) ? parsed.selectedMaterialTags : [],
    };
  } catch (error) {
    // Corrupted data, return default
    console.warn('Failed to load Surprise Me selected tags:', error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore cleanup errors
    }
    return DEFAULT_SELECTED_TAGS;
  }
}

/**
 * Save selected tags to localStorage
 */
export function saveSurpriseMeSelectedTags(tags: SurpriseMeSelectedTags): boolean {
  try {
    const jsonString = JSON.stringify(tags);
    localStorage.setItem(STORAGE_KEY, jsonString);
    return true;
  } catch (error) {
    console.warn('Failed to save Surprise Me selected tags:', error);
    return false;
  }
}

// Backward compatibility or legacy name support if needed
export type SurpriseMeExcludedTags = SurpriseMeSelectedTags;
export const getSurpriseMeExcludedTags = getSurpriseMeSelectedTags;
export const saveSurpriseMeExcludedTags = saveSurpriseMeSelectedTags;
