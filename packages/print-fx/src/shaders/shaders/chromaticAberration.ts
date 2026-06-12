import { registerShader, type ShaderDefinition } from '../shaderRegistry.js';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_offset;
uniform float u_angle;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  uv.y = 1.0 - uv.y;
  float a = u_angle * 3.14159265 / 180.0;
  vec2 dir = vec2(cos(a), sin(a)) * u_offset;
  float r = texture2D(iChannel0, uv + dir).r;
  float g = texture2D(iChannel0, uv).g;
  float b = texture2D(iChannel0, uv - dir).b;
  gl_FragColor = vec4(r, g, b, texture2D(iChannel0, uv).a);
}
`;

const definition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_offset', type: 'float' },
    { name: 'u_angle', type: 'float' },
  ],
  defaults: { u_offset: 0.005, u_angle: 0.0 },
};

registerShader('chromaticAberration', definition);
export default definition;
