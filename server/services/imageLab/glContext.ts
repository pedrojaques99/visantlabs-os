/**
 * Headless WebGL Context Factory
 *
 * Uses the `gl` (headless-gl) package to create WebGL contexts in Node.js.
 * Mesa software rendering — no GPU required.
 *
 * The low-level GL helpers (compile/link/quad/texture/readPixels + program
 * cache) live in @visant/print-fx and are re-exported below so existing
 * importers (risoRenderer, shaderRenderer) keep their import paths. This module
 * owns only the *server-specific* lifecycle: the long-lived singleton context +
 * serialized (mutex) access, which intentionally does NOT belong in the package.
 */

// Re-export the package GL runner + cache (single source of truth for the
// algorithm; the singleton/mutex below is the server's responsibility).
export {
  compileShader,
  createProgram,
  setupFullscreenQuad,
  deleteRenderResources,
  uploadTexture,
  readPixels,
  getOrCreateProgram,
} from '@visant/print-fx/gl';

let createGL: ((w: number, h: number, opts?: Record<string, any>) => WebGLRenderingContext) | null =
  null;
let glAvailable: boolean | null = null;

async function loadGL(): Promise<typeof createGL> {
  if (glAvailable === false) return null;
  if (createGL) return createGL;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import(/* webpackIgnore: true */ 'gl' as string);
    createGL = mod.default || mod;
    glAvailable = true;
    return createGL;
  } catch {
    glAvailable = false;
    console.warn(
      '[ImageLab] headless-gl not available — riso and shader effects disabled. Install with: npm install gl'
    );
    return null;
  }
}

export function isGLAvailable(): boolean {
  return glAvailable === true;
}

export async function createGLContext(
  width: number,
  height: number
): Promise<WebGLRenderingContext | null> {
  const factory = await loadGL();
  if (!factory) return null;
  const gl = factory(width, height, { preserveDrawingBuffer: true, antialias: false });
  return gl;
}

// ── Singleton context + serialized access ──────────────────────────────────
//
// Creating/destroying a headless-gl context per request is the dominant cost on
// the riso/shader paths and throws away the compiled-program cache (keyed per
// context, below) — so the cache only ever paid off within a single request.
//
// We instead keep ONE long-lived context and reuse it across requests, resizing
// its drawing buffer per render via the STACKGL_resize_drawingbuffer extension.
// WebGL state on a shared context cannot be touched concurrently, so every
// acquire() runs through a promise-chain mutex: renders serialize, never
// interleave. Compiled programs now survive across requests → real cache hits.
//
// Robustness: if resize is unsupported or a render reports context loss, we
// destroy and lazily rebuild the singleton on the next acquire — a failed
// render never wedges the process.

let _singleton: WebGLRenderingContext | null = null;
let _resizeExt: { resize: (w: number, h: number) => void } | null = null;
let _resizeUsable = false;
// Promise chain: each acquire waits on the previous release.
let _queueTail: Promise<void> = Promise.resolve();

function buildSingleton(factory: NonNullable<typeof createGL>, w: number, h: number): void {
  _singleton = factory(w, h, { preserveDrawingBuffer: true, antialias: false });
  const ext = _singleton.getExtension('STACKGL_resize_drawingbuffer') as {
    resize: (w: number, h: number) => void;
  } | null;
  _resizeExt = ext && typeof ext.resize === 'function' ? ext : null;
  _resizeUsable = _resizeExt !== null;
}

function disposeSingleton(): void {
  if (_singleton) {
    try {
      destroyContext(_singleton);
    } catch {
      /* best-effort */
    }
  }
  _singleton = null;
  _resizeExt = null;
  _resizeUsable = false;
}

/**
 * Force the singleton to be rebuilt on the next acquire. Call after a render
 * detects context loss / corruption.
 */
export function invalidateSharedContext(): void {
  disposeSingleton();
}

/**
 * Acquire exclusive, serialized access to the shared GL context, sized to
 * width×height. Returns null if headless-gl is unavailable. The returned
 * `release` MUST be called (use try/finally) to let the next render proceed.
 *
 * `markBroken()` signals that this render corrupted/lost the context so it is
 * torn down and rebuilt for the next caller instead of being reused.
 */
export async function acquireSharedContext(
  width: number,
  height: number
): Promise<{
  gl: WebGLRenderingContext;
  release: () => void;
  markBroken: () => void;
} | null> {
  const factory = await loadGL();
  if (!factory) return null;

  // Chain onto the queue: wait for the previous holder to release.
  let releaseGate!: () => void;
  const myGate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const prev = _queueTail;
  _queueTail = _queueTail.then(() => myGate);
  await prev;

  let broken = false;

  try {
    // (Re)build or resize the singleton under the lock.
    if (!_singleton) {
      buildSingleton(factory, width, height);
    } else if (_resizeUsable) {
      try {
        _resizeExt!.resize(width, height);
      } catch {
        // Resize failed at runtime — rebuild fresh at the requested size.
        disposeSingleton();
        buildSingleton(factory, width, height);
      }
    } else {
      // No reliable resize support: rebuild at the requested size. We still gain
      // serialized access; program cache resets with the context.
      disposeSingleton();
      buildSingleton(factory, width, height);
    }
  } catch (err) {
    // Construction itself failed — release the lock and surface null.
    disposeSingleton();
    releaseGate();
    throw err;
  }

  const gl = _singleton!;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    if (broken) disposeSingleton();
    releaseGate();
  };
  const markBroken = () => {
    broken = true;
  };

  return { gl, release, markBroken };
}

// ── Server-only GL lifecycle helper ──

export function destroyContext(gl: WebGLRenderingContext): void {
  const ext = gl.getExtension('STACKGL_destroy_context');
  if (ext) ext.destroy();
}
