// Scene extraction — PSD (ag-psd tree, already read by the caller) → SceneDoc.
//
// Strategy (documented simplification, see LIMITATIONS below):
//   1. Find every editable face (computeFaces over the scanned smart objects).
//   2. Locate the first top-level child whose subtree contains a face SO.
//      - Everything BELOW it → a single flattened `base` image.
//      - Each top-level child AT/ABOVE it that is NOT a face container →
//        its own flattened `over` image (blendMode/opacity annotated).
//   3. For each face, capture its quad (nonAffineTransform || transform) and
//      inner size so render can warp generated art into it.
//   4. BRAND_HIDE layers are excluded entirely. Blend modes outside BLEND_MAP
//      are recorded in `warnings` (candidates for a server fallback).
//
// LIMITATIONS:
//   - Decorative layers that live INSIDE a face's own top-level group are not
//     re-composited as overs (the group is consumed by the face geometry).
//     The BOXY template pattern keeps lights/shadows as separate sibling
//     top-level groups, so this is safe in practice; non-conforming PSDs add a
//     warning and should use the server fallback.
//   - Faces sharing a single top-level container are all extracted, but only one
//     base/over partition (by the first such container) is produced.

import { flattenLayers, composePsd, BLEND_MAP } from '../compose.js';
import { computeFaces } from '../faces.js';
import { BRAND_HIDE } from '../constants.js';
import type { CreateCanvas, FaceSo } from '../types.js';
import type { SceneDoc, SceneFace, SceneLayer, AssetMap, Quad } from './types.js';

export interface ExtractResult {
  doc: SceneDoc;
  /** ref → canvas. Caller encodes these to WebP/PNG and uploads them. */
  assets: AssetMap;
}

function layerAlpha(layer: any): number {
  const op = layer.opacity ?? 1;
  const fill = layer.fillOpacity ?? 1;
  return Math.max(0, Math.min(1, op * fill));
}

/** Does this layer (or any descendant) carry a placedLayer whose id is a face? */
function subtreeHasFace(
  layer: any,
  faceLinkIds: Set<string>,
  facePaths: Set<string>,
  path: string
): boolean {
  const id = layer.placedLayer?.id;
  if ((id && faceLinkIds.has(id)) || facePaths.has(path)) return true;
  if (layer.children) {
    for (const child of layer.children) {
      const cp = `${path} > ${child.name || 'unnamed'}`;
      if (subtreeHasFace(child, faceLinkIds, facePaths, cp)) return true;
    }
  }
  return false;
}

/**
 * Flatten a list of top-level children into one canvas using the real
 * compositor. compose.ts is the single source of truth — zero re-implementation:
 * we hand composePsd a synthetic psd of the same document size.
 */
function flattenSubset(children: any[], width: number, height: number, cc: CreateCanvas): any {
  return composePsd({ width, height, children }, cc);
}

let _refCounter = 0;
function nextRef(prefix: string): string {
  return `${prefix}-${_refCounter++}`;
}

/**
 * Extract a SceneDoc + layer canvases from a read PSD tree.
 *
 * @param psd     ag-psd readPsd() result (the caller owns reading the file).
 * @param cc      canvas factory (node adapter server-side / browser elsewhere).
 * @param faceSos optional pre-scanned smart objects; derived from the tree if omitted.
 */
export function extractScene(psd: any, cc: CreateCanvas, faceSos?: FaceSo[]): ExtractResult {
  _refCounter = 0;
  const width = psd.width;
  const height = psd.height;
  const topChildren: any[] = psd.children || [];

  const allLayers = flattenLayers(topChildren);
  const smartObjects = allLayers.filter((l: any) => l.placedLayer);

  // Scan smart objects → faces (same filter as the worker).
  const scanned: FaceSo[] =
    faceSos ??
    smartObjects
      .filter((l: any) => !BRAND_HIDE.test(l.name || ''))
      .map((l: any) => ({
        name: l.name || 'unnamed',
        path: l.path,
        innerWidth: l.placedLayer.width || l.right - l.left,
        innerHeight: l.placedLayer.height || l.bottom - l.top,
        hidden: !!l.hidden,
        linkId: l.placedLayer.id || undefined,
      }));

  const faces = computeFaces(scanned);

  // Resolve each computed face to the actual SO layer (for quad/geometry) by path.
  const faceLinkIds = new Set<string>();
  const facePaths = new Set<string>();
  const warnings: string[] = [];
  const sceneFaces: SceneFace[] = [];
  const assets: AssetMap = {};

  for (const face of faces) {
    const so =
      allLayers.find((l: any) => l.path === face.smartObject) ||
      allLayers.find((l: any) => l.name === face.smartObject);
    if (!so) {
      warnings.push(`face "${face.name}" (${face.smartObject}) não encontrada na árvore`);
      continue;
    }
    if (so.placedLayer?.id) faceLinkIds.add(so.placedLayer.id);
    facePaths.add(so.path);

    const pl = so.placedLayer || {};
    const innerW = Math.max(1, Math.round(pl.width || so.right - so.left || face.innerWidth || 1));
    const innerH = Math.max(
      1,
      Math.round(pl.height || so.bottom - so.top || face.innerHeight || 1)
    );
    const rawQuad: number[] | null =
      (pl.nonAffineTransform?.length === 8 && pl.nonAffineTransform) ||
      (pl.transform?.length === 8 && pl.transform) ||
      null;

    const sceneFace: SceneFace = {
      key: face.key,
      name: face.name,
      quad: rawQuad ? ([...rawQuad] as Quad) : null,
      innerW,
      innerH,
    };
    if (!rawQuad) {
      sceneFace.origin = { left: Math.floor(so.left ?? 0), top: Math.floor(so.top ?? 0) };
    }

    // Capture the face's raster mask if it has one (warps with the art at render).
    const m = so.mask;
    if (m && !m.disabled && m.canvas && m.canvas.width > 0 && m.canvas.height > 0) {
      const ref = nextRef('mask');
      assets[ref] = m.canvas;
      sceneFace.maskRef = ref;
      // Mask geometry is preserved on the canvas itself (left/top encoded in render).
    }
    sceneFaces.push(sceneFace);
  }

  // ── Partition top-level children into base / over ──────────────────────────
  // Path of each top-level child mirrors flattenLayers' root naming.
  const topPaths = topChildren.map((c: any) => c.name || 'unnamed');
  const isFaceContainer = topChildren.map((c, i) =>
    subtreeHasFace(c, faceLinkIds, facePaths, topPaths[i])
  );
  const firstFaceIdx = isFaceContainer.indexOf(true);

  const visibleEligible = (c: any) =>
    !c.hidden && layerAlpha(c) > 0 && !BRAND_HIDE.test(c.name || '');

  const layers: SceneLayer[] = [];

  if (firstFaceIdx === -1) {
    // No face container found among top-level groups (faces nested deep or none).
    // Fallback: single base flatten of everything visible (documented limitation).
    warnings.push(
      'nenhum container de face no nível superior — base única (limitação documentada)'
    );
    const baseChildren = topChildren.filter(visibleEligible);
    if (baseChildren.length) {
      const ref = nextRef('base');
      assets[ref] = flattenSubset(baseChildren, width, height, cc);
      layers.push({
        role: 'base',
        src: ref,
        blendMode: 'source-over',
        opacity: 1,
        left: 0,
        top: 0,
      });
    }
  } else {
    // Base = everything below the first face container, flattened into one image.
    const baseChildren = topChildren.slice(0, firstFaceIdx).filter(visibleEligible);
    if (baseChildren.length) {
      const ref = nextRef('base');
      assets[ref] = flattenSubset(baseChildren, width, height, cc);
      layers.push({
        role: 'base',
        src: ref,
        blendMode: 'source-over',
        opacity: 1,
        left: 0,
        top: 0,
      });
    }

    // Over = each top-level child at/above firstFaceIdx that is NOT a face container,
    // composited individually so its blend mode / opacity is preserved.
    for (let i = firstFaceIdx; i < topChildren.length; i++) {
      const c = topChildren[i];
      if (isFaceContainer[i]) continue; // consumed by face geometry
      if (!visibleEligible(c)) continue;
      const rawBlend = c.blendMode ?? 'normal';
      const mapped = BLEND_MAP[rawBlend];
      if (mapped === undefined) {
        warnings.push(`blend mode não mapeado "${rawBlend}" na camada "${c.name || 'unnamed'}"`);
      }
      const ref = nextRef('over');
      // Flatten this single top-level child at full size (preserves its internal
      // composition); its own blend/opacity are applied at render time.
      assets[ref] = flattenSubset(
        [{ ...c, opacity: 1, fillOpacity: 1, blendMode: 'normal' }],
        width,
        height,
        cc
      );
      layers.push({
        role: 'over',
        src: ref,
        blendMode: mapped ?? 'source-over',
        opacity: layerAlpha(c),
        left: 0,
        top: 0,
      });
    }
  }

  const doc: SceneDoc = { version: 1, width, height, faces: sceneFaces, layers, warnings };
  return { doc, assets };
}
