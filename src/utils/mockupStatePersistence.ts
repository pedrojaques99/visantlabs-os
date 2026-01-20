/**
 * Persistence utilities for MockupMachinePage state
 * Handles saving and loading mockup state to/from localStorage with performance limits
 */

import type { UploadedImage, AspectRatio, DesignType, GeminiModel, Resolution } from '../types/types';

const STORAGE_KEY = 'mockup-machine-state';
const MAX_STATE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB (Browser limit is usually 5MB)
const MAX_AGE_DAYS = 7; // Maximum age of saved state in days
const MAX_SUGGESTED_ITEMS = 40; // Cap array size to reduce quota usage
const MAX_PROMPT_PREVIEW_LENGTH = 4000;

const isHttpUrl = (s: string | undefined): s is string =>
  !!s && (s.startsWith('http://') || s.startsWith('https://'));

const cap = <T>(arr: T[] | undefined, n: number): T[] =>
  (arr || []).slice(0, n);

export interface PersistedMockupState {
  mockups: (string | null)[];
  uploadedImage: UploadedImage | null;
  referenceImage: UploadedImage | null;
  referenceImages: UploadedImage[];
  designType: DesignType | null;
  selectedTags: string[];
  selectedBrandingTags: string[];
  selectedLocationTags: string[];
  selectedAngleTags: string[];
  selectedLightingTags: string[];
  selectedEffectTags: string[];
  selectedColors: string[];
  suggestedTags: string[];
  suggestedBrandingTags: string[];
  suggestedLocationTags: string[];
  suggestedAngleTags: string[];
  suggestedLightingTags: string[];
  suggestedEffectTags: string[];
  suggestedMaterialTags: string[];
  suggestedColors: string[];
  promptPreview: string;
  aspectRatio: AspectRatio;
  selectedModel: GeminiModel | null;
  resolution: Resolution;
  hasGenerated: boolean;
  mockupCount: number;
  generateText: boolean;
  withHuman: boolean;
  enhanceTexture: boolean;
  negativePrompt: string;
  additionalPrompt: string;
  instructions: string;
  timestamp: number;
}

/**
 * Validate persisted state structure
 */
function isValidState(data: any): data is PersistedMockupState {
  if (!data || typeof data !== 'object') return false;

  // Check required fields
  if (!Array.isArray(data.mockups)) return false;
  if (typeof data.timestamp !== 'number') return false;

  // Check timestamp is not too old
  const ageInDays = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
  if (ageInDays > MAX_AGE_DAYS) return false;

  // Check if state has at least one mockup
  const hasMockups = data.mockups.some((m: any) => m !== null);
  if (!hasMockups) return false;

  return true;
}

/**
 * Save mockup state to localStorage
 */
export const saveMockupState = (state: PersistedMockupState): void => {
  try {
    // SECURITY/QUOTA: NEVER save base64 strings to localStorage
    // Instead of deep cloning, we manually construct the sanitized state
    // This is more memory efficient and safer against large data leaks

    const sanitizedState: PersistedMockupState = {
      designType: state.designType,
      selectedTags: state.selectedTags,
      selectedBrandingTags: state.selectedBrandingTags,
      selectedLocationTags: state.selectedLocationTags,
      selectedAngleTags: state.selectedAngleTags,
      selectedLightingTags: state.selectedLightingTags,
      selectedEffectTags: state.selectedEffectTags,
      selectedColors: state.selectedColors,
      suggestedTags: cap(state.suggestedTags, MAX_SUGGESTED_ITEMS),
      suggestedBrandingTags: cap(state.suggestedBrandingTags, MAX_SUGGESTED_ITEMS),
      suggestedLocationTags: cap(state.suggestedLocationTags, MAX_SUGGESTED_ITEMS),
      suggestedAngleTags: cap(state.suggestedAngleTags, MAX_SUGGESTED_ITEMS),
      suggestedLightingTags: cap(state.suggestedLightingTags, MAX_SUGGESTED_ITEMS),
      suggestedEffectTags: cap(state.suggestedEffectTags, MAX_SUGGESTED_ITEMS),
      suggestedMaterialTags: cap(state.suggestedMaterialTags, MAX_SUGGESTED_ITEMS),
      suggestedColors: cap(state.suggestedColors, MAX_SUGGESTED_ITEMS),
      promptPreview: typeof state.promptPreview === 'string'
        ? state.promptPreview.slice(0, MAX_PROMPT_PREVIEW_LENGTH)
        : '',
      aspectRatio: state.aspectRatio,
      selectedModel: state.selectedModel,
      resolution: state.resolution,
      hasGenerated: state.hasGenerated,
      mockupCount: state.mockupCount,
      generateText: state.generateText,
      withHuman: state.withHuman,
      enhanceTexture: state.enhanceTexture,
      negativePrompt: state.negativePrompt,
      additionalPrompt: state.additionalPrompt,
      instructions: state.instructions,
      timestamp: state.timestamp,

      // Complex fields - sanitization required
      // Only persist HTTP(S) URLs; never base64 or data URLs
      mockups: Array.isArray(state.mockups)
        ? state.mockups.map(m => {
            if (!m) return null;
            if (typeof m === 'string' && (m.startsWith('http://') || m.startsWith('https://'))) return m;
            return null;
          })
        : [],

      // NEVER save base64. Only persist when url is http(s); data URLs are excluded.
      uploadedImage: isHttpUrl(state.uploadedImage?.url)
        ? { url: state.uploadedImage!.url, mimeType: state.uploadedImage!.mimeType, size: state.uploadedImage!.size }
        : null,

      referenceImage: isHttpUrl(state.referenceImage?.url)
        ? { url: state.referenceImage!.url, mimeType: state.referenceImage!.mimeType, size: state.referenceImage!.size }
        : null,

      referenceImages: state.referenceImages
        .filter(img => isHttpUrl(img.url))
        .map(img => ({ url: img.url!, mimeType: img.mimeType, size: img.size }))
    };

    const serializedState = JSON.stringify(sanitizedState);
    const sizeInBytes = new Blob([serializedState]).size;

    if (sizeInBytes > MAX_STATE_SIZE_BYTES) {
      console.warn(`Mockup state too large (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB), skipping save`);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, serializedState);
  } catch (error) {
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message?.includes('quota'))) {
      console.warn('Storage quota exceeded, clearing saved mockup state');
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    } else {
      console.error('Failed to save mockup state:', error);
    }
  }
};

/**
 * Load mockup state from localStorage
 */
export function loadMockupState(): PersistedMockupState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    if (!isValidState(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to load mockup state:', error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
}

/**
 * Clear mockup state from localStorage
 */
export function clearMockupState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear mockup state:', error);
  }
}
