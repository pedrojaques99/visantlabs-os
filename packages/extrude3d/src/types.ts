/**
 * Bevel inputs forwarded to {@link buildExtrudedGeometry}. These mirror the
 * user-facing controls of the Studio3D engine (a 0–1 `smoothness` knob, plus
 * optional bevel thickness/size scalars) — NOT raw three.js ExtrudeGeometry
 * settings, which are derived internally from these + the SVG's flat bounds.
 */
export interface BevelOptions {
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
}

/** Options for {@link buildExtrudedGeometry}. */
export interface BuildExtrudedGeometryOptions extends BevelOptions {
  /** Extrusion depth knob (engine units, 0–10ish). Scaled by the flat bounds. */
  depth: number;
  /** Smoothness 0–1 → drives bevel segments + curve subdivisions. */
  smoothness: number;
  /**
   * Vertex budget shared across all shapes in the SVG. Bevel/curve segment
   * counts are reduced when the estimate exceeds the per-shape share.
   * @default 600000
   */
  vertexBudget?: number;
  /**
   * Crease angle (radians) below which adjacent face normals are averaged
   * (smoothed). Above it edges stay sharp. `null`/`undefined` skips the
   * crease-smoothing pass and uses three's `computeVertexNormals`.
   * @default Math.PI / 6
   */
  creaseAngle?: number | null;
}

/** Result of {@link buildExtrudedGeometry}. */
export interface ExtrudedGeometryResult {
  /** The merged, normal-smoothed, UV'd extruded geometry. */
  geometry: import('three').BufferGeometry;
  /** Bounding-box center of the geometry. */
  center: import('three').Vector3;
  /**
   * Uniform scale that fits the geometry's largest dimension into a 4-unit box
   * (`4 / maxDim`), matching the Studio3D engine's `baseScale`.
   */
  baseScale: number;
  /** Number of shapes extracted from the SVG. */
  shapeCount: number;
}

/**
 * Structural subset of an opentype.js `Font` used by {@link textToSvg}. Declared
 * here so the package never has to import (or depend on) `opentype.js` — callers
 * pass whatever font object they already loaded.
 */
export interface OpenTypeFontLike {
  unitsPerEm?: number;
  getPath(text: string, x: number, y: number, fontSize: number): OpenTypePathLike;
  stringToGlyphs(text: string): OpenTypeGlyphLike[];
  getKerningValue(left: OpenTypeGlyphLike, right: OpenTypeGlyphLike): number;
}

export interface OpenTypePathLike {
  getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  toPathData(decimals?: number): string;
}

export interface OpenTypeGlyphLike {
  advanceWidth?: number;
  getPath(x: number, y: number, fontSize: number): OpenTypePathLike;
}
