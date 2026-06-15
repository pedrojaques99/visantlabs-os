// @visant/print-fx — public surface.
// Isomorphic print-effects engine: CMYK halftone (SVG/raster), risograph
// emulation, and 14 GLSL post-fx shaders. Runs on a browser WebGL context or a
// headless-gl context on the server.

// ── Halftone (SVG/raster) ──
export { generateHalftoneSvg } from './halftone/svg.js';

// ── Riso ──
export { RISO_VERTEX_SHADER, RISO_FRAGMENT_SHADER } from './riso/shaders.js';
export { applyRisoUniforms, RISO_DITHER_MODE_MAP, RISO_SHAPE_MAP } from './riso/uniforms.js';

// ── Post-FX shaders ──
export {
  getHalftoneShaderSource,
  registerShader,
  getShaderDefinition,
  isShaderRegistered,
  shaderRegistry,
} from './shaders/index.js';

// ── Generic GL runner + program cache ──
export {
  compileShader,
  createProgram,
  setupFullscreenQuad,
  deleteRenderResources,
  uploadTexture,
  readPixels,
} from './gl/runner.js';
export { getOrCreateProgram } from './gl/programCache.js';

// ── Presets (single source of truth) ──
export {
  HALFTONE_PRESETS_DATA,
  RISO_FULL_PRESETS_DATA,
  TEXTURE_PRESETS_DATA,
  SHADER_TYPES,
} from './presets.js';

// ── Types ──
export { HALFTONE_DEFAULTS } from './types.js';
export type {
  HalftoneSettings,
  RisoSettings,
  InkLayer,
  RisoFullPreset,
  DitherMode,
  HalftoneShape,
  TextureBlendMode,
  ShaderType,
  CreateCanvas,
} from './types.js';

export type {
  HalftoneVariant,
  ShaderUniform,
  ShaderDefaults,
  ShaderDefinition,
  ShaderRegistry,
} from './shaders/shaderRegistry.js';
