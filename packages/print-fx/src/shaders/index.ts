/**
 * Post-FX shader catalog — 14 GLSL fragment shaders.
 *
 * Importing this module self-registers every shader into the registry (each
 * shader file calls `registerShader` on import). After importing, use
 * `getShaderDefinition(type).fragmentShaderSource` to retrieve GLSL, and
 * `getHalftoneShaderSource(variant)` for the halftone variants.
 */

// Side-effect imports — each module registers itself into the registry.
import './shaders/vhs.js';
import './shaders/ascii.js';
import './shaders/matrixDither.js';
import './shaders/upscale.js';
import './shaders/dither.js';
import './shaders/duotone.js';
import './shaders/filmGrain.js';
import './shaders/pixelate.js';
import './shaders/posterize.js';
import './shaders/chromaticAberration.js';
import './shaders/crtScanlines.js';
import './shaders/edgeDetect.js';
import './shaders/glitch.js';
import './shaders/halftone.js';

export { getHalftoneShaderSource } from './shaders/halftone.js';

export {
  registerShader,
  getShaderDefinition,
  isShaderRegistered,
  shaderRegistry,
} from './shaderRegistry.js';

export type {
  ShaderType,
  HalftoneVariant,
  ShaderUniform,
  ShaderDefaults,
  ShaderDefinition,
  ShaderRegistry,
} from './shaderRegistry.js';
