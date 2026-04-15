// Get API base URL - defaults to localhost:3001 for development
export const API_BASE_URL =
  (typeof window !== 'undefined' && (window as any).__VISANT_API_URL__) ||
  'http://localhost:3001';

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
