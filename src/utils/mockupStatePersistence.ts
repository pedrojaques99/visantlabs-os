/**
 * Persistence utilities for MockupMachinePage state
 * Handles saving and loading mockup state to/from localStorage with performance limits
 */

import type { UploadedImage, AspectRatio, DesignType, GeminiModel, Resolution } from '../types/types';

const STORAGE_KEY = 'mockup-machine-state';
const MAX_STATE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB (String length; browsers use 2 bytes per char, so 4MB actual storage)
const MAX_AGE_DAYS = 7;
const MAX_SUGGESTED_ITEMS = 25; // Further reduced from 40 to save space
const MAX_PROMPT_PREVIEW_LENGTH = 2000;
const MAX_IMAGE_BASE64_SIZE_BYTES = 150 * 1024; // 150KB limit for base64 in LocalStorage

const isHttpUrl = (s: string | undefined): s is string =>
  !!s && (s.startsWith('http://') || s.startsWith('https://'));

const cap = <T>(arr: T[] | undefined, n: number): T[] =>
  (arr || []).slice(0, n);

export interface PersistedMockupState {
  mockups: (string | null)[];
  uploadedImage: UploadedImage | null;
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
  if (typeof data.timestamp !== 'number') return false;

  // Check timestamp is not too old (max 7 days)
  const ageInDays = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
  if (ageInDays > MAX_AGE_DAYS) return false;

  // State is valid if it has at least one of these:
  // 1. Generated mockups
  const hasMockups = Array.isArray(data.mockups) && data.mockups.some((m: any) => m !== null);
  // 2. An uploaded primary image
  const hasImage = !!data.uploadedImage && (isHttpUrl(data.uploadedImage.url) || !!data.uploadedImage.base64);
  // 3. Any selected tags (user has started work)
  const hasSelectedTags =
    (Array.isArray(data.selectedTags) && data.selectedTags.length > 0) ||
    (Array.isArray(data.selectedBrandingTags) && data.selectedBrandingTags.length > 0) ||
    (Array.isArray(data.designType) && !!data.designType);

  return hasMockups || hasImage || hasSelectedTags;
}

/**
 * Save mockup state to localStorage
 */
export const saveMockupState = (state: PersistedMockupState): void => {
  try {
    console.log('[💾 Persistence] saveMockupState called', {
      hasMockups: state.mockups?.filter(m => m !== null).length || 0,
      hasUploadedImage: !!state.uploadedImage,
      uploadedImageHasUrl: !!state.uploadedImage?.url,
      uploadedImageHasBase64: !!state.uploadedImage?.base64,
      uploadedImageBase64Size: state.uploadedImage?.base64?.length || 0,
      referenceImagesCount: state.referenceImages?.length || 0,
      timestamp: new Date().toISOString()
    });

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
      // We prioritize HTTP(S) URLs but allow base64 fallback if small
      mockups: Array.isArray(state.mockups)
        ? state.mockups.map(m => {
          if (!m) return null;
          if (typeof m === 'string' && (m.startsWith('http://') || m.startsWith('https://'))) return m;
          // Don't persist base64 mockups to save space
          return null;
        })
        : [],

      // Persist uploaded image (URL or base64 if small)
      uploadedImage: state.uploadedImage
        ? {
          url: isHttpUrl(state.uploadedImage.url) ? state.uploadedImage.url : undefined,
          base64: (!isHttpUrl(state.uploadedImage.url) && state.uploadedImage.base64 && state.uploadedImage.base64.length < MAX_IMAGE_BASE64_SIZE_BYTES)
            ? state.uploadedImage.base64
            : undefined,
          mimeType: state.uploadedImage.mimeType,
          size: state.uploadedImage.size
        }
        : null,

      referenceImages: (state.referenceImages || [])
        .map(img => ({
          url: isHttpUrl(img.url) ? img.url : undefined,
          base64: (!isHttpUrl(img.url) && img.base64 && img.base64.length < MAX_IMAGE_BASE64_SIZE_BYTES)
            ? img.base64
            : undefined,
          mimeType: img.mimeType,
          size: img.size
        }))
        .filter(img => img.url || img.base64) // Keep only if we have some data
    };

    console.log('[💾 Persistence] Sanitized state prepared', {
      mockupsKept: sanitizedState.mockups.filter(m => m !== null).length,
      uploadedImageKept: !!sanitizedState.uploadedImage,
      uploadedImageUrlKept: !!sanitizedState.uploadedImage?.url,
      uploadedImageBase64Kept: !!sanitizedState.uploadedImage?.base64,
      referenceImagesKept: sanitizedState.referenceImages.length
    });

    let serializedState = JSON.stringify(sanitizedState);
    let sizeInBytes = new Blob([serializedState]).size;

    console.log('[💾 Persistence] Initial size:', (sizeInBytes / 1024).toFixed(2) + 'KB',
      'Max allowed:', (MAX_STATE_SIZE_BYTES / 1024).toFixed(0) + 'KB');

    // If still too large, try to remove reference image base64s first
    if (sizeInBytes > MAX_STATE_SIZE_BYTES) {
      console.warn('[💾 Persistence] ⚠️ State too large, removing reference image base64s');
      sanitizedState.referenceImages = sanitizedState.referenceImages.map(img => ({
        ...img,
        base64: undefined // Remove base64 from refs
      }));
      serializedState = JSON.stringify(sanitizedState);
      sizeInBytes = new Blob([serializedState]).size;
      console.log('[💾 Persistence] After removing ref base64s:', (sizeInBytes / 1024).toFixed(2) + 'KB');
    }

    // If STILL too large, remove primary image base64 as last resort
    if (sizeInBytes > MAX_STATE_SIZE_BYTES && sanitizedState.uploadedImage?.base64) {
      console.warn('[💾 Persistence] ⚠️ Still too large, removing primary image base64');
      sanitizedState.uploadedImage.base64 = undefined;
      serializedState = JSON.stringify(sanitizedState);
      sizeInBytes = new Blob([serializedState]).size;
      console.log('[💾 Persistence] After removing primary base64:', (sizeInBytes / 1024).toFixed(2) + 'KB');
    }

    if (sizeInBytes > MAX_STATE_SIZE_BYTES) {
      console.warn(`[💾 Persistence] ❌ State still too large (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB) even after slimming, skipping save`);
      return;
    }

    localStorage.setItem(STORAGE_KEY, serializedState);
    console.log('[💾 Persistence] ✅ State saved successfully', (sizeInBytes / 1024).toFixed(2) + 'KB');
  } catch (error) {
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.message?.includes('quota'))) {
      console.warn('[💾 Persistence] ⚠️ LocalStorage quota exceeded, attempting minimal CORE state save');
      try {
        // Guaranteed minimal state: only tags and settings, NO images, NO large suggestions
        const minimalState: Partial<PersistedMockupState> = {
          designType: state.designType,
          selectedTags: state.selectedTags,
          selectedBrandingTags: state.selectedBrandingTags,
          selectedLocationTags: state.selectedLocationTags,
          selectedAngleTags: state.selectedAngleTags,
          selectedColors: state.selectedColors,
          aspectRatio: state.aspectRatio,
          selectedModel: state.selectedModel,
          resolution: state.resolution,
          hasGenerated: state.hasGenerated,
          mockupCount: state.mockupCount,
          instructions: state.instructions?.slice(0, 500),
          timestamp: Date.now(),
          mockups: [],
          uploadedImage: null,
          referenceImages: [],
          suggestedTags: cap(state.suggestedTags, 5),
          suggestedBrandingTags: cap(state.suggestedBrandingTags, 5),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalState));
        console.log('[💾 Persistence] ✅ Minimal core state saved successfully');
      } catch (innerError) {
        console.error('[💾 Persistence] ❌ Even minimal state failed to save - storage is completely full. Clearing key.');
        localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      console.error('[💾 Persistence] ❌ Failed to save mockup state:', error);
    }
  }
};

/**
 * Load mockup state from localStorage
 */
export function loadMockupState(): PersistedMockupState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('[💾 Persistence] loadMockupState: No stored state found');
      return null;
    }

    const parsed = JSON.parse(stored);
    const sizeInBytes = new Blob([stored]).size;

    console.log('[💾 Persistence] loadMockupState: Found state', {
      sizeKB: (sizeInBytes / 1024).toFixed(2),
      hasMockups: parsed.mockups?.filter((m: any) => m !== null).length || 0,
      hasUploadedImage: !!parsed.uploadedImage,
      uploadedImageHasUrl: !!parsed.uploadedImage?.url,
      uploadedImageHasBase64: !!parsed.uploadedImage?.base64,
      referenceImagesCount: parsed.referenceImages?.length || 0,
      ageMinutes: parsed.timestamp ? ((Date.now() - parsed.timestamp) / 60000).toFixed(1) : 'unknown'
    });

    if (!isValidState(parsed)) {
      console.warn('[💾 Persistence] loadMockupState: State invalid or expired, removing');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    console.log('[💾 Persistence] ✅ loadMockupState: State loaded successfully');
    return parsed;
  } catch (error) {
    console.error('[💾 Persistence] ❌ loadMockupState: Failed to load state:', error);
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
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const sizeInBytes = new Blob([stored]).size;
      console.log('[💾 Persistence] clearMockupState: Clearing state', {
        sizeKB: (sizeInBytes / 1024).toFixed(2)
      });
    }
    localStorage.removeItem(STORAGE_KEY);
    console.log('[💾 Persistence] ✅ clearMockupState: State cleared');
  } catch (error) {
    console.error('[💾 Persistence] ❌ clearMockupState: Failed to clear state:', error);
  }
}

