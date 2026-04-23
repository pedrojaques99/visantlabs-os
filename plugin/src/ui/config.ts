// API base URL resolution order:
// 1. figma.clientStorage (user-configured, persists across sessions)
// 2. window.__VISANT_API_URL__ (injected at build time via env var)
// 3. fallback to localhost:3001
export let API_BASE_URL: string =
  (typeof window !== 'undefined' && (window as any).__VISANT_API_URL__) ||
  'http://localhost:3001';

// RPC call to load the stored server URL from figma.clientStorage
// Called once at startup; updates API_BASE_URL in-place
export async function initApiBaseUrl(
  rpc: (type: string, payload?: any) => Promise<any>
): Promise<string> {
  try {
    const { value } = await rpc('storage.get', { key: 'serverUrl' });
    if (value) API_BASE_URL = value;
  } catch {
    // silently fall back to build-time default
  }
  return API_BASE_URL;
}

// Persist a new server URL to figma.clientStorage and update in-memory value
export async function setApiBaseUrl(
  url: string,
  rpc: (type: string, payload?: any) => Promise<any>
): Promise<void> {
  const normalized = url.replace(/\/$/, '');
  await rpc('storage.set', { key: 'serverUrl', value: normalized });
  API_BASE_URL = normalized;
}

/**
 * Construct full API URL from relative path
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
