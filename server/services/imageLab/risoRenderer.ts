/**
 * Server-side Riso Renderer
 *
 * Uses headless-gl to run the GLSL shader from shared/riso/shaders.ts
 * — same source as the client-side RisoRenderer.
 */
import type { RisoSettings } from './types.js';
import { RISO_VERTEX_SHADER, RISO_FRAGMENT_SHADER } from '../../../shared/riso/shaders.js';
import {
  acquireSharedContext,
  getOrCreateProgram,
  setupFullscreenQuad,
  uploadTexture,
  readPixels,
  deleteRenderResources,
} from './glContext.js';

const DITHER_MODE_MAP: Record<string, number> = {
  stochastic: 0,
  atkinson: 1,
  floydsteinberg: 2,
  bayer: 3,
  halftone: 4,
};
const SHAPE_MAP: Record<string, number> = {
  circle: 0,
  line: 1,
  cross: 2,
  ellipse: 3,
};

function hexToGLColor(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

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
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform2f(u('u_resolution')!, width, height);
    gl.uniform1f(u('u_frequency')!, settings.frequency);
    gl.uniform1f(u('u_dotSize')!, settings.dotSize);
    gl.uniform1f(u('u_contrast')!, settings.contrast);
    gl.uniform1f(u('u_lightness')!, settings.lightness);
    gl.uniform1f(u('u_paperNoise')!, settings.paperNoise);
    gl.uniform1f(u('u_inkNoise')!, settings.inkNoise);
    gl.uniform1f(u('u_inkDropout')!, settings.inkDropout);
    gl.uniform1f(u('u_misregistration')!, settings.misregistration);
    gl.uniform1f(u('u_edgeBleed')!, settings.edgeBleed);
    gl.uniform1f(u('u_effectOpacity')!, settings.effectOpacity ?? 1.0);

    const paperRgb = hexToGLColor(settings.paperColor);
    gl.uniform4f(u('u_paperColor')!, paperRgb[0], paperRgb[1], paperRgb[2], 1.0);

    const layers = settings.layers.slice(0, 4);
    gl.uniform1i(u('u_layerCount')!, layers.length);
    gl.uniform1i(u('u_soloLayer')!, settings.soloLayer ?? -1);
    gl.uniform1i(u('u_ditherMode')!, DITHER_MODE_MAP[settings.ditherMode] ?? 0);
    gl.uniform1i(u('u_halftoneShape')!, SHAPE_MAP[settings.halftoneShape] ?? 0);

    for (let i = 0; i < 4; i++) {
      const layer = layers[i];
      const c = layer
        ? [layer.color[0] / 255, layer.color[1] / 255, layer.color[2] / 255]
        : [0, 0, 0];
      gl.uniform3f(u(`u_inkColor${i}`)!, c[0], c[1], c[2]);
      gl.uniform1f(u(`u_inkAlpha${i}`)!, layer?.alpha ?? 0);
      gl.uniform1f(u(`u_inkAngle${i}`)!, layer?.angle ?? 0);
      gl.uniform2f(u(`u_inkOffset${i}`)!, layer?.offsetX ?? 0, layer?.offsetY ?? 0);
      gl.uniform1i(u(`u_inkVisible${i}`)!, layer?.visible ? 1 : 0);
      gl.uniform1i(
        u(`u_layerDither${i}`)!,
        layer?.ditherMode ? DITHER_MODE_MAP[layer.ditherMode] ?? -1 : -1
      );
      gl.uniform1i(
        u(`u_layerHShape${i}`)!,
        layer?.halftoneShape ? SHAPE_MAP[layer.halftoneShape] ?? -1 : -1
      );
    }

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
