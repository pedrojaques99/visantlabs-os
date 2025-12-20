/**
 * Shader Registry
 * Central registry for all shader types and their configurations
 */

export type ShaderType = 'halftone' | 'vhs' | 'ascii' | 'matrixDither' | 'upscale' | 'dither' | 'duotone';
export type HalftoneVariant = 'ellipse' | 'square' | 'lines';

export interface ShaderUniform {
  name: string;
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'sampler2D' | 'int';
}

export interface ShaderDefaults {
  [key: string]: number;
}

export interface ShaderDefinition {
  fragmentShaderSource: string;
  uniforms: ShaderUniform[];
  defaults: ShaderDefaults;
  requiresTexture?: boolean; // Whether shader needs additional texture
}

export type ShaderRegistry = Record<ShaderType, ShaderDefinition>;

// Registry will be populated by importing shader modules
export const shaderRegistry: ShaderRegistry = {} as ShaderRegistry;

/**
 * Register a shader definition
 */
export function registerShader(type: ShaderType, definition: ShaderDefinition): void {
  shaderRegistry[type] = definition;
}

/**
 * Get shader definition by type
 */
export function getShaderDefinition(type: ShaderType): ShaderDefinition {
  const definition = shaderRegistry[type];
  if (!definition) {
    throw new Error(`Shader type "${type}" not found in registry`);
  }
  return definition;
}

/**
 * Check if shader type is registered
 */
export function isShaderRegistered(type: ShaderType): boolean {
  return type in shaderRegistry;
}

