// Compositor ag-psd → canvas. Single source of truth do engine de mockup.
// Regras que o Photoshop aplica e que precisamos replicar:
//   - psd.children[0] é a camada de BAIXO (ordem do arquivo PSD) → desenhar 0..n
//   - smart objects vinculados (mesmo placedLayer.id) compartilham o conteúdo:
//     trocar a arte em um troca em todos
//   - máscaras raster (layer.mask.canvas) multiplicam o alpha da camada
//   - camadas com clipping=true só pintam onde a camada-base abaixo tem pixels
//   - placedLayer.transform/nonAffineTransform são 8 números (quad de cantos)

import type { CreateCanvas, ReplacedLayer } from './types.js';
import { buildAdjustmentLut } from './adjustments.js';

export type { CreateCanvas, ReplacedLayer } from './types.js';

// ── Layer tree helpers ────────────────────────────────────────────────────────

export function flattenLayers(layers: any[], parentPath = ''): any[] {
  const result: any[] = [];
  for (const layer of layers) {
    const currentPath = parentPath ? `${parentPath} > ${layer.name || 'unnamed'}` : (layer.name || 'unnamed');
    // __original = referência ao objeto real em psd.children (não cópia)
    result.push({ ...layer, path: currentPath, __original: layer });
    if (layer.children) {
      result.push(...flattenLayers(layer.children, currentPath));
    }
  }
  return result;
}

// ── Smart object replacement ──────────────────────────────────────────────────

/** Desenha a arte (cover, sem distorção) num canvas do tamanho interno do SO. */
export function coverArtCanvas(artImg: any, innerW: number, innerH: number, cc: CreateCanvas) {
  const canvas = cc(innerW, innerH);
  const ctx = canvas.getContext('2d');
  const artRatio = artImg.width / artImg.height;
  const soRatio = innerW / innerH;
  let sx = 0, sy = 0, sw = artImg.width, sh = artImg.height;
  if (artRatio > soRatio) {
    sw = artImg.height * soRatio;
    sx = (artImg.width - sw) / 2;
  } else {
    sh = artImg.width / soRatio;
    sy = (artImg.height - sh) / 2;
  }
  ctx.drawImage(artImg, sx, sy, sw, sh, 0, 0, innerW, innerH);
  return canvas;
}

// ── Smart Filter: Displace ────────────────────────────────────────────────────

/**
 * Applies a Photoshop-equivalent Displace smart filter to a canvas.
 * Red channel → X shift, Green channel → Y shift.
 * Pixel value 128 = no displacement; 0 = −scale px; 255 = +scale px.
 * Pre-attach displacement data via layer.placedLayer.__displacementCanvases
 * before calling composePsd/replaceLinkedSmartObjects.
 */
export function applyDisplacementFilter(
  src: any,
  dispCanvas: any,
  hScale: number,
  vScale: number,
  mapMode: 'stretch to fit' | 'tile',
  edgeMode: 'wrap around' | 'repeat edge pixels',
  cc: CreateCanvas
): any {
  const W = src.width, H = src.height;
  const srcData: Uint8ClampedArray = src.getContext('2d').getImageData(0, 0, W, H).data;

  // Fit displacement map to source size
  const dW = dispCanvas.width, dH = dispCanvas.height;
  let dispData: Uint8ClampedArray;
  if (mapMode === 'stretch to fit' || (dW === W && dH === H)) {
    const fitted = cc(W, H);
    fitted.getContext('2d').drawImage(dispCanvas, 0, 0, W, H);
    dispData = (fitted.getContext('2d').getImageData(0, 0, W, H) as any).data;
  } else {
    const tiled = cc(W, H);
    const tc = tiled.getContext('2d') as any;
    for (let ty = 0; ty < H; ty += dH) {
      for (let tx = 0; tx < W; tx += dW) tc.drawImage(dispCanvas, tx, ty);
    }
    dispData = (tc.getImageData(0, 0, W, H) as any).data;
  }

  const out = cc(W, H);
  const outCtx = out.getContext('2d') as any;
  const outImg = outCtx.getImageData(0, 0, W, H);
  const outData: Uint8ClampedArray = outImg.data;

  const wrapX = edgeMode === 'wrap around'
    ? (v: number) => ((Math.floor(v) % W) + W) % W
    : (v: number) => Math.max(0, Math.min(W - 1, Math.floor(v)));
  const wrapY = edgeMode === 'wrap around'
    ? (v: number) => ((Math.floor(v) % H) + H) % H
    : (v: number) => Math.max(0, Math.min(H - 1, Math.floor(v)));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const di = (y * W + x) * 4;
      // R → X, G → Y; 128 = neutral
      const dx = (dispData[di] - 128) / 128 * hScale;
      const dy = (dispData[di + 1] - 128) / 128 * vScale;

      // Bilinear interpolation from source
      const sx = x + dx, sy = y + dy;
      const sx0 = Math.floor(sx), sy0 = Math.floor(sy);
      const fx = sx - sx0, fy = sy - sy0;

      const ax0 = wrapX(sx0), ay0 = wrapY(sy0);
      const ax1 = wrapX(sx0 + 1), ay1 = wrapY(sy0 + 1);
      const i00 = (ay0 * W + ax0) * 4, i10 = (ay0 * W + ax1) * 4;
      const i01 = (ay1 * W + ax0) * 4, i11 = (ay1 * W + ax1) * 4;

      for (let c = 0; c < 4; c++) {
        const v00 = srcData[i00 + c], v10 = srcData[i10 + c];
        const v01 = srcData[i01 + c], v11 = srcData[i11 + c];
        outData[di + c] = Math.round(
          v00 + (v10 - v00) * fx + (v01 - v00) * fy + (v11 - v10 - v01 + v00) * fx * fy
        );
      }
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return out;
}

/** Aplica a arte em UMA camada SO usando o quad de cantos do placedLayer. */
function replaceOne(orig: any, artImg: any, cc: CreateCanvas): ReplacedLayer {
  const pl = orig.placedLayer || {};
  const innerW = Math.max(1, Math.round(pl.width || (orig.right - orig.left) || 1));
  const innerH = Math.max(1, Math.round(pl.height || (orig.bottom - orig.top) || 1));
  let artCanvas = coverArtCanvas(artImg, innerW, innerH, cc);

  // Smart Filters: apply pre-loaded Displace filters (attach via pl.__displacementCanvases)
  const dispFilters: any[] = pl.__displacementCanvases || [];
  for (const df of dispFilters) {
    artCanvas = applyDisplacementFilter(
      artCanvas, df.canvas, df.hScale, df.vScale, df.mapMode, df.edgeMode, cc
    );
  }

  // transform e nonAffineTransform são quads [x1,y1,x2,y2,x3,y3,x4,y4]
  // (TL, TR, BR, BL em coords do documento). nonAffine inclui perspectiva real;
  // transform sem nonAffine = afim puro (rotação/escala/skew, sem distorção).
  const hasPerspective = pl.nonAffineTransform?.length === 8;
  const quad: number[] | null =
    (hasPerspective && pl.nonAffineTransform) ||
    (pl.transform?.length === 8 && pl.transform) ||
    null;

  let warped = false;
  if (quad) {
    const corners = [
      { x: quad[0], y: quad[1] },
      { x: quad[2], y: quad[3] },
      { x: quad[4], y: quad[5] },
      { x: quad[6], y: quad[7] },
    ];
    const minX = Math.min(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxX = Math.max(...corners.map((c) => c.x));
    const maxY = Math.max(...corners.map((c) => c.y));
    const outW = Math.ceil(maxX - minX);
    const outH = Math.ceil(maxY - minY);
    if (outW > 0 && outH > 0) {
      const warpCanvas = cc(outW, outH);
      const local = corners.map((c) => ({ x: c.x - minX, y: c.y - minY }));
      if (hasPerspective) {
        // Perspectiva real → subdivisão em triângulos (evita distorção afim).
        perspectiveWarp(warpCanvas.getContext('2d'), artCanvas, innerW, innerH, local);
      } else {
        // Afim puro (sem nonAffineTransform) → matrix 2D direta, sem grid de triângulos.
        // Usar perspectiveWarp aqui cria artefatos de crosshatch nas bordas dos triângulos.
        const [tl, tr, , bl] = local;
        const a = (tr.x - tl.x) / innerW, b = (tr.y - tl.y) / innerW;
        const c = (bl.x - tl.x) / innerH, d = (bl.y - tl.y) / innerH;
        const ctx2 = warpCanvas.getContext('2d') as any;
        ctx2.transform(a, b, c, d, tl.x, tl.y);
        ctx2.drawImage(artCanvas, 0, 0);
      }
      orig.canvas = warpCanvas;
      orig.left = Math.floor(minX);
      orig.top = Math.floor(minY);
      orig.right = orig.left + outW;
      orig.bottom = orig.top + outH;
      warped = true;
    }
  }
  if (!warped) {
    orig.canvas = artCanvas;
    orig.right = (orig.left || 0) + innerW;
    orig.bottom = (orig.top || 0) + innerH;
  }

  orig.imageData = undefined;
  orig.placedLayer = undefined;
  // mask fica intacta — o Photoshop também mantém a máscara ao trocar conteúdo

  return { name: orig.name, width: innerW, height: innerH, warped };
}

/**
 * Troca a arte no SO alvo e em TODOS os SOs vinculados (mesmo placedLayer.id).
 * Mantém o hidden de cada camada; só desoculta o alvo se nenhuma camada
 * vinculada estiver visível (senão o placeholder visível continua na frente).
 */
export function replaceLinkedSmartObjects(
  allLayers: any[],
  target: any,
  artImg: any,
  cc: CreateCanvas
): ReplacedLayer[] {
  const targetId = target.placedLayer?.id;
  const linked = targetId
    ? allLayers.filter((l: any) => l.placedLayer?.id === targetId)
    : [target];

  const anyVisible = linked.some((l: any) => !isEffectivelyHidden(l, allLayers));
  const replaced: ReplacedLayer[] = [];
  for (const layer of linked) {
    replaced.push(replaceOne(layer.__original ?? layer, artImg, cc));
  }
  if (!anyVisible) {
    (target.__original ?? target).hidden = false;
  }
  return replaced;
}

/** hidden direto ou dentro de grupo hidden (checa pelos paths). */
function isEffectivelyHidden(layer: any, allLayers: any[]): boolean {
  if (layer.hidden) return true;
  const path: string = layer.path || '';
  // ancestrais = entradas cujo path é prefixo do path da camada
  return allLayers.some(
    (g: any) => g.children && g.hidden && path.startsWith(g.path + ' > ')
  );
}

// ── Perspective warp ──────────────────────────────────────────────────────────

// Subdivide o retângulo fonte em grade, interpola bilinearmente os quads de
// destino a partir dos 4 cantos e desenha cada célula com UMA aproximação afim
// (TL-corner → dest quad TL, TR, BL). Para gridSize≥16 o erro no canto BR é
// sub-pixel — sem seams diagonais visíveis.
// E = 0.5 source-px expande o rect de clip em todas as direções para selar
// lacunas de anti-aliasing entre células adjacentes.
export function perspectiveWarp(
  ctx: any, src: any,
  srcW: number, srcH: number,
  corners: Array<{ x: number; y: number }>, // TL, TR, BR, BL no espaço destino
  gridSize = 32
) {
  const [tl, tr, br, bl] = corners;
  const E = 0.5; // clip expansion in source px to seal inter-cell gaps

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const u0 = gx / gridSize, u1 = (gx + 1) / gridSize;
      const v0 = gy / gridSize, v1 = (gy + 1) / gridSize;

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const bilerp = (u: number, v: number) => ({
        x: lerp(lerp(tl.x, tr.x, u), lerp(bl.x, br.x, u), v),
        y: lerp(lerp(tl.y, tr.y, u), lerp(bl.y, br.y, u), v),
      });

      const p00 = bilerp(u0, v0); // TL corner of cell in dest
      const p10 = bilerp(u1, v0); // TR corner
      const p01 = bilerp(u0, v1); // BL corner

      const sx = u0 * srcW, sy = v0 * srcH;
      const sw = (u1 - u0) * srcW, sh = (v1 - v0) * srcH;

      // TL-affine: maps (sx,sy)→p00, (sx+sw,sy)→p10, (sx,sy+sh)→p01.
      // One quad cell = one save/clip/drawImage/restore — no diagonal seams.
      const dxu = p10.x - p00.x, dyu = p10.y - p00.y;
      const dxv = p01.x - p00.x, dyv = p01.y - p00.y;

      ctx.save();
      ctx.transform(
        dxu / sw, dyu / sw,
        dxv / sh, dyv / sh,
        p00.x - sx * dxu / sw - sy * dxv / sh,
        p00.y - sx * dyu / sw - sy * dyv / sh,
      );
      ctx.beginPath();
      ctx.rect(sx - E, sy - E, sw + 2 * E, sh + 2 * E);
      ctx.clip();
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    }
  }
}

// ── Compositing ───────────────────────────────────────────────────────────────

// Blend modes do PSD (strings do ag-psd) → globalCompositeOperation do Canvas 2D
export const BLEND_MAP: Record<string, string> = {
  'normal': 'source-over',
  'dissolve': 'source-over',
  'darken': 'darken',
  'multiply': 'multiply',
  'color burn': 'color-burn',
  'linear burn': 'color-burn',  // CSS fallback; pixel-level used in compositor
  'darker color': 'darken',
  'lighten': 'lighten',
  'screen': 'screen',
  'color dodge': 'color-dodge',
  'linear dodge': 'lighter',
  'lighter color': 'lighten',
  'overlay': 'overlay',
  'soft light': 'soft-light',
  'hard light': 'hard-light',
  'vivid light': 'hard-light',  // CSS fallback; pixel-level used in compositor
  'linear light': 'hard-light', // CSS fallback; pixel-level used in compositor
  'pin light': 'hard-light',    // CSS fallback; pixel-level used in compositor
  'hard mix': 'hard-light',     // CSS fallback; pixel-level used in compositor
  'difference': 'difference',
  'exclusion': 'exclusion',
  'subtract': 'difference',     // CSS fallback; pixel-level used in compositor
  'divide': 'source-over',      // CSS fallback; pixel-level used in compositor
  'hue': 'hue',
  'saturation': 'saturation',
  'color': 'color',
  'luminosity': 'luminosity',
};

// PS blend modes that Canvas 2D doesn't support accurately — compositor uses
// getImageData/putImageData pixel-level blending for these instead.
const PIXEL_BLEND_SET = new Set([
  'divide', 'subtract', 'linear burn', 'linear light',
  'vivid light', 'pin light', 'hard mix',
]);

function blendCh(mode: string, b: number, s: number): number {
  switch (mode) {
    case 'divide':      return s === 0 ? 1 : Math.min(1, b / s);
    case 'subtract':    return Math.max(0, b - s);
    case 'linear burn': return Math.max(0, b + s - 1);
    case 'linear light': return Math.max(0, Math.min(1, b + 2 * s - 1));
    case 'vivid light': {
      if (s <= 0.5) return s === 0 ? 0 : Math.max(0, 1 - (1 - b) / (2 * s));
      return s === 1 ? 1 : Math.min(1, b / (2 * (1 - s)));
    }
    case 'pin light':
      return s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1);
    case 'hard mix': {
      const vl = s <= 0.5 ? (s === 0 ? 0 : Math.max(0, 1 - (1 - b) / (2 * s)))
                           : (s === 1 ? 1 : Math.min(1, b / (2 * (1 - s))));
      return vl >= 0.5 ? 1 : 0;
    }
    default: return b;
  }
}

/**
 * Blends srcCanvas over dstCtx in-place using a pixel-level formula.
 * Implements Porter-Duff "source-over" compositing with a custom blend function.
 * Called only for modes in PIXEL_BLEND_SET.
 */
function pixelBlendMode(dstCtx: any, srcCanvas: any, mode: string, W: number, H: number): void {
  const dstImg = dstCtx.getImageData(0, 0, W, H);
  const srcImg = (srcCanvas.getContext('2d') as any).getImageData(0, 0, W, H);
  const d = dstImg.data;
  const s = srcImg.data;

  for (let i = 0, len = W * H; i < len; i++) {
    const p = i * 4;
    const sa = s[p + 3] / 255;
    if (sa === 0) continue;

    const da = d[p + 3] / 255;
    const ao = sa + (1 - sa) * da;
    if (ao === 0) continue;

    // Porter-Duff with blend function:
    // Co = (αs×αb×B(Cb,Cs) + αs×(1-αb)×Cs + (1-αs)×αb×Cb) / αo
    for (let c = 0; c < 3; c++) {
      const cb = d[p + c] / 255;
      const cs = s[p + c] / 255;
      d[p + c] = Math.round(
        ((sa * da * blendCh(mode, cb, cs) + sa * (1 - da) * cs + (1 - sa) * da * cb) / ao) * 255
      );
    }
    d[p + 3] = Math.round(ao * 255);
  }

  dstCtx.putImageData(dstImg, 0, 0);
}

/** Composita a árvore inteira num canvas do tamanho do documento. */
export function composePsd(psd: any, cc: CreateCanvas) {
  const canvas = cc(psd.width, psd.height);
  drawChildren(canvas.getContext('2d'), psd.children || [], psd.width, psd.height, cc);
  return canvas;
}

function drawChildren(ctx: any, layers: any[], W: number, H: number, cc: CreateCanvas) {
  // layers[0] = fundo. Camadas com clipping=true pertencem à base não-clipada
  // imediatamente abaixo (anterior no array).
  let i = 0;
  while (i < layers.length) {
    const layer = layers[i];
    if (layer.hidden || layer.clipping) { i++; continue; }
    const clipped: any[] = [];
    let j = i + 1;
    while (j < layers.length && layers[j].clipping) {
      if (!layers[j].hidden) clipped.push(layers[j]);
      j++;
    }
    drawOne(ctx, layer, clipped, W, H, cc);
    i = j;
  }
}

function layerAlpha(layer: any): number {
  const op = layer.opacity ?? 1;
  const fill = layer.fillOpacity ?? 1;
  return Math.max(0, Math.min(1, op * fill));
}

/** Conteúdo da camada (grupo renderizado ou canvas próprio) em canvas full-size, com máscara aplicada. */
function contentCanvas(layer: any, W: number, H: number, cc: CreateCanvas) {
  const tmp = cc(W, H);
  const tctx = tmp.getContext('2d');
  if (layer.children) {
    drawChildren(tctx, layer.children, W, H, cc);
  } else if (layer.canvas && layer.canvas.width > 0 && layer.canvas.height > 0) {
    tctx.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
  } else {
    return null;
  }
  applyRasterMask(tmp, layer, W, H);
  return tmp;
}

function drawOne(ctx: any, layer: any, clipped: any[], W: number, H: number, cc: CreateCanvas) {
  const alpha = layerAlpha(layer);
  if (alpha <= 0) return;

  // Adjustment layer (Levels/Curves/Brightness): sem pixels próprios — aplica um
  // LUT nos pixels já compostos ABAIXO (no container atual). Sem isto o contraste
  // do PS some e o render fica "chapado/cinza".
  if (layer.adjustment && !layer.canvas) {
    applyAdjustment(ctx, layer, alpha, W, H);
    return;
  }

  const blend = BLEND_MAP[layer.blendMode ?? 'normal'] ?? 'source-over';

  // Atalho: grupo passthrough sem máscara/clip/opacity renderiza direto no pai
  const passthrough = !layer.blendMode || layer.blendMode === 'pass through';
  if (layer.children && passthrough && alpha >= 1 && clipped.length === 0 && !hasUsableMask(layer)) {
    drawChildren(ctx, layer.children, W, H, cc);
    return;
  }

  const content = contentCanvas(layer, W, H, cc);
  if (!content) return;

  if (clipped.length > 0) {
    // Camadas clipadas pintam sobre o conteúdo da base e o resultado é
    // recortado pelo alpha original da base.
    const baseAlpha = cc(W, H);
    baseAlpha.getContext('2d').drawImage(content, 0, 0);

    const cctx = content.getContext('2d');
    for (const cl of clipped) {
      const clContent = contentCanvas(cl, W, H, cc);
      if (!clContent) continue;
      const clAlpha = layerAlpha(cl);
      const clPsMode = cl.blendMode ?? 'normal';
      const clBlend = BLEND_MAP[clPsMode] ?? 'source-over';

      if (PIXEL_BLEND_SET.has(clPsMode)) {
        // Pixel-level: blend em cópia, depois source-over a alpha
        if (clAlpha < 1) {
          const tmp = cc(W, H);
          const tctx = tmp.getContext('2d') as any;
          tctx.drawImage(content, 0, 0);
          pixelBlendMode(tctx, clContent, clPsMode, W, H);
          cctx.save();
          (cctx as any).globalAlpha = clAlpha;
          (cctx as any).drawImage(tmp, 0, 0);
          cctx.restore();
        } else {
          pixelBlendMode(cctx, clContent, clPsMode, W, H);
        }
      } else if (clAlpha < 1 && clBlend !== 'source-over') {
        // Photoshop aplica opacity DEPOIS do blend (mix entre base e blend_result).
        // Canvas 2D aplica globalAlpha ANTES (altera a entrada do blend mode), o que
        // causa grain/shadow/light mais fortes do que o esperado. Fix: dois passos.
        const tmp = cc(W, H);
        const tctx = tmp.getContext('2d') as any;
        tctx.drawImage(content, 0, 0);       // base atual (conteúdo acumulado)
        tctx.globalCompositeOperation = clBlend;
        tctx.drawImage(clContent, 0, 0);     // blend em opacidade plena
        cctx.save();
        (cctx as any).globalAlpha = clAlpha;  // source-over padrão → mix correto
        (cctx as any).drawImage(tmp, 0, 0);
        cctx.restore();
      } else {
        cctx.save();
        (cctx as any).globalAlpha = clAlpha;
        (cctx as any).globalCompositeOperation = clBlend;
        (cctx as any).drawImage(clContent, 0, 0);
        cctx.restore();
      }
    }
    cctx.save();
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(baseAlpha, 0, 0);
    cctx.restore();
  }

  const effectiveBlend = passthrough && layer.children ? 'source-over' : blend;
  const psMode = passthrough && layer.children ? 'normal' : (layer.blendMode ?? 'normal');

  if (PIXEL_BLEND_SET.has(psMode)) {
    // Pixel-level blend mode: getImageData path
    if (alpha < 1) {
      const tmp = cc(W, H);
      const tctx = tmp.getContext('2d') as any;
      tctx.drawImage(ctx.canvas, 0, 0);
      pixelBlendMode(tctx, content, psMode, W, H);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    } else {
      pixelBlendMode(ctx, content, psMode, W, H);
    }
  } else if (alpha < 1 && effectiveBlend !== 'source-over') {
    // Mesmo fix de opacity: Photoshop aplica opacity após o blend, Canvas aplica antes.
    // Para source-over a equação é idêntica, mas para multiply/soft-light/etc. não.
    const tmp = cc(W, H);
    const tctx = tmp.getContext('2d') as any;
    tctx.drawImage(ctx.canvas, 0, 0);      // copia base atual
    tctx.globalCompositeOperation = effectiveBlend;
    tctx.drawImage(content, 0, 0);         // blend em opacidade plena
    ctx.save();
    ctx.globalAlpha = alpha;               // source-over → mix(base, blend_result, alpha)
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = effectiveBlend;
    ctx.drawImage(content, 0, 0);
    ctx.restore();
  }
}

/** Alpha (0..255) da máscara raster por pixel, full-size; default = defaultColor. */
function readMaskAlpha(layer: any, W: number, H: number): Uint8Array {
  const out = new Uint8Array(W * H);
  const mask = layer.mask;
  out.fill(mask.defaultColor ?? 255);
  const mc = mask.canvas;
  const mdata = mc.getContext('2d').getImageData(0, 0, mc.width, mc.height).data;
  const ml = Math.floor(mask.left ?? 0);
  const mt = Math.floor(mask.top ?? 0);
  const mw = mc.width;
  const mh = mc.height;
  for (let y = 0; y < H; y++) {
    const my = y - mt;
    if (my < 0 || my >= mh) continue;
    for (let x = 0; x < W; x++) {
      const mx = x - ml;
      if (mx < 0 || mx >= mw) continue;
      out[y * W + x] = mdata[(my * mw + mx) * 4];
    }
  }
  return out;
}

/**
 * Aplica um adjustment layer (LUT) sobre os pixels já compostos em `ctx`,
 * respeitando opacity da camada e máscara raster (se houver).
 */
function applyAdjustment(ctx: any, layer: any, alpha: number, W: number, H: number) {
  const lut = buildAdjustmentLut(layer.adjustment);
  if (!lut) return; // tipo não suportado → no-op (como antes)

  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const maskA = hasUsableMask(layer) ? readMaskAlpha(layer, W, H) : null;

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] === 0) continue; // pixel transparente → nada abaixo pra ajustar
    let a = alpha;
    if (maskA) a *= maskA[p] / 255;
    if (a <= 0) continue;
    const nr = lut.r[d[i]];
    const ng = lut.g[d[i + 1]];
    const nb = lut.b[d[i + 2]];
    if (a >= 1) {
      d[i] = nr;
      d[i + 1] = ng;
      d[i + 2] = nb;
    } else {
      d[i] += (nr - d[i]) * a;
      d[i + 1] += (ng - d[i + 1]) * a;
      d[i + 2] += (nb - d[i + 2]) * a;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function hasUsableMask(layer: any): boolean {
  const m = layer.mask;
  if (!m || m.disabled || !m.canvas) return false;
  return m.canvas.width > 0 && m.canvas.height > 0;
}

/**
 * Multiplica o alpha do canvas pela luminância da máscara raster.
 * Fora dos bounds da máscara vale defaultColor (0 = esconde, 255 = mostra).
 */
function applyRasterMask(canvas: any, layer: any, W: number, H: number) {
  if (!hasUsableMask(layer)) return;
  const mask = layer.mask;

  // Restringe o loop à região onde a camada tem pixels
  const left = Math.max(0, Math.floor(layer.left ?? 0));
  const top = Math.max(0, Math.floor(layer.top ?? 0));
  const right = Math.min(W, Math.ceil(layer.right ?? W));
  const bottom = Math.min(H, Math.ceil(layer.bottom ?? H));
  const rw = right - left, rh = bottom - top;
  if (rw <= 0 || rh <= 0) return;

  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(left, top, rw, rh);
  const d = img.data;

  const mc = mask.canvas;
  const mdata = mc.getContext('2d').getImageData(0, 0, mc.width, mc.height).data;
  const ml = Math.floor(mask.left ?? 0), mt = Math.floor(mask.top ?? 0);
  const mw = mc.width, mh = mc.height;
  const def = (mask.defaultColor ?? 255) / 255;

  for (let y = 0; y < rh; y++) {
    const docY = top + y;
    const my = docY - mt;
    const rowIn = my >= 0 && my < mh;
    for (let x = 0; x < rw; x++) {
      const i = (y * rw + x) * 4;
      const a = d[i + 3];
      if (a === 0) continue;
      const mx = left + x - ml;
      let m = def;
      if (rowIn && mx >= 0 && mx < mw) m = mdata[(my * mw + mx) * 4] / 255;
      if (m < 1) d[i + 3] = (a * m) | 0;
    }
  }
  ctx.putImageData(img, left, top);
}
