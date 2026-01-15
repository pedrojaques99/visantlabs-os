import { getCreditsRequired, getVideoCreditsRequired } from '../utils/creditCalculator.js';
import type { GeminiModel, Resolution, UploadedImage } from '../types/types.js';
import { toast } from 'sonner';
import { mockupApi } from './mockupApi';
import { subscriptionService } from './subscriptionService';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  // Use relative URL - works in both local (with proxy) and production
  // In production on Vercel: /api redirects to serverless function
  // In local dev: vite.config.ts proxy redirects /api to http://localhost:3001
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Check if URL is from R2 (Cloudflare R2 bucket)
 */
const isR2Url = (url: string): boolean => {
  return url.includes('.r2.dev');
};

/**
 * Convert image URL to base64 using proxy for R2 URLs
 */
const urlToBase64 = async (url: string): Promise<string> => {
  try {
    // Use proxy endpoint for R2 URLs to bypass CORS
    if (isR2Url(url)) {
      try {
        const proxyUrl = `${API_BASE_URL}/images/proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Proxy failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.base64) {
          throw new Error('Proxy returned empty base64 data');
        }

        return data.base64;
      } catch (error) {
        console.error('Error using proxy for R2 URL:', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to direct fetch attempt (might work in some cases)
        throw error;
      }
    }

    // Direct fetch for non-R2 URLs (they may have CORS configured)
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Check if response is actually an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`URL does not point to an image. Content-Type: ${contentType || 'unknown'}`);
    }

    const blob = await response.blob();

    // Validate blob is not empty
    if (blob.size === 0) {
      throw new Error('Image file is empty');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (!result) {
          reject(new Error('FileReader returned empty result'));
          return;
        }
        // Extract base64 part (remove data URL prefix)
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        if (!base64 || base64.length === 0) {
          reject(new Error('Base64 data is empty after extraction'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = (error) => {
        reject(new Error(`FileReader error: ${error}`));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URL to base64:', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Failed to fetch image from URL. This may be due to CORS restrictions or network issues. URL: ${url}`);
    }
    throw new Error(`Failed to convert image URL to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Normalize image input (URL or base64) to base64 string
 * @param image - Image URL or base64 string
 * @param base64Fallback - Optional base64 fallback to use if image is a URL (avoids fetch)
 */
export const normalizeImageToBase64 = async (image: string, base64Fallback?: string): Promise<string> => {
  if (!image || typeof image !== 'string') {
    throw new Error('Invalid image: must be a non-empty string');
  }

  // If it's already base64 (with or without data URL prefix), extract the base64 part
  if (image.startsWith('data:')) {
    const base64Part = image.split(',')[1];
    if (!base64Part) {
      throw new Error('Invalid base64 data URL format');
    }
    return base64Part;
  }

  // If base64 fallback is provided and image is a URL, use fallback instead of fetching
  if (base64Fallback && (image.startsWith('http://') || image.startsWith('https://'))) {
    // Validate fallback is base64
    if (base64Fallback.startsWith('data:')) {
      const base64Part = base64Fallback.split(',')[1];
      if (base64Part) {
        return base64Part;
      }
    } else if (base64Fallback.length > 0 && !base64Fallback.includes(' ')) {
      // Assume it's base64 without prefix
      return base64Fallback;
    }
    // If fallback is invalid, continue to fetch from URL
  }

  // If it's a URL, convert to base64
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return await urlToBase64(image);
  }

  // Assume it's already base64 without prefix
  if (image.length > 0 && !image.includes(' ')) {
    return image;
  }

  throw new Error('Invalid image format: must be base64 string or URL');
};

/**
 * Detect MIME type from base64 or URL
 */
export const detectMimeType = (image: string): string => {
  if (!image || typeof image !== 'string') {
    return 'image/png'; // Default fallback
  }

  // If it's a data URL, extract MIME type
  if (image.startsWith('data:')) {
    const mimeMatch = image.match(/data:([^;]+)/);
    if (mimeMatch && mimeMatch[1]) {
      return mimeMatch[1];
    }
  }

  // Default to PNG for base64, or try to detect from URL
  if (image.startsWith('http')) {
    const urlLower = image.toLowerCase();
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image/jpeg';
    if (urlLower.includes('.png')) return 'image/png';
    if (urlLower.includes('.webp')) return 'image/webp';
    if (urlLower.includes('.gif')) return 'image/gif';
  }

  // Default to PNG
  return 'image/png';
};

// Helper to check if running in local development
const isLocalDevelopment = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

/**
 * Combine multiple images into one using AI
 */
export const combineImages = async (
  images: string[], // Array of base64 image strings or URLs
  prompt: string,
  model: GeminiModel = 'gemini-2.5-flash-image',
  resolution?: Resolution
): Promise<string> => {
  if (images.length === 0) {
    throw new Error('At least one image is required');
  }

  // Normalize all images to base64 and detect mime types
  const normalizedImages: UploadedImage[] = await Promise.all(
    images.map(async (image) => {
      if (!image || image.trim() === '') {
        throw new Error('Invalid image: empty or null');
      }

      try {
        const base64 = await normalizeImageToBase64(image);
        const mimeType = detectMimeType(image);

        // Validate base64 is not empty
        if (!base64 || base64.trim() === '') {
          throw new Error('Invalid image: base64 conversion resulted in empty string');
        }

        return {
          base64,
          mimeType,
        };
      } catch (error) {
        console.error('Error normalizing image:', error);
        throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })
  );

  // Use the first image as base, rest as references
  const baseImage = normalizedImages[0];
  const additionalReferences = normalizedImages.slice(1);

  // Build prompt for combining
  const combinePrompt = prompt.trim()
    ? `${prompt} Combine and merge the provided images according to the description.`
    : 'Combine and merge the provided images into a cohesive composition.';

  try {
    // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
    // This prevents abuse and ensures credits are always deducted atomically
    // Usage records are created automatically by the backend
    const result = await mockupApi.generate({
      promptText: combinePrompt,
      baseImage: {
        base64: baseImage.base64,
        mimeType: baseImage.mimeType
      },
      model,
      resolution,
      referenceImages: additionalReferences.length > 0
        ? additionalReferences.map(img => ({
          base64: img.base64,
          mimeType: img.mimeType
        }))
        : undefined,
      imagesCount: 1,
      feature: 'canvas' // Combine operations are part of canvas workflow
    });

    return result.imageBase64 || result.imageUrl || '';
  } catch (error: any) {
    console.error('Error combining images:', error);
    throw new Error(error?.message || 'Failed to combine images');
  }
};

/**
 * Edit an image with custom configuration
 * CRITICAL: Uses mockupApi.generate which deducts credits atomically BEFORE generation
 * and creates usage records automatically. This prevents credit deduction inconsistencies.
 */
export const editImage = async (
  imageBase64: string, // Can be base64 or URL
  prompt: string,
  model: GeminiModel = 'gemini-2.5-flash-image',
  resolution?: Resolution
): Promise<string> => {
  if (!imageBase64 || imageBase64.trim() === '') {
    throw new Error('Invalid image: empty or null');
  }

  try {
    const base64 = await normalizeImageToBase64(imageBase64);
    const mimeType = detectMimeType(imageBase64);

    if (!base64 || base64.trim() === '') {
      throw new Error('Invalid image: base64 conversion resulted in empty string');
    }

    try {
      // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
      // This prevents abuse and ensures credits are always deducted atomically
      // Usage records are created automatically by the backend
      const result = await mockupApi.generate({
        promptText: prompt,
        baseImage: {
          base64,
          mimeType
        },
        model,
        resolution,
        imagesCount: 1,
        feature: 'canvas' // Edit operations are part of canvas workflow
      });

      return result.imageBase64 || result.imageUrl || '';
    } catch (error: any) {
      console.error('Error editing image:', error);
      throw new Error(error?.message || 'Failed to edit image');
    }
  } catch (error: any) {
    console.error('Error normalizing image for edit:', error);
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Upscale an image to higher resolution
 */
export const upscaleImage = async (
  imageBase64: string, // Can be base64 or URL
  targetResolution: Resolution,
  model: GeminiModel = 'gemini-3-pro-image-preview'
): Promise<string> => {
  if (!imageBase64 || imageBase64.trim() === '') {
    throw new Error('Invalid image: empty or null');
  }

  try {
    const base64 = await normalizeImageToBase64(imageBase64);
    const mimeType = detectMimeType(imageBase64);

    if (!base64 || base64.trim() === '') {
      throw new Error('Invalid image: base64 conversion resulted in empty string');
    }

    const baseImage: UploadedImage = {
      base64,
      mimeType,
    };

    const upscalePrompt = `Upscale this image to ${targetResolution} resolution while maintaining the highest quality and preserving all details. Use advanced upscaling techniques to enhance sharpness and clarity without introducing artifacts.`;

    try {
      // CRITICAL: Use backend endpoint which validates and deducts credits BEFORE generation
      // This prevents abuse and ensures credits are always deducted atomically
      // Usage records are created automatically by the backend
      const result = await mockupApi.generate({
        promptText: upscalePrompt,
        baseImage: {
          base64: baseImage.base64,
          mimeType: baseImage.mimeType
        },
        model,
        resolution: targetResolution,
        imagesCount: 1,
        feature: 'canvas' // Upscale operations are part of canvas workflow
      });

      return result.imageBase64 || result.imageUrl || '';
    } catch (error: any) {
      console.error('Error upscaling image:', error);
      throw new Error(error?.message || 'Failed to upscale image');
    }
  } catch (error: any) {
    console.error('Error normalizing image for upscale:', error);
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Validate if user has enough credits for operation
 */
export const validateCredits = async (
  model: GeminiModel,
  resolution?: Resolution
): Promise<boolean> => {
  if (isLocalDevelopment()) {
    return true;
  }

  try {
    const status = await subscriptionService.getSubscriptionStatus();
    if (!status) {
      toast.error('Unable to verify subscription status');
      return false;
    }

    const creditsNeeded = getCreditsRequired(model, resolution);
    const totalCredits = status.totalCredits || 0;

    if (totalCredits < creditsNeeded) {
      toast.error(
        `You need ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} but only have ${totalCredits} remaining.`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating credits:', error);
    toast.error('Unable to verify credits');
    return false;
  }
};

/**
 * Validate if user has enough credits for video generation
 */
export const validateVideoCredits = async (): Promise<boolean> => {
  if (isLocalDevelopment()) {
    return true;
  }

  try {
    const status = await subscriptionService.getSubscriptionStatus();
    if (!status) {
      toast.error('Unable to verify subscription status');
      return false;
    }

    const creditsNeeded = getVideoCreditsRequired();
    const totalCredits = status.totalCredits || 0;

    if (totalCredits < creditsNeeded) {
      toast.error(
        `You need ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''} but only have ${totalCredits} remaining.`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating video credits:', error);
    toast.error('Unable to verify credits');
    return false;
  }
};

