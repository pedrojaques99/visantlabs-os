/**
 * Film Grain Shader
 * Adds cinematic film grain noise over the image.
 * Based on Shadertoy "Film Grain" by Pat
 */

import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_grain_strength;
uniform float u_grain_size;
uniform float u_time;
uniform float u_colored;

varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  vec4 color = texture2D(iChannel0, uv);

  vec2 grainUv = uv * (iResolution.xy / u_grain_size);
  float t = u_time * 10.0;
  float x = (grainUv.x + 4.0) * (grainUv.y + 4.0) * t;
  float grain = mod((mod(x, 13.0) + 1.0) * (mod(x, 123.0) + 1.0), 0.01) - 0.005;

  vec3 grainVec;
  if (u_colored > 0.5) {
    float x2 = (grainUv.x + 7.0) * (grainUv.y + 11.0) * t;
    float x3 = (grainUv.x + 13.0) * (grainUv.y + 5.0) * t;
    float g2 = mod((mod(x2, 13.0) + 1.0) * (mod(x2, 123.0) + 1.0), 0.01) - 0.005;
    float g3 = mod((mod(x3, 13.0) + 1.0) * (mod(x3, 123.0) + 1.0), 0.01) - 0.005;
    grainVec = vec3(grain, g2, g3) * u_grain_strength;
  } else {
    grainVec = vec3(grain * u_grain_strength);
  }

  gl_FragColor = vec4(color.rgb + grainVec, color.a);
}
`;

const definition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_grain_strength', type: 'float' },
    { name: 'u_grain_size', type: 'float' },
    { name: 'u_time', type: 'float' },
    { name: 'u_colored', type: 'float' },
  ],
  defaults: {
    u_grain_strength: 16.0,
    u_grain_size: 1.0,
    u_time: 1.0,
    u_colored: 0.0,
  },
};

registerShader('filmGrain' as any, definition);

export default definition;
