/**
 * Plugin configuration and constants
 * Update API_BASE_URL to match your server environment
 */

// Get API base URL from environment or use default
// For local development: http://localhost:3000
// For production: https://api.visant.com
export const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : (import.meta.env.VITE_API_URL || 'https://api.visant.com');

/**
 * Construct full API URL from relative path
 * @example
 * const url = apiUrl('/auth/login'); // http://localhost:3000/api/auth/login
 */
export function apiUrl(path: string): string {
  const basePath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}/api${basePath}`;
}

// Message types
export const MESSAGE_TYPES = {
  CONTEXT_UPDATED: 'CONTEXT_UPDATED',
  OPERATIONS_RESULT: 'OPERATIONS_RESULT',
  AUTH_UPDATED: 'AUTH_UPDATED',
  CREDITS_UPDATED: 'CREDITS_UPDATED',
  BRAND_GUIDELINES_LOADED: 'BRAND_GUIDELINES_LOADED',
  COMPONENTS_LOADED: 'COMPONENTS_LOADED',
  SESSION_RESTORED: 'SESSION_RESTORED',
  ERROR: 'ERROR',
} as const;

// Plugin settings
export const PLUGIN_CONFIG = {
  AUTO_DISMISS_TOAST_MS: 3000,
  MESSAGE_RETRY_COUNT: 3,
  MESSAGE_RETRY_DELAY_MS: 1000,
  WS_RECONNECT_ATTEMPTS: 5,
  WS_RECONNECT_DELAY_MS: 2000,
};
