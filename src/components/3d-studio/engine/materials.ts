/**
 * Studio3D material library — now sourced from the standalone @visant/extrude3d
 * package. This file is a thin re-export so existing imports
 * (`./engine/materials`) keep working unchanged. The PBR presets, UI grouping,
 * resolver and simple-prop mapping all live in the package.
 */
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
} from '@visant/extrude3d/materials';
