// Smart Filter — Displace pre-loader.
// Reads referenced displacement PSD files and attaches composited canvases to
// layer.placedLayer.__displacementCanvases so compose.ts can apply them during
// replaceLinkedSmartObjects → replaceOne.
//
// Filesystem access is injected via callbacks to keep this module isomorphic
// (same code runs in Node.js render-server and in unit tests with mock FS).

import { composePsd } from './compose.js';
import type { CreateCanvas } from './types.js';

export interface DisplacementCanvas {
  canvas: any;
  hScale: number;
  vScale: number;
  mapMode: 'stretch to fit' | 'tile';
  edgeMode: 'wrap around' | 'repeat edge pixels';
}

export interface FsCallbacks {
  /** Returns true if the path exists and is readable. */
  exists: (path: string) => boolean;
  /** Returns raw bytes for the path. May return a Promise for async environments (e.g. browser fetch). */
  read: (path: string) => Uint8Array | ArrayBufferLike | Promise<Uint8Array | ArrayBufferLike>;
  /** Resolve path segments (like Node path.resolve). */
  resolve: (...parts: string[]) => string;
  /** Return the directory of a path (like Node path.dirname). */
  dirname: (p: string) => string;
  /** Return the basename of a path (like Node path.basename). */
  basename: (p: string) => string;
}

/**
 * Creates FsCallbacks suitable for browser / Web Worker environments.
 * Uses a user-supplied async fetcher instead of fs.readFileSync.
 *
 * Handles both Unix ("/") and Windows ("\\") path separators — normalises
 * to forward slashes internally so the API endpoint receives consistent paths.
 *
 * @param fetcher  Async function that fetches a file by path and returns an ArrayBuffer.
 *                 404s / errors should throw — preloadDisplacementMaps will warn and skip.
 */
export function createBrowserFsCallbacks(
  fetcher: (path: string) => Promise<ArrayBuffer>
): FsCallbacks {
  // Normalise all separators to "/" for cross-platform consistency.
  const norm = (p: string) => p.replace(/\\/g, '/');

  return {
    exists: () => true, // always attempt; let read() throw on missing files
    read: (p) => fetcher(norm(p)),
    resolve: (...parts: string[]) => {
      // Join parts, normalise separators, collapse runs of "//"
      return norm(parts.join('/')).replace(/\/{2,}/g, '/');
    },
    dirname: (p: string) => {
      const n = norm(p);
      // "Z:/foo/bar.psd" → "Z:/foo"  |  "bar.psd" → "."
      const idx = n.lastIndexOf('/');
      return idx > 0 ? n.slice(0, idx) : '.';
    },
    basename: (p: string, ext?: string) => {
      const name = norm(p).replace(/.*\//, '');
      return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
    },
  };
}

/**
 * Scans all layers for Smart Filter Displace entries, loads the referenced
 * displacement PSD files via `fs` callbacks, composites each into a canvas,
 * and attaches the results to `layer.placedLayer.__displacementCanvases`.
 *
 * Must be called BEFORE replaceLinkedSmartObjects / composePsd.
 *
 * @param readPsd  ag-psd readPsd function (injected to avoid a hard dependency)
 * @param onWarn   Optional warning callback (defaults to console.warn)
 */
export async function preloadDisplacementMaps(
  allLayers: any[],
  psdPath: string,
  createCanvas: CreateCanvas,
  fs: FsCallbacks,
  readPsd: (buffer: ArrayBufferLike, opts?: any) => any,
  onWarn: (msg: string) => void = (m) => console.warn('[displacement]', m)
): Promise<void> {
  const psdDir = fs.dirname(fs.resolve(psdPath));

  for (const layer of allLayers) {
    const filters: any[] | undefined = layer.placedLayer?.filter?.list;
    if (!filters?.length) continue;

    const displaceEntries = filters.filter((f: any) => f.type === 'displace');
    if (!displaceEntries.length) continue;

    const canvases: DisplacementCanvas[] = [];

    for (const entry of displaceEntries) {
      const f = entry.filter ?? {};
      const filePath: string | undefined = f.displacementFile?.path;
      if (!filePath) continue;

      // Resolution order: absolute path → relative to PSD dir → basename in PSD dir
      const candidates = [
        filePath,
        fs.resolve(psdDir, filePath),
        fs.resolve(psdDir, fs.basename(filePath)),
      ];

      let rawBuffer: Uint8Array | ArrayBufferLike | null = null;
      for (const p of candidates) {
        if (!fs.exists(p)) continue;
        try {
          rawBuffer = await fs.read(p);
          break;
        } catch {
          // path not readable, try next candidate
        }
      }

      if (!rawBuffer) {
        onWarn(`Displacement map file not found: ${filePath}`);
        continue;
      }

      try {
        const buf = rawBuffer instanceof Uint8Array ? rawBuffer.buffer : rawBuffer;
        const dispPsd = readPsd(buf, { skipThumbnail: true });
        const dispCanvas = composePsd(dispPsd, createCanvas);
        canvases.push({
          canvas: dispCanvas,
          hScale: f.horizontalScale ?? 10,
          vScale: f.verticalScale ?? 10,
          mapMode: f.displacementMap ?? 'stretch to fit',
          edgeMode: f.undefinedAreas ?? 'repeat edge pixels',
        });
      } catch (err: any) {
        onWarn(`Failed to load displacement map ${filePath}: ${err?.message ?? err}`);
      }
    }

    if (canvases.length > 0) {
      layer.placedLayer.__displacementCanvases = canvases;
    }
  }
}
