/**
 * Server-side Post-FX Shader Renderer
 *
 * Runs the 14 GLSL post-processing shaders via headless-gl.
 * Shader sources are loaded dynamically from the client-side shader registry
 * at first use — zero duplication of GLSL code.
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import {
  acquireSharedContext,
  getOrCreateProgram,
  setupFullscreenQuad,
  uploadTexture,
  readPixels,
  deleteRenderResources,
} from './glContext.js';
import type { ShaderType } from './types.js';

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;

const shaderSources = new Map<string, string>();
let initState: 'pending' | 'ok' | 'failed' = 'pending';

async function ensureInitialized(): Promise<void> {
  if (initState !== 'pending') return;
  try {
    const root = process.cwd();
    const shadersDir = resolve(root, 'src', 'utils', 'shaders');

    // Import the registry and all shader modules. They self-register fragment sources.
    const registryUrl = pathToFileURL(resolve(shadersDir, 'shaderRegistry.ts')).href;
    const registry = await import(registryUrl);

    const shaderNames = [
      'vhs',
      'ascii',
      'matrixDither',
      'upscale',
      'dither',
      'duotone',
      'filmGrain',
      'pixelate',
      'posterize',
      'chromaticAberration',
      'crtScanlines',
      'edgeDetect',
      'glitch',
    ];
    for (const name of shaderNames) {
      const url = pathToFileURL(resolve(shadersDir, 'shaders', `${name}.ts`)).href;
      await import(url);
    }
    const halftoneUrl = pathToFileURL(resolve(shadersDir, 'shaders', 'halftone.ts')).href;
    const halftoneModule = await import(halftoneUrl);

    const types: ShaderType[] = [
      'vhs',
      'ascii',
      'matrixDither',
      'upscale',
      'dither',
      'duotone',
      'filmGrain',
      'pixelate',
      'posterize',
      'chromaticAberration',
      'crtScanlines',
      'edgeDetect',
      'glitch',
    ];
    for (const t of types) {
      if (registry.isShaderRegistered(t)) {
        shaderSources.set(t, registry.getShaderDefinition(t).fragmentShaderSource);
      }
    }
    for (const variant of ['ellipse', 'square', 'lines'] as const) {
      shaderSources.set(`halftone:${variant}`, halftoneModule.getHalftoneShaderSource(variant));
    }

    initState = 'ok';
    console.log(`[ImageLab] Loaded ${shaderSources.size} shader sources from client modules.`);
  } catch (err) {
    initState = 'failed';
    console.warn(
      '[ImageLab] Shader sources unavailable — post-fx effects disabled.',
      (err as Error).message
    );
  }
}

function setUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  shaderType: ShaderType,
  settings: Record<string, any>,
  width: number,
  height: number
): void {
  const u = (name: string) => gl.getUniformLocation(program, name);

  const resLoc = u('iResolution');
  if (resLoc) gl.uniform2f(resLoc, width, height);

  const timeLoc = u('iTime') || u('u_time');
  if (timeLoc) gl.uniform1f(timeLoc, settings.time ?? Math.random() * 100);

  const uniformMap: Record<string, [string, number | number[]][]> = {
    halftone: [
      ['uDotSize', settings.dotSize ?? 5],
      ['uAngle', settings.angle ?? 0],
      ['uContrast', settings.contrast ?? 1],
      ['uSpacing', settings.spacing ?? 2],
      ['uThreshold', settings.halftoneThreshold ?? 1],
      ['uInvert', settings.halftoneInvert ?? 0],
    ],
    vhs: [
      ['uTapeWaveIntensity', settings.tapeWaveIntensity ?? 1],
      ['uTapeCreaseIntensity', settings.tapeCreaseIntensity ?? 1],
      ['uSwitchingNoiseIntensity', settings.switchingNoiseIntensity ?? 1],
      ['uBloomIntensity', settings.bloomIntensity ?? 1],
      ['uACBeatIntensity', settings.acBeatIntensity ?? 1],
    ],
    ascii: [
      ['u_char_size', settings.asciiCharSize ?? 8],
      ['u_contrast', settings.asciiContrast ?? 1],
      ['u_brightness', settings.asciiBrightness ?? 0],
      ['u_char_set', settings.asciiCharSet ?? 3],
      ['u_colored', settings.asciiColored ?? 0],
      ['u_invert', settings.asciiInvert ?? 0],
    ],
    matrixDither: [
      ['matrixSize', settings.matrixSize ?? 4],
      ['bias', settings.bias ?? 0],
    ],
    upscale: [
      ['uScaleFactor', settings.scaleFactor ?? 2],
      ['uSharpening', settings.upscaleSharpening ?? 0.3],
    ],
    dither: [
      ['u_dither_size', settings.ditherSize ?? 4],
      ['u_contrast', settings.ditherContrast ?? 1.5],
      ['u_offset', settings.ditherOffset ?? 0],
      ['u_bit_depth', settings.ditherBitDepth ?? 4],
      ['u_palette', settings.ditherPalette ?? 0],
    ],
    duotone: [
      ['u_intensity', settings.duotoneIntensity ?? 1],
      ['u_contrast', settings.duotoneContrast ?? 1],
      ['u_brightness', settings.duotoneBrightness ?? 0],
    ],
    filmGrain: [
      ['u_grain_strength', settings.filmGrainStrength ?? 16],
      ['u_grain_size', settings.filmGrainSize ?? 1],
      ['u_colored', settings.filmGrainColored ?? 0],
    ],
    pixelate: [['u_pixel_size', settings.pixelateSize ?? 8]],
    posterize: [['u_levels', settings.posterizeLevels ?? 4]],
    chromaticAberration: [
      ['u_offset', settings.chromaticOffset ?? 0.005],
      ['u_angle', settings.chromaticAngle ?? 0],
    ],
    crtScanlines: [
      ['u_line_width', settings.crtLineWidth ?? 2],
      ['u_intensity', settings.crtIntensity ?? 0.3],
      ['u_vignette', settings.crtVignette ?? 0.3],
      ['u_curvature', settings.crtCurvature ?? 0],
    ],
    edgeDetect: [
      ['u_threshold', settings.edgeThreshold ?? 0.1],
      ['u_strength', settings.edgeStrength ?? 2],
      ['u_overlay', settings.edgeOverlay ?? 0],
    ],
    glitch: [
      ['u_amount', settings.glitchAmount ?? 0.03],
      ['u_speed', settings.glitchSpeed ?? 3],
      ['u_block_size', settings.glitchBlockSize ?? 20],
    ],
  };

  const uniforms = uniformMap[shaderType] ?? [];
  for (const [name, value] of uniforms) {
    const loc = u(name);
    if (!loc) continue;
    if (Array.isArray(value)) {
      if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
      else if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
    } else {
      gl.uniform1f(loc, value);
    }
  }

  if (shaderType === 'duotone') {
    const shadow = settings.duotoneShadowColor ?? [0.1, 0.0, 0.2];
    const highlight = settings.duotoneHighlightColor ?? [0.3, 0.9, 0.9];
    const sLoc = u('u_shadow_color');
    if (sLoc) gl.uniform3f(sLoc, shadow[0], shadow[1], shadow[2]);
    const hLoc = u('u_highlight_color');
    if (hLoc) gl.uniform3f(hLoc, highlight[0], highlight[1], highlight[2]);
  }
  if (shaderType === 'dither') {
    const cc = settings.ditherCustomColor ?? [0, 0.8, 1];
    const ccLoc = u('u_custom_color');
    if (ccLoc) gl.uniform3f(ccLoc, cc[0], cc[1], cc[2]);
  }
}

export async function renderShader(
  pixels: Uint8Array,
  width: number,
  height: number,
  shaderType: ShaderType,
  settings: Record<string, any> = {}
): Promise<Uint8Array | null> {
  await ensureInitialized();

  if (initState === 'failed') return null;

  const variant = settings.halftoneVariant ?? 'ellipse';
  const key = shaderType === 'halftone' ? `halftone:${variant}` : shaderType;
  const fragmentSrc = shaderSources.get(key);
  if (!fragmentSrc) return null;

  const ctx = await acquireSharedContext(width, height);
  if (!ctx) return null;
  const { gl, release, markBroken } = ctx;

  let texture: WebGLTexture | null = null;
  let buffers: WebGLBuffer[] = [];
  try {
    // Cache key = the resolved shader source key (e.g. 'vhs', 'halftone:lines').
    const program = getOrCreateProgram(gl, key, VERTEX_SHADER, fragmentSrc);
    gl.useProgram(program);
    buffers = setupFullscreenQuad(gl, program);

    texture = uploadTexture(gl, pixels, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const texLoc = gl.getUniformLocation(program, 'iChannel0');
    if (texLoc) gl.uniform1i(texLoc, 0);

    setUniforms(gl, program, shaderType, settings, width, height);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const out = readPixels(gl, width, height);
    if (gl.getError() === gl.CONTEXT_LOST_WEBGL) markBroken();
    return out;
  } catch (err) {
    markBroken();
    throw err;
  } finally {
    deleteRenderResources(gl, { textures: [texture], buffers });
    release();
  }
}
