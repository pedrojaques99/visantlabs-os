/**
 * Duotone Shader
 * Maps image luminosity to two colors (shadows and highlights)
 * Creates a stylized two-color effect popular in modern design and branding
 */

import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;

// Duotone colors (RGB, 0.0-1.0)
uniform vec3 u_shadow_color;    // Color for dark areas (shadows)
uniform vec3 u_highlight_color; // Color for bright areas (highlights)

// Effect parameters
uniform float u_intensity;      // Effect intensity (0.0 = original, 1.0 = full duotone)
uniform float u_contrast;       // Contrast adjustment for luminosity
uniform float u_brightness;     // Brightness offset

varying vec2 v_texCoord;

// Convert RGB to luminosity using perceptual weights
// These weights reflect human perception (green is perceived as brightest)
float getLuminosity(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 uv = v_texCoord;
  uv.y = 1.0 - uv.y; // Flip Y coordinate
  
  // Sample the source texture
  vec4 texColor = texture2D(iChannel0, uv);
  vec3 originalColor = texColor.rgb;
  
  // Calculate luminosity
  float lum = getLuminosity(originalColor);
  
  // Apply contrast and brightness adjustments
  // Contrast: expands/compresses the luminosity range around 0.5
  // Brightness: shifts the luminosity up or down
  lum = (lum - 0.5) * u_contrast + 0.5 + u_brightness;
  lum = clamp(lum, 0.0, 1.0);
  
  // Interpolate between shadow and highlight colors based on luminosity
  // lum = 0.0 -> shadow_color (dark areas)
  // lum = 1.0 -> highlight_color (bright areas)
  vec3 duotoneColor = mix(u_shadow_color, u_highlight_color, lum);
  
  // Mix original color with duotone based on intensity
  vec3 finalColor = mix(originalColor, duotoneColor, u_intensity);
  
  gl_FragColor = vec4(finalColor, texColor.a);
}
`;

const duotoneShaderDefinition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_shadow_color', type: 'vec3' },
    { name: 'u_highlight_color', type: 'vec3' },
    { name: 'u_intensity', type: 'float' },
    { name: 'u_contrast', type: 'float' },
    { name: 'u_brightness', type: 'float' },
  ],
  defaults: {
    // Default: Deep purple shadows, bright cyan highlights (modern tech aesthetic)
    u_shadow_color_r: 0.1,
    u_shadow_color_g: 0.0,
    u_shadow_color_b: 0.2,
    u_highlight_color_r: 0.3,
    u_highlight_color_g: 0.9,
    u_highlight_color_b: 0.9,
    u_intensity: 1.0,
    u_contrast: 1.0,
    u_brightness: 0.0,
  },
  requiresTexture: false,
};

// Register the shader
registerShader('duotone', duotoneShaderDefinition);



