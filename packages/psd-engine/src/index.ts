// @visantlabs/psd-engine — public surface.
// Isomorphic PSD mockup compositor: ag-psd tree → canvas.

export {
  flattenLayers,
  replaceLinkedSmartObjects,
  perspectiveWarp,
  composePsd,
  coverArtCanvas,
  BLEND_MAP,
} from './compose.js';

export { computeFaces } from './faces.js';

export { SO_TARGET, BRAND_HIDE, SO_DECOR } from './constants.js';

export type {
  CreateCanvas,
  CanvasLike,
  ReplacedLayer,
  Face,
  FaceSo,
} from './types.js';
