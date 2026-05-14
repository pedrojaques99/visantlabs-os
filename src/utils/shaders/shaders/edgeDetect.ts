import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_threshold;
uniform float u_strength;
uniform float u_overlay;
varying vec2 v_texCoord;

float luma(vec2 uv) {
  vec3 c = texture2D(iChannel0, uv).rgb;
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 p = 1.0 / iResolution;
  float tl = luma(v_texCoord + vec2(-p.x, p.y));
  float t  = luma(v_texCoord + vec2(0.0, p.y));
  float tr = luma(v_texCoord + vec2(p.x, p.y));
  float l  = luma(v_texCoord + vec2(-p.x, 0.0));
  float r  = luma(v_texCoord + vec2(p.x, 0.0));
  float bl = luma(v_texCoord + vec2(-p.x,-p.y));
  float b  = luma(v_texCoord + vec2(0.0,-p.y));
  float br = luma(v_texCoord + vec2(p.x,-p.y));

  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
  float edge = length(vec2(gx, gy)) * u_strength;
  edge = smoothstep(u_threshold * 0.5, u_threshold, edge);

  vec4 original = texture2D(iChannel0, v_texCoord);
  vec3 edgeColor = vec3(edge);

  // Overlay mode: edges over original image
  vec3 result = mix(edgeColor, original.rgb * (1.0 - edge * 0.5) + edgeColor * 0.5, u_overlay);
  gl_FragColor = vec4(result, original.a);
}
`;

const definition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_threshold', type: 'float' },
    { name: 'u_strength', type: 'float' },
    { name: 'u_overlay', type: 'float' },
  ],
  defaults: { u_threshold: 0.1, u_strength: 2.0, u_overlay: 0.0 },
};

registerShader('edgeDetect', definition);
export default definition;
