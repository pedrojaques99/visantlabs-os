// Smart Object resolver + hide-rule applicator.
// Single source of truth: was duplicated in render-server.ts, render-cli.ts, render.worker.ts.

import { SO_TARGET, BRAND_HIDE } from './constants.js';

/** Flat layer (from flattenLayers) with a placedLayer property. */
interface SoLayer {
  name?: string;
  path?: string;
  placedLayer?: unknown;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  hidden?: boolean;
}

function area(l: SoLayer): number {
  return ((l.right ?? 0) - (l.left ?? 0)) * ((l.bottom ?? 0) - (l.top ?? 0));
}

/**
 * Resolves the best Smart Object target for a given soName from a flat layer list.
 *
 * Priority (Photoshop convention):
 *  1. Exact path match
 *  2. Exact name match
 *  3. Partial path match (case-insensitive)
 *  4. Partial name match (case-insensitive)
 *  5. Only SO in the document
 *  6. Largest SO matching SO_TARGET pattern
 *  7. Largest SO overall
 *
 * Returns null if no layers at all.
 */
export function resolveSoTarget(allLayers: any[], soName: string): any | null {
  const smartObjects: SoLayer[] = allLayers.filter((l: any) => l.placedLayer);

  const byArea = (a: SoLayer, b: SoLayer) => area(b) > area(a) ? b : a;
  const lower = soName.toLowerCase();

  return (
    allLayers.find((l: any) => l.path === soName) ||
    allLayers.find((l: any) => l.name === soName) ||
    allLayers.find((l: any) => l.path?.toLowerCase().includes(lower)) ||
    allLayers.find((l: any) => l.name?.toLowerCase().includes(lower)) ||
    (smartObjects.length === 1 ? smartObjects[0] : null) ||
    ((() => {
      const matches = smartObjects.filter((l: any) => SO_TARGET.test(l.name ?? ''));
      return matches.length ? matches.reduce(byArea) : null;
    })()) ||
    (smartObjects.length ? smartObjects.reduce(byArea) : null)
  );
}

/**
 * Applies hide rules to the PSD layer tree in-place:
 *  - Hides BRAND_HIDE layers that were NOT replaced (watermarks/placeholders).
 *  - Hides any layer whose name is in the explicit `hideLayers` list.
 *
 * Must be called AFTER replaceLinkedSmartObjects — replacedNames is used to
 * protect replaced layers from being hidden by BRAND_HIDE.
 *
 * @param allLayers    Flat layer list from flattenLayers().
 * @param replacedNames Set of layer names already replaced (won't be hidden).
 * @param hideLayers   Optional explicit list of layer names to force-hide.
 */
export function applyHideRules(
  allLayers: any[],
  replacedNames: Set<string>,
  hideLayers: string[] = []
): void {
  for (const layer of allLayers) {
    const name: string = layer.name ?? '';
    const shouldHide =
      (BRAND_HIDE.test(name) && !replacedNames.has(name)) ||
      hideLayers.includes(name);
    if (shouldHide && layer.__original) {
      layer.__original.hidden = true;
    }
  }
}
