import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_amount;
uniform float u_speed;
uniform float u_block_size;
uniform float u_time;
varying vec2 v_texCoord;

float rand(float s) {
  return fract(sin(s * 12.9898) * 43758.5453);
}

void main() {
  vec2 uv = v_texCoord;
  uv.y = 1.0 - uv.y;
  float t = floor(u_time * u_speed);
  float block = floor(uv.y * u_block_size + t);
  float noise = rand(block);
  float shift = (noise - 0.5) * u_amount * step(0.75, rand(block + 7.0));

  float r = texture2D(iChannel0, vec2(uv.x + shift, uv.y)).r;
  float g = texture2D(iChannel0, uv).g;
  float b = texture2D(iChannel0, vec2(uv.x - shift, uv.y)).b;

  // Occasional full-line glitch
  float lineGlitch = step(0.98, rand(floor(uv.y * iResolution.y * 0.5 + t))) * u_amount * 2.0;
  vec2 glitchUv = vec2(uv.x + lineGlitch, uv.y);
  vec3 glitchColor = texture2D(iChannel0, glitchUv).rgb;

  vec3 color = mix(vec3(r, g, b), glitchColor, step(0.001, lineGlitch));
  gl_FragColor = vec4(color, 1.0);
}
`;

const definition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_amount', type: 'float' },
    { name: 'u_speed', type: 'float' },
    { name: 'u_block_size', type: 'float' },
    { name: 'u_time', type: 'float' },
  ],
  defaults: { u_amount: 0.03, u_speed: 3.0, u_block_size: 20.0, u_time: 0.0 },
};

registerShader('glitch', definition);
export default definition;
