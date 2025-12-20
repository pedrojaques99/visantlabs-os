/**
 * Dither Shader
 * Applies ordered dithering with pixelation, luminosity adjustment, bit depth reduction,
 * and color palette support. Based on the Godot dither shader.
 */

import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_dither_size;
uniform float u_contrast;
uniform float u_offset;
uniform float u_bit_depth;
uniform float u_palette;

varying vec2 v_texCoord;

// 8x8 Bayer matrix lookup function (GLSL ES 1.00 compatible)
float getBayer8x8(float row, float col) {
  float r = mod(row, 8.0);
  float c = mod(col, 8.0);
  
  if (r < 0.5) {
    if (c < 0.5) return 0.0/64.0;
    else if (c < 1.5) return 48.0/64.0;
    else if (c < 2.5) return 12.0/64.0;
    else if (c < 3.5) return 60.0/64.0;
    else if (c < 4.5) return 3.0/64.0;
    else if (c < 5.5) return 51.0/64.0;
    else if (c < 6.5) return 15.0/64.0;
    else return 63.0/64.0;
  } else if (r < 1.5) {
    if (c < 0.5) return 32.0/64.0;
    else if (c < 1.5) return 16.0/64.0;
    else if (c < 2.5) return 44.0/64.0;
    else if (c < 3.5) return 28.0/64.0;
    else if (c < 4.5) return 35.0/64.0;
    else if (c < 5.5) return 19.0/64.0;
    else if (c < 6.5) return 47.0/64.0;
    else return 31.0/64.0;
  } else if (r < 2.5) {
    if (c < 0.5) return 8.0/64.0;
    else if (c < 1.5) return 56.0/64.0;
    else if (c < 2.5) return 4.0/64.0;
    else if (c < 3.5) return 52.0/64.0;
    else if (c < 4.5) return 11.0/64.0;
    else if (c < 5.5) return 59.0/64.0;
    else if (c < 6.5) return 7.0/64.0;
    else return 55.0/64.0;
  } else if (r < 3.5) {
    if (c < 0.5) return 40.0/64.0;
    else if (c < 1.5) return 24.0/64.0;
    else if (c < 2.5) return 36.0/64.0;
    else if (c < 3.5) return 20.0/64.0;
    else if (c < 4.5) return 43.0/64.0;
    else if (c < 5.5) return 27.0/64.0;
    else if (c < 6.5) return 39.0/64.0;
    else return 23.0/64.0;
  } else if (r < 4.5) {
    if (c < 0.5) return 2.0/64.0;
    else if (c < 1.5) return 50.0/64.0;
    else if (c < 2.5) return 14.0/64.0;
    else if (c < 3.5) return 62.0/64.0;
    else if (c < 4.5) return 1.0/64.0;
    else if (c < 5.5) return 49.0/64.0;
    else if (c < 6.5) return 13.0/64.0;
    else return 61.0/64.0;
  } else if (r < 5.5) {
    if (c < 0.5) return 34.0/64.0;
    else if (c < 1.5) return 18.0/64.0;
    else if (c < 2.5) return 46.0/64.0;
    else if (c < 3.5) return 30.0/64.0;
    else if (c < 4.5) return 33.0/64.0;
    else if (c < 5.5) return 17.0/64.0;
    else if (c < 6.5) return 45.0/64.0;
    else return 29.0/64.0;
  } else if (r < 6.5) {
    if (c < 0.5) return 10.0/64.0;
    else if (c < 1.5) return 58.0/64.0;
    else if (c < 2.5) return 6.0/64.0;
    else if (c < 3.5) return 54.0/64.0;
    else if (c < 4.5) return 9.0/64.0;
    else if (c < 5.5) return 57.0/64.0;
    else if (c < 6.5) return 5.0/64.0;
    else return 53.0/64.0;
  } else {
    if (c < 0.5) return 42.0/64.0;
    else if (c < 1.5) return 26.0/64.0;
    else if (c < 2.5) return 38.0/64.0;
    else if (c < 3.5) return 22.0/64.0;
    else if (c < 4.5) return 41.0/64.0;
    else if (c < 5.5) return 25.0/64.0;
    else if (c < 6.5) return 37.0/64.0;
    else return 21.0/64.0;
  }
}

// Get color from palette based on palette index and luminosity band
vec3 getPaletteColor(float paletteIdx, float lum) {
  // Clamp palette index to valid range
  float pal = floor(clamp(paletteIdx, 0.0, 4.0));
  
  // Quantize luminosity to palette steps (typically 2-4 colors per palette)
  float steps = 4.0;
  float band = floor(lum * steps) / steps;
  
  // Monochrome (0)
  if (pal < 0.5) {
    return vec3(band);
  }
  // Gameboy (1) - 4 green shades
  else if (pal < 1.5) {
    if (band < 0.25) return vec3(0.059, 0.157, 0.059);
    else if (band < 0.5) return vec3(0.137, 0.275, 0.137);
    else if (band < 0.75) return vec3(0.275, 0.451, 0.275);
    else return vec3(0.549, 0.667, 0.549);
  }
  // CRT Amber (2)
  else if (pal < 2.5) {
    if (band < 0.33) return vec3(0.2, 0.1, 0.0);
    else if (band < 0.66) return vec3(0.5, 0.3, 0.0);
    else return vec3(0.8, 0.6, 0.2);
  }
  // CRT Green (3)
  else if (pal < 3.5) {
    if (band < 0.33) return vec3(0.0, 0.15, 0.0);
    else if (band < 0.66) return vec3(0.1, 0.4, 0.1);
    else return vec3(0.2, 0.7, 0.2);
  }
  // Sepia (4)
  else {
    if (band < 0.33) return vec3(0.4, 0.3, 0.2);
    else if (band < 0.66) return vec3(0.6, 0.5, 0.35);
    else return vec3(0.8, 0.7, 0.55);
  }
}

void main() {
  vec2 fragCoord = v_texCoord * iResolution;
  vec2 uv = fragCoord / iResolution;
  uv.y = 1.0 - uv.y;
  
  // Pixelation effect - sample the screen texture at reduced resolution
  float ditherSize = max(1.0, u_dither_size);
  vec2 screen_size = iResolution / ditherSize;
  vec2 screen_sample_uv = floor(uv * screen_size) / screen_size;
  
  // Sample the source texture
  vec3 screen_col = texture2D(iChannel0, screen_sample_uv).rgb;
  
  // Calculate pixel luminosity using standard luminance weights
  float lum = (screen_col.r * 0.299) + (screen_col.g * 0.587) + (screen_col.b * 0.114);
  
  // Adjust with contrast and offset parameters
  float contrast = max(0.1, u_contrast);
  lum = (lum - 0.5 + u_offset) * contrast + 0.5;
  lum = clamp(lum, 0.0, 1.0);
  
  // Find which band the luminosity falls into (for palette lookup)
  float bits = max(1.0, floor(u_bit_depth));
  
  // Find which band the luminosity falls into (for palette lookup)
  // Calculate where lum lies between bands for dithering
  float col_steps = bits;
  float lum_clamped = max(lum - 0.00001, 0.0); // ensure floor calculation behaves when lum == 1.0
  float lum_lower = floor(lum_clamped * col_steps) / col_steps;
  float lum_upper = min(1.0, (floor(lum_clamped * col_steps) + 1.0) / col_steps);
  float lum_scaled = lum_clamped * col_steps - floor(lum_clamped * col_steps);
  
  // Get dither threshold from 8x8 Bayer matrix
  vec2 noise_uv = fragCoord / ditherSize;
  float threshold = getBayer8x8(noise_uv.y, noise_uv.x);
  
  // Adjust the dither slightly so min and max aren't quite at 0.0 and 1.0
  threshold = threshold * 0.99 + 0.005;
  
  // Apply dithering - if lum_scaled is below threshold, use lower band, else use upper band
  float ditheredLum = lum_scaled < threshold ? lum_lower : lum_upper;
  
  // Clamp to valid range
  ditheredLum = clamp(ditheredLum, 0.0, 1.0);
  
  // Get final color from palette
  vec3 final_col = getPaletteColor(u_palette, ditheredLum);
  
  gl_FragColor = vec4(final_col, 1.0);
}
`;

const ditherShaderDefinition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_dither_size', type: 'float' },
    { name: 'u_contrast', type: 'float' },
    { name: 'u_offset', type: 'float' },
    { name: 'u_bit_depth', type: 'float' },
    { name: 'u_palette', type: 'float' },
  ],
  defaults: {
    u_dither_size: 4.0,
    u_contrast: 1.5,
    u_offset: 0.0,
    u_bit_depth: 4.0,
    u_palette: 0.0,
  },
  requiresTexture: false,
};

// Register the shader
registerShader('dither', ditherShaderDefinition);

