import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parseShapesFromSVG, measureFlatMaxDim } from './geometry.js';

/**
 * Options for {@link svgToGlb}. All optional; defaults match the Studio3D
 * server export. `depth`/`smoothness`/bevel drive the same extrude math the
 * client uses; `color`/`metalness`/`roughness` become the GLB PBR material.
 */
export interface SvgToGlbOptions {
  depth?: number;
  smoothness?: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
}

const DEFAULTS: Required<SvgToGlbOptions> = {
  depth: 0.9,
  smoothness: 0.5,
  bevelEnabled: true,
  bevelThickness: 0.5,
  bevelSize: 0.5,
  color: '#c0c0c0',
  metalness: 0.6,
  roughness: 0.3,
};

/**
 * Output of {@link svgToGlb}: the raw GLB bytes plus the interleaved geometry
 * arrays they were built from (handy for tests / further processing).
 */
export interface GlbResult {
  /** Raw `.glb` bytes (`glTF` magic header). */
  glb: Uint8Array;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

// ── GLB Builder (no browser APIs, no GLTFExporter) ──────────────────────────
//
// Serializes a single indexed mesh + one PBR material into a binary glTF (.glb)
// by hand. Intentionally dependency-free so it runs in plain Node with no DOM —
// the server export path relies on this.

function buildGlb(
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
  color: number[],
  metalness: number,
  roughness: number
): Uint8Array {
  const posBytes = new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength);
  const normBytes = new Uint8Array(normals.buffer, normals.byteOffset, normals.byteLength);
  const idxBytes = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);
  const binLength = posBytes.length + normBytes.length + idxBytes.length;

  let min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      if (positions[i + j] < min[j]) min[j] = positions[i + j];
      if (positions[i + j] > max[j]) max[j] = positions[i + j];
    }
  }

  const vertexCount = positions.length / 3;
  const posOffset = 0;
  const normOffset = posBytes.length;
  const idxOffset = normOffset + normBytes.length;

  const gltf = {
    asset: { version: '2.0', generator: 'Visant Studio3D Server' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'ExtrudedSVG' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', max: max, min: min },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
      { bufferView: 2, componentType: 5125, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: normOffset, byteLength: normBytes.length, target: 34962 },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes.length, target: 34963 },
    ],
    buffers: [{ byteLength: binLength }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [...color, 1],
          metallicFactor: metalness,
          roughnessFactor: roughness,
        },
        name: 'material',
      },
    ],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonPadded = jsonStr + ' '.repeat((4 - (jsonStr.length % 4)) % 4);
  const jsonBuf = new TextEncoder().encode(jsonPadded);
  const binPadded = binLength + ((4 - (binLength % 4)) % 4);
  const binBuf = new Uint8Array(binPadded);
  binBuf.set(posBytes, posOffset);
  binBuf.set(normBytes, normOffset);
  binBuf.set(idxBytes, idxOffset);

  // GLB header: magic(4) + version(4) + length(4) + jsonChunkLen(4) + jsonChunkType(4) + json + binChunkLen(4) + binChunkType(4) + bin
  const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);
  let off = 0;

  // Header
  view.setUint32(off, 0x46546c67, true);
  off += 4; // 'glTF'
  view.setUint32(off, 2, true);
  off += 4; // version
  view.setUint32(off, totalLength, true);
  off += 4;

  // JSON chunk
  view.setUint32(off, jsonBuf.length, true);
  off += 4;
  view.setUint32(off, 0x4e4f534a, true);
  off += 4; // 'JSON'
  glb.set(jsonBuf, off);
  off += jsonBuf.length;

  // BIN chunk
  view.setUint32(off, binBuf.length, true);
  off += 4;
  view.setUint32(off, 0x004e4942, true);
  off += 4; // 'BIN\0'
  glb.set(binBuf, off);

  return glb;
}

/**
 * SVG string → extruded, merged, centered geometry serialized as a binary glTF
 * (`.glb`). This is the pure core of the Studio3D server export
 * (`studio3dExportService.svgToGlb`); the service keeps only the DOMParser/JSDOM
 * environment shim and storage. Geometry math (extrude settings, vertex budget)
 * matches the legacy server path exactly — plain `computeVertexNormals`, no
 * crease smoothing, no bevel clamp.
 *
 * Returns the GLB bytes plus the geometry arrays. Throws if the SVG yields no
 * shapes or the merge fails. Requires a DOM `DOMParser` to be available (the
 * server installs one via JSDOM before calling).
 */
export function svgToGlb(svgString: string, opts: SvgToGlbOptions = {}): GlbResult {
  const o = { ...DEFAULTS, ...opts };
  const allShapes = parseShapesFromSVG(svgString);
  if (allShapes.length === 0) throw new Error('No shapes found in SVG');

  const maxFlatDim = measureFlatMaxDim(allShapes);

  const scaledDepth = (o.depth / 10) * maxFlatDim;
  const bevelScale = Math.min(maxFlatDim * 0.05, 1);
  const idealBevel = Math.round(4 + o.smoothness * 8);
  const idealCurve = Math.round(32 + o.smoothness * 64);
  const budget = 600_000;
  const perShape = Math.max(Math.floor(budget / Math.max(allShapes.length, 1)), 500);
  const est = idealBevel * idealCurve * 6;
  const red = est > perShape ? Math.sqrt(perShape / est) : 1;

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: scaledDepth,
    bevelEnabled: o.bevelEnabled,
    bevelThickness: bevelScale * o.bevelThickness,
    bevelSize: bevelScale * o.bevelSize,
    bevelSegments: Math.max(2, Math.min(Math.round(idealBevel * red), 64)),
    curveSegments: Math.max(8, Math.min(Math.round(idealCurve * red), 128)),
  };

  const geometries = allShapes.map((shape) => {
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.computeVertexNormals();
    return geo;
  });

  // Merge all geometries
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());

  if (!merged) throw new Error('Failed to merge geometries');

  // Center
  merged.computeBoundingBox();
  const center = new THREE.Vector3();
  merged.boundingBox!.getCenter(center);
  merged.translate(-center.x, -center.y, -center.z);

  // Extract arrays
  const nonIndexed = merged.index ? merged.toNonIndexed() : merged;
  nonIndexed.computeVertexNormals();

  const positions = nonIndexed.attributes.position.array as Float32Array;
  const normals = nonIndexed.attributes.normal.array as Float32Array;
  const vertCount = positions.length / 3;
  const indices = new Uint32Array(vertCount);
  for (let i = 0; i < vertCount; i++) indices[i] = i;

  const c = new THREE.Color(o.color);
  const glb = buildGlb(positions, normals, indices, [c.r, c.g, c.b], o.metalness, o.roughness);

  merged.dispose();
  if (nonIndexed !== merged) nonIndexed.dispose();

  return { glb, positions, normals, indices };
}
