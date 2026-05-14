import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_pixel_size;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  vec2 d = u_pixel_size / iResolution;
  uv = d * floor(uv / d) + d * 0.5;
  gl_FragColor = texture2D(iChannel0, uv);
}
`;

const definition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_pixel_size', type: 'float' },
  ],
  defaults: { u_pixel_size: 8.0 },
};

registerShader('pixelate', definition);
export default definition;
