import { registerShader, type ShaderDefinition } from '../shaderRegistry.js';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_levels;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  uv.y = 1.0 - uv.y;
  vec4 c = texture2D(iChannel0, uv);
  c.rgb = floor(c.rgb * u_levels + 0.5) / u_levels;
  gl_FragColor = c;
}
`;

const definition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_levels', type: 'float' },
  ],
  defaults: { u_levels: 4.0 },
};

registerShader('posterize', definition);
export default definition;
