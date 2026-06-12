// Scene rendering — SceneDoc + loaded assets + per-face art → final canvas.
//
// This is the isomorphic hot path: draw base → for each face cover+warp the art
// into its quad → draw overs with their blend mode / opacity. It reuses the
// EXACT same primitives as the full PSD compositor (coverArtCanvas +
// perspectiveWarp + BLEND_MAP) — zero re-implementation of the warp math.

import { coverArtCanvas, perspectiveWarp } from '../compose.js';
import type { CreateCanvas } from '../types.js';
import type { SceneDoc, AssetMap } from './types.js';

/** Art image (or canvas) to place into a face, keyed by SceneFace.key. */
export type ArtMap = Record<string, any>;

export interface RenderSceneOptions {
  /** Fallback art applied to faces missing an explicit entry in `arts`. */
  defaultArt?: any;
}

/**
 * Render a mockup from a Scene Package.
 *
 * @param doc    the SceneDoc geometry.
 * @param assets ref → loaded image/canvas (base/over layer images, masks).
 * @param arts   face.key → art image/canvas.
 * @param cc     canvas factory (browser or node adapter).
 */
export function renderScene(
  doc: SceneDoc,
  assets: AssetMap,
  arts: ArtMap,
  cc: CreateCanvas,
  opts: RenderSceneOptions = {}
): any {
  const canvas = cc(doc.width, doc.height);
  const ctx = canvas.getContext('2d');

  // 1. Base layers (role === 'base'), in document order.
  for (const layer of doc.layers) {
    if (layer.role !== 'base') continue;
    drawLayer(ctx, assets[layer.src], layer.blendMode, layer.opacity, layer.left, layer.top);
  }

  // 2. Faces — cover the art, then warp into the quad (or place axis-aligned).
  for (const face of doc.faces) {
    const art = arts[face.key] ?? opts.defaultArt;
    if (!art) continue;
    const artCanvas = coverArtCanvas(art, face.innerW, face.innerH, cc);

    let faceCanvas: any;
    let dx: number;
    let dy: number;

    if (face.quad) {
      const q = face.quad;
      const corners = [
        { x: q[0], y: q[1] },
        { x: q[2], y: q[3] },
        { x: q[4], y: q[5] },
        { x: q[6], y: q[7] },
      ];
      const minX = Math.min(...corners.map((c) => c.x));
      const minY = Math.min(...corners.map((c) => c.y));
      const maxX = Math.max(...corners.map((c) => c.x));
      const maxY = Math.max(...corners.map((c) => c.y));
      const outW = Math.max(1, Math.ceil(maxX - minX));
      const outH = Math.max(1, Math.ceil(maxY - minY));
      const warpCanvas = cc(outW, outH);
      const local = corners.map((c) => ({ x: c.x - minX, y: c.y - minY }));
      perspectiveWarp(warpCanvas.getContext('2d'), artCanvas, face.innerW, face.innerH, local);
      faceCanvas = warpCanvas;
      dx = Math.floor(minX);
      dy = Math.floor(minY);
    } else {
      faceCanvas = artCanvas;
      dx = face.origin?.left ?? 0;
      dy = face.origin?.top ?? 0;
    }

    // Apply the face's raster mask if present (multiplies alpha).
    if (face.maskRef && assets[face.maskRef]) {
      applyMaskToFace(faceCanvas, assets[face.maskRef], cc);
    }

    ctx.drawImage(faceCanvas, dx, dy);
  }

  // 3. Over layers (lights / shadows), with their blend mode + opacity.
  for (const layer of doc.layers) {
    if (layer.role !== 'over') continue;
    drawLayer(ctx, assets[layer.src], layer.blendMode, layer.opacity, layer.left, layer.top);
  }

  return canvas;
}

function drawLayer(
  ctx: any,
  img: any,
  blendMode: string,
  opacity: number,
  left: number,
  top: number
) {
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.globalCompositeOperation = blendMode || 'source-over';
  ctx.drawImage(img, left, top);
  ctx.restore();
}

/**
 * Multiply a face canvas alpha by a mask canvas (assumed same-size overlay at
 * the face origin). Simple destination-in composite of the mask luminance.
 */
function applyMaskToFace(faceCanvas: any, maskCanvas: any, cc: CreateCanvas) {
  const w = faceCanvas.width;
  const h = faceCanvas.height;
  if (w <= 0 || h <= 0) return;
  // Render the mask onto a same-size buffer, then destination-in.
  const buf = cc(w, h);
  const bctx = buf.getContext('2d');
  bctx.drawImage(maskCanvas, 0, 0, w, h);
  const fctx = faceCanvas.getContext('2d');
  fctx.save();
  fctx.globalCompositeOperation = 'destination-in';
  fctx.drawImage(buf, 0, 0);
  fctx.restore();
}
