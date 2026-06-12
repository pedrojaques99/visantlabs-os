export type {
  BevelOptions,
  BuildExtrudedGeometryOptions,
  ExtrudedGeometryResult,
  OpenTypeFontLike,
  OpenTypePathLike,
  OpenTypeGlyphLike,
} from './types.js';

export {
  buildExtrudedGeometry,
  buildExtrudeSettings,
  measureFlatMaxDim,
  parseShapesFromSVG,
  smoothCreaseNormals,
  recomputeTriplanarUVs,
  isViewBoxRect,
  type ExtrudeSettings,
} from './geometry.js';

export {
  materialPresets,
  MATERIAL_UI,
  MATERIAL_LIB,
  resolveMaterial,
  getSimpleMaterialProps,
  type MaterialPresetDef,
  type MaterialUiId,
  type MaterialCategory,
  type MaterialUiEntry,
  type MaterialLibEntry,
  type ResolvedMaterial,
  type MaterialOverrides,
  type SimpleMaterialProps,
} from './materials.js';

export { textToSvg } from './fonts.js';

export { svgToGlb, type SvgToGlbOptions, type GlbResult } from './glb.js';
