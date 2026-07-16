import { usePluginStore } from './store';
import { DEFAULT_API_BASE_URL, joinApiUrl } from './apiBase';

/**
 * Current API base URL. The plugin store owns this value (persisted to
 * figma.clientStorage as `serverUrl`); the build-time default is only a
 * fallback for the first render, before the stored value is hydrated.
 *
 * Read through this function — never cache the result in a module-level
 * binding, or changing the server in Settings → Dev silently stops applying.
 */
export function getApiBaseUrl(): string {
  return usePluginStore.getState().serverUrl || DEFAULT_API_BASE_URL;
}

/** Build a full API URL from a route-relative path (e.g. `/sequencer`). */
export function apiUrl(path: string): string {
  return joinApiUrl(getApiBaseUrl(), path);
}
