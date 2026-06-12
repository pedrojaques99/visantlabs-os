// Node adapter — backed by the `canvas` package (peer, optional, imported lazily).
// Keeps the engine core free of any hard Node dependency so the same package
// can be bundled for the browser without pulling node-canvas in.

import type { CreateCanvas } from '../types.js';

/** Structural stand-in for Node's Buffer / Uint8Array (avoids a @types/node dep). */
type BinaryLike = Uint8Array;

let _mod: any = null;

/** Lazily import node-canvas. Throws a clear error if the peer isn't installed. */
async function loadCanvasModule(): Promise<any> {
  if (_mod) return _mod;
  try {
    // Dynamic import so bundlers/browser builds don't try to resolve it.
    _mod = await import('canvas');
  } catch (err) {
    throw new Error(
      '@visant/psd-engine node adapter requires the optional peer dependency "canvas". ' +
        'Install it with `npm i canvas`.'
    );
  }
  return _mod;
}

/**
 * Returns a `CreateCanvas` factory plus node-canvas helpers (loadImage, toBuffer).
 * Caller must `await` this once and reuse the result.
 */
export async function createNodeAdapter(): Promise<{
  createCanvas: CreateCanvas;
  loadImage: (src: BinaryLike | string) => Promise<any>;
  toBuffer: (canvas: any, mime?: string, opts?: any) => any;
}> {
  const mod = await loadCanvasModule();
  const createCanvas: CreateCanvas = (w: number, h: number) => mod.createCanvas(w, h);
  return {
    createCanvas,
    loadImage: (src) => mod.loadImage(src as any),
    toBuffer: (canvas, mime = 'image/png', opts?) =>
      mime === 'image/png' ? canvas.toBuffer('image/png') : canvas.toBuffer(mime as any, opts),
  };
}

/**
 * Wire ag-psd's canvas backend to node-canvas. Call once before readPsd if the
 * caller wants ag-psd to read raster layers into node canvases.
 */
export async function initializeAgPsdCanvas(agPsd: { initializeCanvas: (cc: any) => void }): Promise<void> {
  const mod = await loadCanvasModule();
  agPsd.initializeCanvas(mod.createCanvas);
}
