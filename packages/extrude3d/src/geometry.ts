import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {
  BuildExtrudedGeometryOptions,
  ExtrudedGeometryResult,
} from './types.js';

const SMOOTH_VERTEX_LIMIT = 300_000;

/**
 * Average face normals within a vertex's coincident group when the angle
 * between them is below `creaseAngleRad` (sharp edges above it stay crisp).
 * Falls back to `computeVertexNormals` past {@link SMOOTH_VERTEX_LIMIT} verts.
 * Returns a new, non-indexed geometry (the input is left untouched).
 */
export function smoothCreaseNormals(
  geometry: THREE.BufferGeometry,
  creaseAngleRad: number
): THREE.BufferGeometry {
  const tempGeo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = tempGeo.attributes.position;
  if (!posAttr) return geometry;

  const count = posAttr.count;

  if (count > SMOOTH_VERTEX_LIMIT) {
    tempGeo.computeVertexNormals();
    return tempGeo;
  }

  const flatNormals: THREE.Vector3[] = [];

  for (let i = 0; i < count; i += 3) {
    const vA = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    const vB = new THREE.Vector3(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
    const vC = new THREE.Vector3(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));

    const cb = new THREE.Vector3().subVectors(vC, vB);
    const ab = new THREE.Vector3().subVectors(vA, vB);
    cb.cross(ab).normalize();

    flatNormals.push(cb.clone(), cb.clone(), cb.clone());
  }

  const posToIndices = new Map<string, number[]>();
  const precision = 100000;
  for (let i = 0; i < count; i++) {
    const px = Math.round(posAttr.getX(i) * precision);
    const py = Math.round(posAttr.getY(i) * precision);
    const pz = Math.round(posAttr.getZ(i) * precision);
    const hash = `${px},${py},${pz}`;

    if (!posToIndices.has(hash)) {
      posToIndices.set(hash, []);
    }
    posToIndices.get(hash)!.push(i);
  }

  const cosThreshold = Math.cos(creaseAngleRad);
  const newNormals = new Float32Array(count * 3);

  for (const indices of posToIndices.values()) {
    const visited = new Set<number>();

    for (const idx of indices) {
      if (visited.has(idx)) continue;

      const n1 = flatNormals[idx];
      const smoothGroup = [idx];
      visited.add(idx);

      for (const otherIdx of indices) {
        if (visited.has(otherIdx)) continue;
        const n2 = flatNormals[otherIdx];

        if (n1.dot(n2) >= cosThreshold) {
          smoothGroup.push(otherIdx);
          visited.add(otherIdx);
        }
      }

      const avgNormal = new THREE.Vector3();
      for (const i of smoothGroup) {
        avgNormal.add(flatNormals[i]);
      }
      avgNormal.normalize();

      for (const i of smoothGroup) {
        newNormals[i * 3] = avgNormal.x;
        newNormals[i * 3 + 1] = avgNormal.y;
        newNormals[i * 3 + 2] = avgNormal.z;
      }
    }
  }

  tempGeo.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
  return tempGeo;
}

/**
 * Recompute box-projected (triplanar) UVs in place, projecting each vertex onto
 * the axis plane that best matches its normal and normalizing by the bounding
 * box's largest dimension.
 */
export function recomputeTriplanarUVs(geo: THREE.BufferGeometry, bb: THREE.Box3): void {
  const bbSize = new THREE.Vector3();
  bb.getSize(bbSize);
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute;
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const normalAttr = geo.attributes.normal as THREE.BufferAttribute;
  const maxDimUv = Math.max(bbSize.x, bbSize.y, bbSize.z) || 1;

  for (let j = 0; j < uvAttr.count; j++) {
    const px = posAttr.getX(j);
    const py = posAttr.getY(j);
    const pz = posAttr.getZ(j);
    const nx = Math.abs(normalAttr.getX(j));
    const ny = Math.abs(normalAttr.getY(j));
    const nz = Math.abs(normalAttr.getZ(j));
    let u: number, v: number;

    if (nz >= nx && nz >= ny) {
      u = (px - bb.min.x) / maxDimUv;
      v = 1 - (py - bb.min.y) / maxDimUv;
    } else if (nx >= ny) {
      u = (pz - bb.min.z) / maxDimUv;
      v = 1 - (py - bb.min.y) / maxDimUv;
    } else {
      u = (px - bb.min.x) / maxDimUv;
      v = (pz - bb.min.z) / maxDimUv;
    }
    uvAttr.setXY(j, u, v);
  }
  uvAttr.needsUpdate = true;
}

/**
 * True when `shape` is (approximately) the SVG's full viewBox rectangle — used
 * to drop background rects that SVGLoader emits as a fill shape.
 */
export function isViewBoxRect(shape: THREE.Shape, vbW: number, vbH: number): boolean {
  const pts = shape.getPoints(4);
  if (pts.length !== 4 && pts.length !== 5) return false;
  const bb = new THREE.Box2();
  for (const p of pts) bb.expandByPoint(p);
  const size = new THREE.Vector2();
  bb.getSize(size);
  const tolerance = 0.01;
  return Math.abs(size.x - vbW) / vbW < tolerance && Math.abs(size.y - vbH) / vbH < tolerance;
}

/**
 * Parse an SVG string into three.js `Shape`s ready for extrusion. Fills become
 * shapes directly (dropping the viewBox-sized background rect); strokes are
 * tessellated into a ribbon polygon of `strokeWidth`; paths with no explicit
 * fill/stroke fall back to fill shapes.
 *
 * Accepts both whitespace- and comma-separated viewBox values.
 */
export function parseShapesFromSVG(svgString: string): THREE.Shape[] {
  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);
  const allShapes: THREE.Shape[] = [];
  const vbMatch = svgString.match(
    /viewBox\s*=\s*["']\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)/
  );
  const vbW = vbMatch ? parseFloat(vbMatch[3]) : null;
  const vbH = vbMatch ? parseFloat(vbMatch[4]) : null;

  svgData.paths.forEach((path) => {
    const style = (path as { userData?: { style?: Record<string, string> } }).userData?.style;
    const hasFill = style?.fill && style.fill !== 'none' && style.fill !== 'transparent';
    const hasStroke = style?.stroke && style.stroke !== 'none' && style.stroke !== 'transparent';

    if (hasFill) {
      const shapes = SVGLoader.createShapes(path);
      for (const shape of shapes) {
        if (vbW && vbH && isViewBoxRect(shape, vbW, vbH)) continue;
        allShapes.push(shape);
      }
    }

    if (hasStroke) {
      const strokeWidth = parseFloat(style?.strokeWidth ?? '2');
      const divisions = 12;
      path.subPaths.forEach((subPath) => {
        const points = subPath.getPoints(divisions);
        if (points.length < 2) return;
        const shape = new THREE.Shape();
        const halfWidth = strokeWidth / 2;
        const leftSide: THREE.Vector2[] = [];
        const rightSide: THREE.Vector2[] = [];

        for (let i = 0; i < points.length; i++) {
          const curr = points[i];
          const prev = points[Math.max(0, i - 1)];
          const next = points[Math.min(points.length - 1, i + 1)];
          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          leftSide.push(new THREE.Vector2(curr.x + nx * halfWidth, curr.y + ny * halfWidth));
          rightSide.push(new THREE.Vector2(curr.x - nx * halfWidth, curr.y - ny * halfWidth));
        }

        shape.moveTo(leftSide[0].x, leftSide[0].y);
        for (let i = 1; i < leftSide.length; i++) shape.lineTo(leftSide[i].x, leftSide[i].y);
        for (let i = rightSide.length - 1; i >= 0; i--)
          shape.lineTo(rightSide[i].x, rightSide[i].y);
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

/** Three.js ExtrudeGeometry settings, derived from the engine's knobs. */
export interface ExtrudeSettings {
  depth: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  bevelSegments: number;
  curveSegments: number;
}

/**
 * Translate the engine's high-level knobs (`depth`, `smoothness`, bevel
 * thickness/size) + the SVG's flat bounds + shape complexity into concrete
 * three.js `ExtrudeGeometry` settings, including the vertex-budget reduction.
 * This is the exact math used by both the client geometry pipeline and the
 * server GLB export, so they never drift.
 */
export function buildExtrudeSettings(
  maxFlatDim: number,
  shapeCount: number,
  opts: BuildExtrudedGeometryOptions
): ExtrudeSettings {
  const {
    depth,
    smoothness,
    bevelEnabled = true,
    bevelThickness: userThickness = 0.5,
    bevelSize: userSize = 0.5,
    vertexBudget = 600_000,
  } = opts;

  const complexity = shapeCount;
  const vertsBudgetPerShape = Math.max(Math.floor(vertexBudget / Math.max(complexity, 1)), 500);
  const scaledDepth = (depth / 10) * maxFlatDim;
  const bevelScale = Math.min(maxFlatDim * 0.05, 1);

  const idealBevel = Math.round(4 + smoothness * 8);
  const idealCurve = Math.round(32 + smoothness * 64);
  const estimatedVerts = idealBevel * idealCurve * 6;
  const reductionFactor =
    estimatedVerts > vertsBudgetPerShape ? Math.sqrt(vertsBudgetPerShape / estimatedVerts) : 1;

  const bevelSegments = Math.max(2, Math.min(Math.round(idealBevel * reductionFactor), 64));
  const curveSegments = Math.max(8, Math.min(Math.round(idealCurve * reductionFactor), 128));

  const maxBevel = Math.max(0.01, scaledDepth * 0.5);
  const bevelThickness = Math.min(bevelScale * userThickness, maxBevel);
  const bevelSize = Math.min(bevelScale * userSize, maxBevel);

  return {
    depth: scaledDepth,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
  };
}

/**
 * Measure the flat (un-extruded) bounding box of a set of shapes and return the
 * larger of width/height (clamped to ≥ 1) — the `maxFlatDim` that drives depth
 * and bevel scaling. Disposes the temporary geometry it builds.
 */
export function measureFlatMaxDim(shapes: THREE.Shape[]): number {
  const tempGeo = new THREE.ShapeGeometry(shapes);
  tempGeo.computeBoundingBox();
  const flatSize = new THREE.Vector3();
  tempGeo.boundingBox!.getSize(flatSize);
  const maxFlatDim = Math.max(flatSize.x, flatSize.y, 1);
  tempGeo.dispose();
  return maxFlatDim;
}

/**
 * SVG (or pre-parsed shapes) → a single extruded, merged, normal-smoothed,
 * triplanar-UV'd `BufferGeometry`, plus its center and a fit-to-4-units scale.
 *
 * This is the pure heart of the Studio3D engine's `useExtrudedGeometry` hook
 * (which keeps React state, progress, cancellation and disposal). The geometry
 * math here is identical to the legacy hook — extracting it changes nothing.
 *
 * The caller owns the returned `geometry` and must `dispose()` it.
 */
export function buildExtrudedGeometry(
  svg: string | THREE.Shape[],
  opts: BuildExtrudedGeometryOptions
): ExtrudedGeometryResult | null {
  const allShapes = typeof svg === 'string' ? parseShapesFromSVG(svg) : svg;
  if (allShapes.length === 0) return null;

  const maxFlatDim = measureFlatMaxDim(allShapes);
  const extrudeSettings = buildExtrudeSettings(maxFlatDim, allShapes.length, opts);

  const individualGeos: THREE.ExtrudeGeometry[] = [];
  for (let i = 0; i < allShapes.length; i++) {
    individualGeos.push(new THREE.ExtrudeGeometry(allShapes[i], extrudeSettings));
  }

  let merged = BufferGeometryUtils.mergeGeometries(individualGeos, false);
  individualGeos.forEach((g) => g.dispose());

  if (!merged) return null;

  const creaseAngle = opts.creaseAngle === undefined ? Math.PI / 6 : opts.creaseAngle;
  if (creaseAngle != null) {
    const smoothed = smoothCreaseNormals(merged, creaseAngle);
    merged.dispose();
    merged = smoothed;
  } else {
    merged.computeVertexNormals();
  }

  merged.computeBoundingBox();
  recomputeTriplanarUVs(merged, merged.boundingBox!);

  const bb = merged.boundingBox!;
  const ctr = new THREE.Vector3();
  bb.getCenter(ctr);
  const size = new THREE.Vector3();
  bb.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = maxDim > 0 ? 4 / maxDim : 1;

  return { geometry: merged, center: ctr, baseScale: s, shapeCount: allShapes.length };
}
