import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import {
  buildExtrudedGeometry,
  parseShapesFromSVG,
  buildExtrudeSettings,
  measureFlatMaxDim,
} from '@visant/extrude3d';

// SVGLoader uses DOMParser, which Node lacks — install one (matches the server).
beforeAll(() => {
  if (typeof globalThis.DOMParser === 'undefined') {
    globalThis.DOMParser = new JSDOM('').window.DOMParser as unknown as typeof DOMParser;
  }
});

// A simple synthetic SVG: a single filled square, 100×100 viewBox.
const SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">' +
  '<path d="M20 20 H80 V80 H20 Z" fill="#000000"/></svg>';

describe('@visant/extrude3d — parseShapesFromSVG', () => {
  it('parses a filled path into at least one shape', () => {
    const shapes = parseShapesFromSVG(SQUARE_SVG);
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes[0]).toBeInstanceOf(THREE.Shape);
  });

  it('drops a background rect matching the viewBox', () => {
    const withBg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<path d="M0 0 H100 V100 H0 Z" fill="#ffffff"/>' + // full viewBox bg → dropped
      '<path d="M20 20 H80 V80 H20 Z" fill="#000000"/></svg>';
    const shapes = parseShapesFromSVG(withBg);
    // Only the inner square survives (the viewBox-sized rect is filtered out).
    expect(shapes.length).toBe(1);
  });
});

describe('@visant/extrude3d — buildExtrudeSettings', () => {
  it('derives stable, pinned settings from the engine knobs', () => {
    // maxFlatDim=60 (the 60×60 square), 1 shape, depth=2, smoothness=0.5.
    const s = buildExtrudeSettings(60, 1, { depth: 2, smoothness: 0.5 });
    expect(s.depth).toBeCloseTo((2 / 10) * 60, 6); // 12
    // idealBevel = round(4 + 0.5*8) = 8 ; idealCurve = round(32 + 0.5*64) = 64
    // estimatedVerts = 8*64*6 = 3072 < perShape(600000) → no reduction
    expect(s.bevelSegments).toBe(8);
    expect(s.curveSegments).toBe(64);
    expect(s.bevelEnabled).toBe(true);
    // bevelScale = min(60*0.05,1) = 1 ; bevelThickness = min(1*0.5, depth*0.5) = 0.5
    expect(s.bevelThickness).toBeCloseTo(0.5, 6);
    expect(s.bevelSize).toBeCloseTo(0.5, 6);
  });

  it('reduces segment counts when the vertex budget is tight', () => {
    const s = buildExtrudeSettings(60, 1, { depth: 2, smoothness: 1, vertexBudget: 1000 });
    // tight budget forces the sqrt reduction, clamped to the floors (>=2 / >=8)
    expect(s.bevelSegments).toBeGreaterThanOrEqual(2);
    expect(s.curveSegments).toBeGreaterThanOrEqual(8);
    expect(s.bevelSegments).toBeLessThan(12);
  });
});

describe('@visant/extrude3d — buildExtrudedGeometry', () => {
  it('extrudes a square SVG into a real BufferGeometry', () => {
    const result = buildExtrudedGeometry(SQUARE_SVG, {
      depth: 2,
      smoothness: 0.5,
      bevelEnabled: true,
    });
    expect(result).not.toBeNull();
    const { geometry, center, baseScale, shapeCount } = result!;

    expect(shapeCount).toBe(1);

    const pos = geometry.attributes.position;
    expect(pos).toBeDefined();
    expect(pos.count).toBeGreaterThan(0);

    // Geometry has real 3D extent on all axes (it was extruded in Z).
    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox!.getSize(size);
    expect(size.x).toBeGreaterThan(0);
    expect(size.y).toBeGreaterThan(0);
    expect(size.z).toBeGreaterThan(0);

    // baseScale fits the largest dimension to a 4-unit box.
    const maxDim = Math.max(size.x, size.y, size.z);
    expect(baseScale).toBeCloseTo(4 / maxDim, 4);

    // center is finite.
    expect(Number.isFinite(center.x)).toBe(true);
    expect(Number.isFinite(center.z)).toBe(true);

    geometry.dispose();
  });

  it('returns null for an SVG with no shapes', () => {
    const empty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
    expect(buildExtrudedGeometry(empty, { depth: 1, smoothness: 0.5 })).toBeNull();
  });

  it('accepts pre-parsed shapes directly', () => {
    const shapes = parseShapesFromSVG(SQUARE_SVG);
    const dim = measureFlatMaxDim(shapes);
    expect(dim).toBeGreaterThanOrEqual(1);
    const result = buildExtrudedGeometry(shapes, { depth: 1, smoothness: 0.3 });
    expect(result).not.toBeNull();
    result!.geometry.dispose();
  });
});
