import type { Mockup } from '../services/mockupApi';
import { downloadBlob } from './clipboard';

/**
 * Get image URL from mockup, supporting both R2 URLs and Base64 fallback
 * @param mockup - Mockup object
 * @returns Image URL (either R2 URL or data URL with base64)
 */
export type SafeUrl = string;

/**
 * List of dangerous protocols that should never be allowed
 * These can execute code or access sensitive resources
 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:text/', 'data:application/'];

/**
 * List of safe protocols for image URLs
 */
const SAFE_PROTOCOLS = ['http:', 'https:', 'blob:'];

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

  // Normalize: trim whitespace and remove invisible characters
  // eslint-disable-next-line no-control-regex
  const trimmedUrl = url.trim().replace(/[\x00-\x1f\x7f]/g, '');
  if (trimmedUrl.length === 0) return false;

  // Normalize for comparison (lowercase, no leading/trailing whitespace)
  const lowerUrl = trimmedUrl.toLowerCase();

  // Block dangerous protocols - check BEFORE protocol parsing
  // This handles obfuscation attempts like "javascript\t:" or "java\nscript:"
  const normalizedForProtocolCheck = lowerUrl.replace(/[\s\t\n\r\f]/g, '');
  for (const dangerous of DANGEROUS_PROTOCOLS) {
    if (normalizedForProtocolCheck.startsWith(dangerous)) {
      return false;
    }
  }

  // Handle data: URIs - only allow images
  if (normalizedForProtocolCheck.startsWith('data:')) {
    // Strict check: must be data:image/ with valid MIME type
    const dataMatch = normalizedForProtocolCheck.match(
      /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|bmp|ico)/
    );
    return dataMatch !== null;
  }

  // Handle blob: URLs
  if (lowerUrl.startsWith('blob:')) {
    return true;
  }

  // Allow relative paths (root-relative or current-directory relative)
  // These are safe as they resolve to the same origin
  if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) {
    return true;
  }
  if (trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
    return true;
  }

  // For absolute URLs, parse and validate protocol
  try {
    const parsed = new URL(trimmedUrl);

    // Only allow safe protocols
    if (!SAFE_PROTOCOLS.includes(parsed.protocol)) {
      return false;
    }

    return true;
  } catch {
    // Invalid URL syntax - reject
    return false;
  }
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
  return !!(
    mockup.imageUrl &&
    typeof mockup.imageUrl === 'string' &&
    mockup.imageUrl.length > 0 &&
    isSafeUrl(mockup.imageUrl)
  );
}

/**
 * Downloads an image from a URL by creating a temporary link element.
 * Handles both blob downloads (via fetch) and direct link fallbacks.
 *
 * @param imageUrl - The URL of the image to download
 * @param filenamePrefix - The prefix for the downloaded filename
 */
export async function downloadImage(
  imageUrl: string,
  filenamePrefix: string = 'image'
): Promise<void> {
  if (!imageUrl) return;

  const getExtension = (mimeOrUrl: string): string => {
    const map: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/png': '.png',
    };
    for (const [mime, ext] of Object.entries(map)) {
      if (mimeOrUrl.includes(mime)) return ext;
    }
    const urlExt = mimeOrUrl.split('.').pop()?.split('?')[0]?.toLowerCase();
    if (urlExt && ['mp4', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'webm'].includes(urlExt)) {
      return `.${urlExt}`;
    }
    return '.png';
  };

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || '';
    const extension = getExtension(contentType || imageUrl);
    downloadBlob(blob, `${filenamePrefix}-${Date.now()}${extension}`);
  } catch (error) {
    console.error('Fetch download failed, falling back to direct link:', error);
    const mimeSource = imageUrl.startsWith('data:')
      ? imageUrl.split(';')[0].split(':')[1] || ''
      : imageUrl;
    const extension = getExtension(mimeSource);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${filenamePrefix}-${Date.now()}${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function loadImage(
  src: string,
  crossOrigin: string | null = 'anonymous'
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
