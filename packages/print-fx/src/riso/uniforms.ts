/**
 * Riso uniform binding — sets every uniform the riso fragment shader expects
 * from a RisoSettings object. Framework-agnostic: works on any
 * WebGLRenderingContext (browser canvas or headless-gl). The caller is
 * responsible for having `useProgram`'d the riso program (and uploaded the
 * source texture to TEXTURE0) before calling this.
 */
import type { RisoSettings } from '../types.js';

export const RISO_DITHER_MODE_MAP: Record<string, number> = {
  stochastic: 0,
  atkinson: 1,
  floydsteinberg: 2,
  bayer: 3,
  halftone: 4,
};

export const RISO_SHAPE_MAP: Record<string, number> = {
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

/**
 * Bind all riso uniforms. Mirrors the server riso renderer's uniform block
 * exactly (the texture sampler `u_texture` is bound to unit 0).
 */
export function applyRisoUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  settings: RisoSettings,
  width: number,
  height: number
): void {
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
  gl.uniform1i(u('u_ditherMode')!, RISO_DITHER_MODE_MAP[settings.ditherMode] ?? 0);
  gl.uniform1i(u('u_halftoneShape')!, RISO_SHAPE_MAP[settings.halftoneShape] ?? 0);

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
      layer?.ditherMode ? (RISO_DITHER_MODE_MAP[layer.ditherMode] ?? -1) : -1
    );
    gl.uniform1i(
      u(`u_layerHShape${i}`)!,
      layer?.halftoneShape ? (RISO_SHAPE_MAP[layer.halftoneShape] ?? -1) : -1
    );
  }
}
