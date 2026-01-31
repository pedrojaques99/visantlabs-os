/**
 * Matrix Dither Shader
 * Applies ordered dithering (Bayer matrix dithering) effect
 * Converts images to black and white using Bayer matrices (2x2, 4x4, or 8x8)
 */

import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float matrixSize;
uniform float bias;

varying vec2 v_texCoord;

const mat2 bayerMatrix2x2 = mat2(
    0.0, 2.0,
    3.0, 1.0
) / 4.0;

const mat4 bayerMatrix4x4 = mat4(
    0.0,  8.0,  2.0, 10.0,
    12.0, 4.0,  14.0, 6.0,
    3.0,  11.0, 1.0, 9.0,
    15.0, 7.0,  13.0, 5.0
) / 16.0;

// 8x8 Bayer matrix lookup function (GLSL ES 1.00 compatible)
float getBayer8x8(float row, float col) {
  float r = mod(row, 8.0);
  float c = mod(col, 8.0);
  
  // Convert to integer-like indices for lookup
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

vec3 orderedDither(vec2 fragCoord, float lum) {
  vec3 color = vec3(0.0);
  float threshold = 0.0;

  if (matrixSize == 2.0) {
    float x = mod(fragCoord.x, 2.0);
    float y = mod(fragCoord.y, 2.0);
    if (y < 0.5) {
      if (x < 0.5) threshold = bayerMatrix2x2[0][0];
      else threshold = bayerMatrix2x2[0][1];
    } else {
      if (x < 0.5) threshold = bayerMatrix2x2[1][0];
      else threshold = bayerMatrix2x2[1][1];
    }
  } else if (matrixSize == 4.0) {
    float x = mod(fragCoord.x, 4.0);
    float y = mod(fragCoord.y, 4.0);
    if (y < 0.5) {
      if (x < 0.5) threshold = bayerMatrix4x4[0][0];
      else if (x < 1.5) threshold = bayerMatrix4x4[0][1];
      else if (x < 2.5) threshold = bayerMatrix4x4[0][2];
      else threshold = bayerMatrix4x4[0][3];
    } else if (y < 1.5) {
      if (x < 0.5) threshold = bayerMatrix4x4[1][0];
      else if (x < 1.5) threshold = bayerMatrix4x4[1][1];
      else if (x < 2.5) threshold = bayerMatrix4x4[1][2];
      else threshold = bayerMatrix4x4[1][3];
    } else if (y < 2.5) {
      if (x < 0.5) threshold = bayerMatrix4x4[2][0];
      else if (x < 1.5) threshold = bayerMatrix4x4[2][1];
      else if (x < 2.5) threshold = bayerMatrix4x4[2][2];
      else threshold = bayerMatrix4x4[2][3];
    } else {
      if (x < 0.5) threshold = bayerMatrix4x4[3][0];
      else if (x < 1.5) threshold = bayerMatrix4x4[3][1];
      else if (x < 2.5) threshold = bayerMatrix4x4[3][2];
      else threshold = bayerMatrix4x4[3][3];
    }
  } else if (matrixSize == 8.0) {
    float x = mod(fragCoord.x, 8.0);
    float y = mod(fragCoord.y, 8.0);
    threshold = getBayer8x8(y, x);
  }

  if (lum < threshold + bias) {
    color = vec3(0.0);
  } else {
    color = vec3(1.0);
  }

  return color;
}

void main() {
  vec2 fragCoord = v_texCoord * iResolution;
  vec2 uv = fragCoord / iResolution;
  uv.y = 1.0 - uv.y;
  
  vec4 color = texture2D(iChannel0, uv);
  float lum = dot(vec3(0.2126, 0.7152, 0.0722), color.rgb);
  
  vec3 ditheredColor = orderedDither(fragCoord, lum);
  
  gl_FragColor = vec4(ditheredColor, 1.0);
}
`;

const matrixDitherShaderDefinition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'matrixSize', type: 'float' },
    { name: 'bias', type: 'float' },
  ],
  defaults: {
    matrixSize: 4.0,
    bias: 0.0,
  },
  requiresTexture: false,
};

// Register the shader
registerShader('matrixDither', matrixDitherShaderDefinition);

