/**
 * Single source of truth for the plugin's API base URL.
 *
 * Leaf module by design — it must stay import-free so that both the store
 * (which owns the runtime value) and config.ts (which builds URLs from it)
 * can depend on it without creating an import cycle.
 *
 * Runtime resolution order:
 *   1. `serverUrl` in the plugin store — persisted to figma.clientStorage,
 *      editable via Settings → Dev → Server Connection.
 *   2. `window.__VISANT_API_URL__` — injected by scripts/build.js only when
 *      VISANT_API_URL is set at build time (dev override).
 *   3. PRODUCTION_API_BASE_URL below.
 */

export const PRODUCTION_API_BASE_URL = 'https://api.visantlabs.com';

/**
 * The web app, for the few places the plugin must hand off to a browser (upgrade, account).
 * Kept in sync with `productionWebOrigins` in server/app.ts.
 */
export const PRODUCTION_WEB_BASE_URL = 'https://visantlabs.com';
export const PRICING_URL = `${PRODUCTION_WEB_BASE_URL}/pricing`;

/** Local backend: server/index.ts listens on PORT ?? 3001. */
export const LOCAL_API_BASE_URL = 'http://localhost:3001';

/** Strip trailing slashes so base + path never yields a double slash. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * The ONLY place the `/api` prefix is applied. Everything that talks to the
 * backend must route through here (directly, or via `apiUrl` in config.ts).
 */
export function joinApiUrl(baseUrl: string, path: string): string {
  const basePath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}/api${basePath}`;
}

/** Build-time default. Production unless a VISANT_API_URL override was baked in. */
export const DEFAULT_API_BASE_URL: string = normalizeBaseUrl(
  (typeof window !== 'undefined' && (window as any).__VISANT_API_URL__) || PRODUCTION_API_BASE_URL
);

export const API_PRESETS: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'Production', url: PRODUCTION_API_BASE_URL },
  { label: 'Local', url: LOCAL_API_BASE_URL },
];
