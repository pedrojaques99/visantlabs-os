/**
 * Headless WebGL Context Factory
 *
 * Uses the `gl` (headless-gl) package to create WebGL contexts in Node.js.
 * Mesa software rendering — no GPU required.
 */

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
  const ext = _singleton.getExtension('STACKGL_resize_drawingbuffer') as
    | { resize: (w: number, h: number) => void }
    | null;
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

// ── Shared WebGL helpers ──

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${log}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexSrc: string,
  fragmentSrc: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

// ── Compiled-program cache ──
//
// WHY per-context (WeakMap), not a global source-keyed Map:
// A WebGLProgram is bound to the GL context it was linked against. Keying the
// cache by context keeps each program valid for exactly the lifetime of its
// context; entries are GC'd when the context is collected after destroy.
//
// With the shared singleton context (acquireSharedContext) this now pays off
// across requests: the context survives, so compiled programs are reused on
// every render of the same shader — the intended latency win. Access is
// serialized by the singleton mutex, so the cache is touched by one render at a
// time. (Still correct in the legacy per-request createGLContext path: those
// contexts get their own cache slice, GC'd on destroy.)
const programCache = new WeakMap<WebGLRenderingContext, Map<string, WebGLProgram>>();

export function getOrCreateProgram(
  gl: WebGLRenderingContext,
  cacheKey: string,
  vertexSrc: string,
  fragmentSrc: string
): WebGLProgram {
  let perContext = programCache.get(gl);
  if (!perContext) {
    perContext = new Map();
    programCache.set(gl, perContext);
  }
  const cached = perContext.get(cacheKey);
  if (cached) return cached;
  const program = createProgram(gl, vertexSrc, fragmentSrc);
  perContext.set(cacheKey, program);
  return program;
}

export function setupFullscreenQuad(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): WebGLBuffer[] {
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const texBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

  // Returned so the caller can delete them after the draw. On the long-lived
  // shared context, leaking one pair of buffers per render would grow GPU memory
  // unbounded; the legacy per-request context discards them on destroy anyway.
  return [posBuf, texBuf].filter(Boolean) as WebGLBuffer[];
}

/**
 * Delete per-render GL resources (textures, buffers) created for a single draw.
 * No-op safe: ignores nulls. Critical on the shared singleton context where the
 * context is NOT destroyed between renders.
 */
export function deleteRenderResources(
  gl: WebGLRenderingContext,
  resources: { textures?: (WebGLTexture | null)[]; buffers?: (WebGLBuffer | null)[] }
): void {
  for (const t of resources.textures || []) if (t) gl.deleteTexture(t);
  for (const b of resources.buffers || []) if (b) gl.deleteBuffer(b);
}

export function uploadTexture(
  gl: WebGLRenderingContext,
  pixels: Uint8Array,
  width: number,
  height: number
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return texture;
}

export function readPixels(gl: WebGLRenderingContext, width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  // WebGL reads bottom-up — flip vertically
  const rowSize = width * 4;
  const tmp = new Uint8Array(rowSize);
  for (let y = 0; y < height / 2; y++) {
    const topOffset = y * rowSize;
    const bottomOffset = (height - 1 - y) * rowSize;
    tmp.set(pixels.subarray(topOffset, topOffset + rowSize));
    pixels.set(pixels.subarray(bottomOffset, bottomOffset + rowSize), topOffset);
    pixels.set(tmp, bottomOffset);
  }
  return pixels;
}

export function destroyContext(gl: WebGLRenderingContext): void {
  const ext = gl.getExtension('STACKGL_destroy_context');
  if (ext) ext.destroy();
}
