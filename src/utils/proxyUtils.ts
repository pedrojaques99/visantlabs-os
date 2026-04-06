/**
 * Utility to proxy image URLs through our backend to bypass CORS restrictions,
 * especially for Cloudflare R2 buckets that might not have correct CORS headers.
 */

// Use relative API base or environment variable
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

/**
 * Checks if a URL should be proxied (e.g. it's an external R2 bucket URL)
 * and returns the proxied version.
 */
export const getProxiedUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  
  // If it's already a base64 or relative URL, return as is
  if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('blob:')) {
    return url;
  }
  
  // Proxy R2 URLs and other problematic external domains
  const isR2 = url.includes('r2.dev') || url.includes('pub-');
  const isExternal = !url.includes(window.location.hostname);
  
  if (isR2 || isExternal) {
    // If it's already proxied, don't double proxy
    if (url.includes('/api/images/proxy')) return url;
    
    return `${API_BASE_URL}/images/stream?url=${encodeURIComponent(url)}`;
  }
  
  return url;
};
