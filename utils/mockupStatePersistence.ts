/**
 * Persistence utilities for MockupMachinePage state
 * Handles saving and loading mockup state to/from localStorage with performance limits
 */

import { compressImage, getBase64ImageSize, needsCompression } from './imageCompression';
import type { UploadedImage, AspectRatio, DesignType, GeminiModel, Resolution } from '../types';

const STORAGE_KEY = 'mockup-machine-state';
const MAX_MOCKUPS = 10;
const MAX_STATE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500KB - compress images larger than this
const COMPRESSION_QUALITY = 0.8;
const MAX_AGE_DAYS = 7; // Maximum age of saved state in days

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
  promptPreview: string;
  aspectRatio: AspectRatio;
  selectedModel: GeminiModel | null;
  resolution: Resolution;
  hasGenerated: boolean;
  mockupCount: number;
  generateText: boolean;
  withHuman: boolean;
  negativePrompt: string;
  additionalPrompt: string;
  timestamp: number;
}

/**
 * Compress a base64 image if it exceeds the size limit
 */
async function compressImageIfNeeded(base64Image: string | null): Promise<string | null> {
  if (!base64Image) return null;
  
  try {
    const imageSize = getBase64ImageSize(base64Image);
    
    // Only compress if image is larger than threshold
    if (imageSize > MAX_IMAGE_SIZE_BYTES) {
      const compressed = await compressImage(base64Image, {
        maxWidth: 2048,
        maxHeight: 2048,
        maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
        quality: COMPRESSION_QUALITY,
        mimeType: 'image/jpeg'
      });
      
      // Extract base64 data (remove data URL prefix if present)
      const base64Data = compressed.includes(',') 
        ? compressed.split(',')[1] 
        : compressed;
      
      return base64Data;
    }
    
    // Return base64 without data URL prefix
    return base64Image.includes(',') 
      ? base64Image.split(',')[1] 
      : base64Image;
  } catch (error) {
    // If compression fails, return original (truncated if needed)
    console.warn('Failed to compress image for storage:', error);
    return base64Image.includes(',') 
      ? base64Image.split(',')[1] 
      : base64Image;
  }
}

/**
 * Compress uploaded image if needed
 */
async function compressUploadedImage(image: UploadedImage | null): Promise<UploadedImage | null> {
  if (!image || !image.base64) return image;
  
  try {
    const compressedBase64 = await compressImageIfNeeded(image.base64);
    if (compressedBase64) {
      return {
        ...image,
        base64: compressedBase64
      };
    }
  } catch (error) {
    console.warn('Failed to compress uploaded image:', error);
  }
  
  return image;
}

/**
 * Calculate approximate size of state in bytes
 */
function calculateStateSize(state: PersistedMockupState): number {
  try {
    const jsonString = JSON.stringify(state);
    return new Blob([jsonString]).size;
  } catch {
    // Fallback: estimate based on base64 length
    let size = 0;
    state.mockups.forEach(mockup => {
      if (mockup) {
        size += (mockup.length * 3) / 4; // Approximate binary size from base64
      }
    });
    if (state.uploadedImage?.base64) {
      size += (state.uploadedImage.base64.length * 3) / 4;
    }
    if (state.referenceImage?.base64) {
      size += (state.referenceImage.base64.length * 3) / 4;
    }
    state.referenceImages.forEach(img => {
      if (img.base64) {
        size += (img.base64.length * 3) / 4;
      }
    });
    // Add metadata overhead (estimate 10KB)
    return size + 10 * 1024;
  }
}

/**
 * Limit mockups array to maximum allowed count
 */
function limitMockups(mockups: (string | null)[]): (string | null)[] {
  if (mockups.length <= MAX_MOCKUPS) return mockups;
  
  // Keep only the last MAX_MOCKUPS (most recent)
  return mockups.slice(-MAX_MOCKUPS);
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
export async function saveMockupState(state: Omit<PersistedMockupState, 'timestamp'>): Promise<boolean> {
  try {
    // Limit mockups count
    const limitedMockups = limitMockups(state.mockups);
    
    // Compress images if needed
    const compressedMockups = await Promise.all(
      limitedMockups.map(mockup => compressImageIfNeeded(mockup))
    );
    
    const compressedUploadedImage = await compressUploadedImage(state.uploadedImage);
    const compressedReferenceImage = await compressUploadedImage(state.referenceImage);
    const compressedReferenceImages = await Promise.all(
      state.referenceImages.map(img => compressUploadedImage(img))
    );
    
    // Build state with compressed images
    const stateToSave: PersistedMockupState = {
      ...state,
      mockups: compressedMockups,
      uploadedImage: compressedUploadedImage,
      referenceImage: compressedReferenceImage,
      referenceImages: compressedReferenceImages.filter((img): img is UploadedImage => img !== null),
      timestamp: Date.now()
    };
    
    // Check size and reduce if needed
    let currentSize = calculateStateSize(stateToSave);
    
    if (currentSize > MAX_STATE_SIZE_BYTES) {
      // Remove oldest mockups until size is acceptable
      let reducedMockups = [...stateToSave.mockups];
      while (currentSize > MAX_STATE_SIZE_BYTES && reducedMockups.length > 1) {
        // Remove first (oldest) mockup
        reducedMockups = reducedMockups.slice(1);
        stateToSave.mockups = reducedMockups;
        currentSize = calculateStateSize(stateToSave);
      }
      
      // If still too large, try removing reference images
      if (currentSize > MAX_STATE_SIZE_BYTES && stateToSave.referenceImages.length > 0) {
        stateToSave.referenceImages = [];
        currentSize = calculateStateSize(stateToSave);
      }
    }
    
    // Save to localStorage
    const jsonString = JSON.stringify(stateToSave);
    localStorage.setItem(STORAGE_KEY, jsonString);
    
    return true;
  } catch (error: any) {
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      try {
        // Try to save with fewer mockups
        const reducedState = {
          ...state,
          mockups: state.mockups.slice(-5) // Keep only last 5
        };
        const jsonString = JSON.stringify({
          ...reducedState,
          timestamp: Date.now()
        });
        localStorage.setItem(STORAGE_KEY, jsonString);
        return true;
      } catch (retryError) {
        console.warn('Failed to save mockup state after quota error:', retryError);
        return false;
      }
    }
    
    console.warn('Failed to save mockup state:', error);
    return false;
  }
}

/**
 * Load mockup state from localStorage
 */
export function loadMockupState(): PersistedMockupState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    if (!isValidState(parsed)) {
      // Invalid state, remove it
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return parsed;
  } catch (error) {
    // Corrupted data, remove it
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

