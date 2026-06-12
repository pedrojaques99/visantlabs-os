/**
 * Server-side Riso Renderer
 *
 * Runs the riso GLSL fragment shader (from @visant/print-fx) on the shared
 * headless-gl context. Uniform binding is delegated to the package's
 * `applyRisoUniforms` so client and server set identical uniforms.
 */
import type { RisoSettings } from './types.js';
import {
  RISO_VERTEX_SHADER,
  RISO_FRAGMENT_SHADER,
  applyRisoUniforms,
} from '@visant/print-fx/riso';
import {
  acquireSharedContext,
  getOrCreateProgram,
  setupFullscreenQuad,
  uploadTexture,
  readPixels,
  deleteRenderResources,
} from './glContext.js';

export async function renderRiso(
  pixels: Uint8Array,
  width: number,
  height: number,
  settings: RisoSettings
): Promise<Uint8Array | null> {
  const ctx = await acquireSharedContext(width, height);
  if (!ctx) return null;
  const { gl, release, markBroken } = ctx;

  let texture: WebGLTexture | null = null;
  let buffers: WebGLBuffer[] = [];
  try {
    // Riso always uses the same shader pair → constant cache key.
    const program = getOrCreateProgram(gl, 'riso', RISO_VERTEX_SHADER, RISO_FRAGMENT_SHADER);
    gl.useProgram(program);
    buffers = setupFullscreenQuad(gl, program);

    texture = uploadTexture(gl, pixels, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    applyRisoUniforms(gl, program, settings, width, height);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const out = readPixels(gl, width, height);
    // Detect a lost/corrupted context so the singleton is rebuilt next time.
    if (gl.getError() === gl.CONTEXT_LOST_WEBGL) markBroken();
    return out;
  } catch (err) {
    markBroken();
    throw err;
  } finally {
    // Free per-render resources (texture + quad buffers). The cached program is
    // intentionally kept on the shared context. Skipped if the context is being
    // torn down anyway.
    deleteRenderResources(gl, { textures: [texture], buffers });
    release();
  }
}
