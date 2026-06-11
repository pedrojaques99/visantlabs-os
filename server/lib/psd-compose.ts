// Re-export fino de @visant/psd-engine — single source of truth.
// Mantido por compat de import path; novos consumidores importam do pacote.
export {
  flattenLayers,
  replaceLinkedSmartObjects,
  perspectiveWarp,
  composePsd,
  coverArtCanvas,
  BLEND_MAP,
} from '@visant/psd-engine';
export type { CreateCanvas, ReplacedLayer } from '@visant/psd-engine';
