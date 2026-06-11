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
// A WebGLProgram is bound to the GL context it was linked against. The ImageLab
// renderers create a fresh headless-gl context per request and destroy it in a
// `finally` (see riso/shaderRenderer). A global `Map<shaderSource, program>`
// would therefore hand out programs whose context has already been destroyed —
// undefined behaviour / crash. Keying the cache by context (WeakMap) keeps each
// program valid for exactly the lifetime of its context and is concurrency-safe
// (each in-flight request owns its own context + cache slice). Entries are GC'd
// automatically when the context is collected after destroyContext().
//
// In today's one-render-per-context flow this dedupes repeated programs only if
// a single context renders more than once (e.g. a future multi-effect pass on a
// shared context). The larger latency win — reusing one resized context across
// requests so compiled programs survive — is intentionally left as a follow-up:
// it needs request serialization + resize handling and carries concurrency risk
// beyond this change.
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

export function setupFullscreenQuad(gl: WebGLRenderingContext, program: WebGLProgram): void {
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
