// Re-export fino de @visantlabs/psd-engine — single source of truth.
// Mantido por compat de import path; novos consumidores importam do pacote.
export {
  flattenLayers,
  replaceLinkedSmartObjects,
  perspectiveWarp,
  composePsd,
  coverArtCanvas,
  BLEND_MAP,
} from '@visantlabs/psd-engine';
export type { CreateCanvas, ReplacedLayer } from '@visantlabs/psd-engine';
