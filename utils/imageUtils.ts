import type { Mockup } from '../services/mockupApi';

/**
 * Get image URL from mockup, supporting both R2 URLs and Base64 fallback
 * @param mockup - Mockup object
 * @returns Image URL (either R2 URL or data URL with base64)
 */
export function getImageUrl(mockup: Mockup): string {
  // Prefer imageUrl (R2) if available
  if (mockup.imageUrl && typeof mockup.imageUrl === 'string' && mockup.imageUrl.length > 0) {
    const url = mockup.imageUrl.trim();
    // Validate URL format - must be http/https or data URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
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
      return url.startsWith('//') ? `https:${url}` : `https://${url}`;
    }
    // If it's a data URL, return as-is
    if (url.startsWith('data:')) {
      return url;
    }
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
      return base64;
    }
    // Add data URL prefix if missing
    return `data:image/png;base64,${base64}`;
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
  return !!(mockup.imageUrl && typeof mockup.imageUrl === 'string' && mockup.imageUrl.length > 0);
}

