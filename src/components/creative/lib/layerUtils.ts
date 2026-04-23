import type { CreativeLayer } from '../store/creativeTypes';

/** Compute absolute CSS position/size from normalized layer data. */
export function getLayerStyle(layer: CreativeLayer, canvasWidth: number, canvasHeight: number) {
  const { data } = layer;
  return {
    left: data.position.x * canvasWidth,
    top: data.position.y * canvasHeight,
    width: data.size.w * canvasWidth,
    height: data.size.h * canvasHeight,
    zIndex: layer.zIndex,
  } as const;
}

/** Check if an ID is a persisted MongoDB ObjectId (24 hex chars). */
export const isPersistedId = (id: string | null): id is string =>
  !!id && /^[a-f0-9]{24}$/i.test(id);
