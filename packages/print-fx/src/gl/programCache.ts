/**
 * Compiled-program cache — keyed per GL context (WeakMap), then per source key.
 *
 * A WebGLProgram is bound to the GL context it was linked against, so the cache
 * is keyed by context: entries stay valid for exactly the lifetime of their
 * context and are GC'd when the context is collected. On a long-lived shared
 * context this means compiled programs are reused across every render of the
 * same shader (the intended latency win). On a per-request context, each gets
 * its own cache slice, freed on destroy.
 */
import { createProgram } from './runner.js';

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
