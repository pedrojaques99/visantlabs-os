// Scene Package browser client — the SSoT browser pipeline for client-side PSD
// mockup rendering. Fetches a SceneDoc + signed asset URLs from the Visant API
// (GET /api/psd-render/scenes/:psdFileName), loads each layer image, then
// composes the final mockup in the user's browser via the isomorphic engine.
//
// IMPORTANT (bundle): only `@visant/psd-engine/scene` + `/adapters/browser`
// are imported here. ag-psd is NEVER pulled in — the raw PSD stays on the server;
// the browser only ever touches pre-extracted flatten images + JSON geometry.
//
// The same module is consumed by boxy-app (via the npm/file package), so this is
// the single client implementation shared by Visant web and Boxy. Zero dup.

import { renderScene } from '@visant/psd-engine/scene';
import type { SceneDoc } from '@visant/psd-engine/scene';
import { createCanvas, loadImage, toBlob } from '@visant/psd-engine/adapters/browser';
import { API_BASE } from '@/config/api';
import { authService } from '@/services/authService';

export interface SceneCatalogEntry {
  psdFileName: string;
  faces: Array<{ key: string; name: string; innerW: number; innerH: number }>;
  width: number;
  height: number;
  warnings: string[];
  updatedAt: string;
}

export interface LoadedScene {
  /** The scene geometry. */
  doc: SceneDoc;
  /** ref → loaded HTMLImageElement (base/over layer images + masks). */
  images: Map<string, HTMLImageElement>;
  /** Seconds the signed asset URLs remain valid (re-load after expiry). */
  expiresInSeconds: number;
}

function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getJson(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return body;
}

/** List the scenes available to the current user (catalog). */
export async function listScenes(): Promise<SceneCatalogEntry[]> {
  const body = await getJson('/psd-render/scenes');
  return Array.isArray(body?.scenes) ? body.scenes : [];
}

/**
 * Load a Scene Package for `psdFileName`: fetch the SceneDoc + signed URLs, then
 * load every referenced image as a CORS-enabled HTMLImageElement so the canvas
 * stays untainted (toBlob/toDataURL keep working for the download).
 */
export async function loadScene(psdFileName: string): Promise<LoadedScene> {
  const body = await getJson(`/psd-render/scenes/${encodeURIComponent(psdFileName)}`);
  const doc = body?.doc as SceneDoc | undefined;
  const assets = (body?.assets ?? {}) as Record<string, string>;
  if (!doc) {
    throw new Error('Scene response missing doc');
  }

  const refs = Object.keys(assets);
  const loaded = await Promise.all(
    refs.map(async (ref) => [ref, await loadImage(assets[ref])] as const)
  );

  return {
    doc,
    images: new Map(loaded),
    expiresInSeconds: typeof body?.expiresInSeconds === 'number' ? body.expiresInSeconds : 600,
  };
}

export interface RenderToCanvasOptions {
  /** Art applied to faces that have no explicit entry in `arts`. */
  defaultArt?: HTMLImageElement | HTMLCanvasElement;
}

/**
 * Compose the final mockup into a fresh HTMLCanvasElement using the browser
 * adapter. `arts` maps a face key → the art image/canvas; if a single art should
 * cover every face, pass it via `opts.defaultArt` (or set `arts['*']` to nothing
 * and rely on defaultArt).
 */
export function renderSceneToCanvas(
  doc: SceneDoc,
  images: Map<string, HTMLImageElement>,
  arts: Record<string, HTMLImageElement | HTMLCanvasElement>,
  opts: RenderToCanvasOptions = {}
): HTMLCanvasElement {
  // The engine expects a plain `{ [ref]: image }` asset map.
  const assets: Record<string, HTMLImageElement> = {};
  for (const [ref, img] of images) assets[ref] = img;

  return renderScene(doc, assets, arts, createCanvas, {
    defaultArt: opts.defaultArt,
  }) as HTMLCanvasElement;
}

/** Re-export the browser canvas→Blob helper so callers don't import the pkg twice. */
export { toBlob };

/** Load a File/Blob (the user's uploaded art) into an HTMLImageElement. */
export function loadArt(file: File | Blob): Promise<HTMLImageElement> {
  return loadImage(file);
}
