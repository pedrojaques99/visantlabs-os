import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { svgToGlb } from '@visant/extrude3d/glb';

beforeAll(() => {
  if (typeof globalThis.DOMParser === 'undefined') {
    globalThis.DOMParser = new JSDOM('').window.DOMParser as unknown as typeof DOMParser;
  }
});

const SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">' +
  '<path d="M20 20 H80 V80 H20 Z" fill="#000000"/></svg>';

function readMagic(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes.subarray(0, 4));
}

describe('@visant/extrude3d — svgToGlb', () => {
  it('serializes a small SVG into a valid GLB buffer', () => {
    const { glb, positions, indices } = svgToGlb(SQUARE_SVG, { depth: 0.9, smoothness: 0.5 });

    // glTF binary magic header.
    expect(readMagic(glb)).toBe('glTF');
    expect(glb.byteLength).toBeGreaterThan(12);

    // GLB version field (offset 4, little-endian) is 2.
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    expect(view.getUint32(4, true)).toBe(2);
    // declared total length matches the actual buffer length.
    expect(view.getUint32(8, true)).toBe(glb.byteLength);

    // Real geometry came through.
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.length % 3).toBe(0);
    expect(indices.length).toBe(positions.length / 3);
  });

  it('throws when the SVG has no shapes', () => {
    const empty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
    expect(() => svgToGlb(empty)).toThrow(/no shapes/i);
  });

  it('embeds the requested PBR material factors in the JSON chunk', () => {
    const { glb } = svgToGlb(SQUARE_SVG, { metalness: 0.6, roughness: 0.3 });
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    const jsonLen = view.getUint32(12, true); // first chunk length
    const json = new TextDecoder().decode(glb.subarray(20, 20 + jsonLen));
    const gltf = JSON.parse(json);
    expect(gltf.materials[0].pbrMetallicRoughness.metallicFactor).toBe(0.6);
    expect(gltf.materials[0].pbrMetallicRoughness.roughnessFactor).toBe(0.3);
  });
});
