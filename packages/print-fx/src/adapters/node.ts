// Node adapters — optional peers imported lazily so the package core stays free
// of any hard Node dependency and bundles cleanly for the browser.
//   • `canvas`  — rasterize the halftone SVG / produce PNG buffers.
//   • `gl`      — headless-gl WebGL context for riso + post-fx shaders.
// Neither is bundled into a browser build (dynamic import), and both are
// declared optional peer dependencies.

import type { CreateCanvas } from '../types.js';

type BinaryLike = Uint8Array;

let _canvasMod: any = null;

async function loadCanvasModule(): Promise<any> {
  if (_canvasMod) return _canvasMod;
  try {
    _canvasMod = await import('canvas');
  } catch {
    throw new Error(
      '@visant/print-fx node adapter requires the optional peer dependency "canvas". ' +
        'Install it with `npm i canvas`.'
    );
  }
  return _canvasMod;
}

/**
 * Returns a `CreateCanvas` factory plus node-canvas helpers (loadImage,
 * toBuffer). Await once and reuse the result.
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

let _glFactory:
  | ((w: number, h: number, opts?: Record<string, any>) => WebGLRenderingContext)
  | null = null;

/**
 * Lazily load headless-gl and create a WebGL context. Throws a clear error if
 * the optional `gl` peer is not installed. The host owns context lifecycle
 * (the Visant server keeps a singleton + mutex around this).
 */
export async function createHeadlessGLContext(
  width: number,
  height: number,
  opts: Record<string, any> = { preserveDrawingBuffer: true, antialias: false }
): Promise<WebGLRenderingContext> {
  if (!_glFactory) {
    try {
      const mod: any = await import('gl' as string);
      _glFactory = mod.default || mod;
    } catch {
      throw new Error(
        '@visant/print-fx node GL adapter requires the optional peer dependency "gl" (headless-gl). ' +
          'Install it with `npm i gl`.'
      );
    }
  }
  return _glFactory!(width, height, opts);
}

export function destroyHeadlessGLContext(gl: WebGLRenderingContext): void {
  const ext = gl.getExtension('STACKGL_destroy_context') as { destroy: () => void } | null;
  if (ext) ext.destroy();
}
