/**
 * Persistence utilities for Surprise Me settings
 * Handles saving and loading excluded tags configuration to/from localStorage
 */

export interface SurpriseMeExcludedTags {
  excludedCategoryTags: string[];
  excludedLocationTags: string[];
  excludedAngleTags: string[];
  excludedLightingTags: string[];
  excludedEffectTags: string[];
  excludedMaterialTags: string[];
}

const STORAGE_KEY = 'surprise-me-excluded-tags';

const DEFAULT_EXCLUDED_TAGS: SurpriseMeExcludedTags = {
  excludedCategoryTags: [],
  excludedLocationTags: [],
  excludedAngleTags: [],
  excludedLightingTags: [],
  excludedEffectTags: [],
  excludedMaterialTags: [],
};

/**
 * Get excluded tags from localStorage
 */
export function getSurpriseMeExcludedTags(): SurpriseMeExcludedTags {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_EXCLUDED_TAGS;

    const parsed = JSON.parse(stored);
    
    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_EXCLUDED_TAGS;
    }

    return {
      excludedCategoryTags: Array.isArray(parsed.excludedCategoryTags) ? parsed.excludedCategoryTags : [],
      excludedLocationTags: Array.isArray(parsed.excludedLocationTags) ? parsed.excludedLocationTags : [],
      excludedAngleTags: Array.isArray(parsed.excludedAngleTags) ? parsed.excludedAngleTags : [],
      excludedLightingTags: Array.isArray(parsed.excludedLightingTags) ? parsed.excludedLightingTags : [],
      excludedEffectTags: Array.isArray(parsed.excludedEffectTags) ? parsed.excludedEffectTags : [],
      excludedMaterialTags: Array.isArray(parsed.excludedMaterialTags) ? parsed.excludedMaterialTags : [],
    };
  } catch (error) {
    // Corrupted data, return default
    console.warn('Failed to load Surprise Me excluded tags:', error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore cleanup errors
    }
    return DEFAULT_EXCLUDED_TAGS;
  }
}

/**
 * Save excluded tags to localStorage
 */
export function saveSurpriseMeExcludedTags(tags: SurpriseMeExcludedTags): boolean {
  try {
    const jsonString = JSON.stringify(tags);
    localStorage.setItem(STORAGE_KEY, jsonString);
    return true;
  } catch (error) {
    console.warn('Failed to save Surprise Me excluded tags:', error);
    return false;
  }
}





