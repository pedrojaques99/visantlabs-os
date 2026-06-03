/**
 * Server-side SVG → 3D → GLB export using Three.js in Node.js.
 * Builds GLB binary manually (no GLTFExporter — avoids browser API deps).
 */

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let domReady = false;

async function ensureDOMParser(): Promise<void> {
  if (domReady) return;
  if (typeof globalThis.DOMParser === 'undefined') {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('');
    globalThis.DOMParser = dom.window.DOMParser as any;
  }
  domReady = true;
}

function parseShapesFromSVG(svgString: string): THREE.Shape[] {
  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);
  const allShapes: THREE.Shape[] = [];
  const vbMatch = svgString.match(
    /viewBox\s*=\s*["']\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)/
  );
  const vbW = vbMatch ? parseFloat(vbMatch[3]) : null;
  const vbH = vbMatch ? parseFloat(vbMatch[4]) : null;

  svgData.paths.forEach((path) => {
    const style = (path as any).userData?.style;
    const hasFill = style?.fill && style.fill !== 'none' && style.fill !== 'transparent';
    const hasStroke = style?.stroke && style.stroke !== 'none' && style.stroke !== 'transparent';

    if (hasFill) {
      for (const shape of SVGLoader.createShapes(path)) {
        if (vbW && vbH && isViewBoxRect(shape, vbW, vbH)) continue;
        allShapes.push(shape);
      }
    }

    if (hasStroke) {
      const strokeWidth = parseFloat(style?.strokeWidth ?? '2');
      path.subPaths.forEach((subPath) => {
        const points = subPath.getPoints(12);
        if (points.length < 2) return;
        const shape = new THREE.Shape();
        const hw = strokeWidth / 2;
        const left: THREE.Vector2[] = [];
        const right: THREE.Vector2[] = [];
        for (let i = 0; i < points.length; i++) {
          const c = points[i],
            p = points[Math.max(0, i - 1)],
            n = points[Math.min(points.length - 1, i + 1)];
          const dx = n.x - p.x,
            dy = n.y - p.y,
            len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len,
            ny = dx / len;
          left.push(new THREE.Vector2(c.x + nx * hw, c.y + ny * hw));
          right.push(new THREE.Vector2(c.x - nx * hw, c.y - ny * hw));
        }
        shape.moveTo(left[0].x, left[0].y);
        for (let i = 1; i < left.length; i++) shape.lineTo(left[i].x, left[i].y);
        for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, right[i].y);
        shape.closePath();
        allShapes.push(shape);
      });
    }

    if (!hasFill && !hasStroke) {
      allShapes.push(...SVGLoader.createShapes(path));
    }
  });

  return allShapes;
}

function isViewBoxRect(shape: THREE.Shape, vbW: number, vbH: number): boolean {
  const pts = shape.getPoints(4);
  if (pts.length !== 4 && pts.length !== 5) return false;
  const bb = new THREE.Box2();
  for (const p of pts) bb.expandByPoint(p);
  const size = new THREE.Vector2();
  bb.getSize(size);
  return Math.abs(size.x - vbW) / vbW < 0.01 && Math.abs(size.y - vbH) / vbH < 0.01;
}

export interface ExportOptions {
  depth?: number;
  smoothness?: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
}

const DEFAULTS: Required<ExportOptions> = {
  depth: 0.9,
  smoothness: 0.5,
  bevelEnabled: true,
  bevelThickness: 0.5,
  bevelSize: 0.5,
  color: '#c0c0c0',
  metalness: 0.6,
  roughness: 0.3,
};

// ── GLB Builder (no browser APIs needed) ────────────────────────────────────

function buildGlb(
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
  color: number[],
  metalness: number,
  roughness: number
): Buffer {
  const posBytes = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
  const normBytes = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);
  const idxBytes = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);
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
  const jsonBuf = Buffer.from(jsonPadded, 'utf8');
  const binPadded = binLength + ((4 - (binLength % 4)) % 4);
  const binBuf = Buffer.alloc(binPadded);
  posBytes.copy(binBuf, posOffset);
  normBytes.copy(binBuf, normOffset);
  idxBytes.copy(binBuf, idxOffset);

  // GLB header: magic(4) + version(4) + length(4) + jsonChunkLen(4) + jsonChunkType(4) + json + binChunkLen(4) + binChunkType(4) + bin
  const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const glb = Buffer.alloc(totalLength);
  let off = 0;

  // Header
  glb.writeUInt32LE(0x46546c67, off);
  off += 4; // 'glTF'
  glb.writeUInt32LE(2, off);
  off += 4; // version
  glb.writeUInt32LE(totalLength, off);
  off += 4;

  // JSON chunk
  glb.writeUInt32LE(jsonBuf.length, off);
  off += 4;
  glb.writeUInt32LE(0x4e4f534a, off);
  off += 4; // 'JSON'
  jsonBuf.copy(glb, off);
  off += jsonBuf.length;

  // BIN chunk
  glb.writeUInt32LE(binBuf.length, off);
  off += 4;
  glb.writeUInt32LE(0x004e4942, off);
  off += 4; // 'BIN\0'
  binBuf.copy(glb, off);

  return glb;
}

export async function svgToGlb(svgString: string, opts: ExportOptions = {}): Promise<Buffer> {
  await ensureDOMParser();

  const o = { ...DEFAULTS, ...opts };
  const allShapes = parseShapesFromSVG(svgString);
  if (allShapes.length === 0) throw new Error('No shapes found in SVG');

  const tempGeo = new THREE.ShapeGeometry(allShapes);
  tempGeo.computeBoundingBox();
  const flatSize = new THREE.Vector3();
  tempGeo.boundingBox!.getSize(flatSize);
  const maxFlatDim = Math.max(flatSize.x, flatSize.y, 1);
  tempGeo.dispose();

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
  nonIndexed.dispose();

  return glb;
}
