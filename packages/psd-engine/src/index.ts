// @visant/psd-engine — public surface.
// Isomorphic PSD mockup compositor: ag-psd tree → canvas.

export {
  flattenLayers,
  replaceLinkedSmartObjects,
  perspectiveWarp,
  composePsd,
  coverArtCanvas,
  applyDisplacementFilter,
  BLEND_MAP,
} from './compose.js';

export { computeFaces } from './faces.js';

export { buildAdjustmentLut } from './adjustments.js';
export type { RgbLut } from './adjustments.js';

export { SO_TARGET, BRAND_HIDE, SO_DECOR } from './constants.js';

export { resolveSoTarget, applyHideRules } from './resolve.js';

export { createNodeAdapter, initializeAgPsdCanvas } from './adapters/node.js';
export { createBrowserAdapter } from './adapters/browser.js';

export { preloadDisplacementMaps, createBrowserFsCallbacks } from './displacement.js';
export type { DisplacementCanvas, FsCallbacks } from './displacement.js';

export { extractScene, renderScene } from './scene/index.js';
export type {
  SceneDoc,
  SceneFace,
  SceneLayer,
  Quad,
  AssetMap,
  ArtMap,
  RenderSceneOptions,
  ExtractResult,
} from './scene/index.js';

export type { CreateCanvas, CanvasLike, ReplacedLayer, Face, FaceSo } from './types.js';
