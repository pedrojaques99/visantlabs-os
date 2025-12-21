import type { Mockup } from '../services/mockupApi';

/**
 * Get image URL from mockup, supporting both R2 URLs and Base64 fallback
 * @param mockup - Mockup object
 * @returns Image URL (either R2 URL or data URL with base64)
 */
export type SafeUrl = string;

/**
 * Validates if a URL is safe to use in an img tag src attribute.
 * Prevents XSS by blocking javascript: URIs and other non-standard protocols.
 * Allows: http:, https:, blob:, relative paths, and data:image/.
 * 
 * @param url - The URL to validate
 * @returns true if safe, false otherwise
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  const lowerUrl = url.toLowerCase().trim();

  // Block javascript: protocol immediately
  if (lowerUrl.replace(/\s+/g, '').startsWith('javascript:')) {
    return false;
  }

  // Allow absolute URLs with safe protocols
  if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
    // R2 public bucket URLs often start with pub-
    if (lowerUrl.includes('pub-')) {
      return true;
    }

    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      // Invalid URL syntax
      return false;
    }
  }

  // Allow blob URLs
  if (lowerUrl.startsWith('blob:')) {
    return true;
  }

  // Allow data: URI only if it's an image
  if (lowerUrl.startsWith('data:')) {
    return lowerUrl.startsWith('data:image/');
  }

  // Allow relative paths (root-relative or current-directory relative)
  if (lowerUrl.startsWith('/') || lowerUrl.startsWith('./') || lowerUrl.startsWith('../')) {
    return true;
  }

  return false;
}

/**
 * Get image URL from mockup, supporting both R2 URLs and Base64 fallback
 * @param mockup - Mockup object
 * @returns Image URL (either R2 URL or data URL with base64)
 */
export function getImageUrl(mockup: Mockup): string {
  // Prefer imageUrl (R2) if available
  if (mockup.imageUrl && typeof mockup.imageUrl === 'string' && mockup.imageUrl.length > 0) {
    const url = mockup.imageUrl.trim();

    // Check safety first
    if (isSafeUrl(url)) {
      return url;
    }

    // If it's a relative URL, try to construct absolute URL (only in browser)
    if (url.startsWith('/') && typeof window !== 'undefined') {
      // For relative URLs, use current origin
      return window.location.origin + url;
    }

    // If it doesn't start with http/https or /, assume it's a full URL that was stored incorrectly
    // Try to use it as-is (might be a valid URL without protocol)
    if (url.includes('.') && !url.startsWith('data:')) {
      // Try adding https:// if it looks like a domain
      const potentialUrl = url.startsWith('//') ? `https:${url}` : `https://${url}`;
      if (isSafeUrl(potentialUrl)) {
        return potentialUrl;
      }
    }

    // If it's a data URL, return as-is (validated by isSafeUrl in the first check if it was valid)
    // If we are here, it means isSafeUrl(url) failed. 
    // If it was a DATA URL that failed isSafeUrl, it might be non-image data, so we skip it.

    // If relative URL in server context, return as-is (will need to be handled by client)
    if (url.startsWith('/')) {
      return url;
    }
  }

  // Fallback to base64
  if (mockup.imageBase64 && typeof mockup.imageBase64 === 'string') {
    const base64 = mockup.imageBase64.trim();
    // Check if already has data URL prefix
    if (base64.startsWith('data:')) {
      return isSafeUrl(base64) ? base64 : '';
    }
    // Add data URL prefix if missing
    const constructedDataUrl = `data:image/png;base64,${base64}`;
    return isSafeUrl(constructedDataUrl) ? constructedDataUrl : '';
  }

  // Return empty string if no image data
  return '';
}

/**
 * Check if image is stored in R2 (URL-based) vs Base64
 * @param mockup - Mockup object
 * @returns true if image is from R2, false if Base64
 */
export function isImageFromR2(mockup: Mockup): boolean {
  return !!(mockup.imageUrl && typeof mockup.imageUrl === 'string' && mockup.imageUrl.length > 0 && isSafeUrl(mockup.imageUrl));
}

