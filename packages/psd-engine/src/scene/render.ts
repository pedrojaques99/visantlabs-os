// Scene rendering — SceneDoc + loaded assets + per-face art → final canvas.
//
// This is the isomorphic hot path: draw base → for each face cover+warp the art
// into its quad → draw overs with their blend mode / opacity. It reuses the
// EXACT same primitives as the full PSD compositor (coverArtCanvas +
// perspectiveWarp + BLEND_MAP) — zero re-implementation of the warp math.

import { coverArtCanvas, perspectiveWarp, quadMapper } from '../warp.js';
import { evaluateMesh, meshWarp } from '../mesh-warp.js';
import { applyDisplacementFilter, PIXEL_BLEND_SET, pixelBlendMode } from '../compose.js';
import type { CreateCanvas } from '../types.js';
import type { SceneDoc, SceneFaceInstance, AssetMap } from './types.js';

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

  let silhueta: any = null;

  // 2. Faces — uma passada por INSTÂNCIA (smart object vinculado), porque cada
  // uma tem quad, máscara, blend e opacidade próprios. Documento antigo (e o
  // pipeline de foto) não tem `instances`: os campos soltos da face descrevem
  // exatamente uma, e é isso que o fallback monta.
  for (const face of doc.faces) {
    const art = arts[face.key] ?? opts.defaultArt;
    if (!art) continue;

    const instancias: SceneFaceInstance[] = face.instances?.length
      ? face.instances
      : [
          {
            quad: face.quad,
            origin: face.origin,
            innerW: face.innerW,
            innerH: face.innerH,
            maskRef: face.maskRef,
            blendMode: 'source-over',
            opacity: 1,
            dispRef: face.dispRef,
            dispScale: face.dispScale,
          },
        ];

    for (const inst of instancias) {
      let artCanvas = coverArtCanvas(art, inst.innerW, inst.innerH, cc);

      // Displace no espaço INTERNO — antes do warp, que é a ordem do
      // `composePsd`. Depois do warp o mesmo mapa dá outra imagem: o
      // deslocamento sai na escala do bbox e não acompanha a perspectiva.
      if (inst.dispSpace === 'inner' && inst.dispRef && assets[inst.dispRef]) {
        artCanvas = applyDisplacementFilter(
          artCanvas,
          assets[inst.dispRef],
          inst.dispScale ?? 8,
          inst.dispVScale ?? inst.dispScale ?? 8,
          inst.dispMapMode ?? 'stretch to fit',
          inst.dispEdgeMode ?? 'repeat edge pixels',
          cc
        );
      }

      let faceCanvas: any;
      let dx: number;
      let dy: number;

      if (inst.quad) {
        const q = inst.quad;
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
        const local = corners.map((c) => ({ x: c.x - minX, y: c.y - minY }));

        if (inst.mesh) {
          // Com malha, a caixa é medida na MALHA projetada: o vinco levanta do
          // papel e passa da borda do quad, e recortar ali comeria justamente o
          // que a malha existe para mostrar. Mesma conta do `composePsd`.
          const paraQuad = quadMapper(corners);
          const projetar = (u: number, v: number) => {
            const m = evaluateMesh(inst.mesh!, u, v);
            return paraQuad(m.x / inst.mesh!.width, m.y / inst.mesh!.height);
          };
          let miX = Infinity;
          let miY = Infinity;
          let maX = -Infinity;
          let maY = -Infinity;
          const N = 32;
          for (let j = 0; j <= N; j++) {
            for (let i = 0; i <= N; i++) {
              const p = projetar(i / N, j / N);
              if (p.x < miX) miX = p.x;
              if (p.y < miY) miY = p.y;
              if (p.x > maX) maX = p.x;
              if (p.y > maY) maY = p.y;
            }
          }
          const mW = Math.max(1, Math.ceil(maX - miX));
          const mH = Math.max(1, Math.ceil(maY - miY));
          const meshCanvas = cc(mW, mH);
          meshWarp(
            meshCanvas.getContext('2d'),
            artCanvas,
            inst.innerW,
            inst.innerH,
            inst.mesh,
            (nx, ny) => {
              const p = paraQuad(nx, ny);
              return { x: p.x - miX, y: p.y - miY };
            }
          );
          faceCanvas = meshCanvas;
          dx = Math.floor(miX);
          dy = Math.floor(miY);
        } else {
          const warpCanvas = cc(outW, outH);
          perspectiveWarp(warpCanvas.getContext('2d'), artCanvas, inst.innerW, inst.innerH, local);
          faceCanvas = warpCanvas;
          dx = Math.floor(minX);
          dy = Math.floor(minY);
        }
      } else {
        faceCanvas = artCanvas;
        dx = inst.origin?.left ?? 0;
        dy = inst.origin?.top ?? 0;
      }

      // Displacement map no espaço da FACE (depois do warp) — o caminho que o
      // pipeline de foto monta à mão. Quem já aplicou no espaço interno não
      // repete aqui.
      const dispRef = inst.dispSpace === 'inner' ? undefined : (inst.dispRef ?? face.dispRef);
      if (dispRef && assets[dispRef]) {
        const scale = inst.dispScale ?? face.dispScale ?? 8;
        faceCanvas = applyDisplacementFilter(
          faceCanvas,
          assets[dispRef],
          scale,
          scale,
          'stretch to fit',
          'repeat edge pixels',
          cc
        );
      }

      // Máscara. `maskSpace: 'doc'` significa que ela já está no espaço do
      // documento — aí o recorte é a JANELA dela em (dx,dy), não a imagem
      // inteira esticada. Esticar uma máscara de documento dentro do quad
      // deforma o recorte e ninguém vê pelo resultado, só pela borda errada.
      if (inst.maskRef && assets[inst.maskRef]) {
        aplicarMascara(
          faceCanvas,
          assets[inst.maskRef],
          cc,
          face.maskSpace === 'doc' ? dx : 0,
          face.maskSpace === 'doc' ? dy : 0,
          face.maskSpace === 'doc'
        );
      }

      desenharFace(ctx, faceCanvas, inst, dx, dy, doc, cc);

      // Silhueta acumulada das faces — é contra ela que a camada de recorte
      // (`clipToFaces`) vai ser mascarada mais abaixo.
      if (!silhueta) silhueta = cc(doc.width, doc.height);
      silhueta.getContext('2d').drawImage(faceCanvas, dx, dy);
    }
  }

  // 3. Camadas acima das faces, EM ORDEM DE DOCUMENTO.
  //
  // `over` e `adjust` são processados no mesmo laço de propósito: um adjustment
  // age sobre tudo que já foi desenhado abaixo dele, então separar por papel
  // (todos os overs, depois todos os ajustes) trocaria a ordem do Photoshop e
  // daria outra imagem.
  for (const layer of doc.layers) {
    if (layer.role === 'over') {
      // `maskRef` num `over` é o recorte (clipping) do Photoshop: a camada só
      // pinta onde a base tem alpha. Sem isto, a sombra do produto vaza pro
      // cenário inteiro — e com a extração antiga ela simplesmente não existia.
      let img = assets[layer.src];
      const recorte = layer.clipToFaces ? silhueta : assets[layer.maskRef ?? ''];
      if (recorte && img) {
        const recortada = cc(img.width, img.height);
        recortada.getContext('2d').drawImage(img, 0, 0);
        applyMaskToFace(recortada, recorte, cc);
        img = recortada;
      }
      if (layer.psBlend && PIXEL_BLEND_SET.has(layer.psBlend) && img) {
        // Modo sem equivalente no Canvas: resolve no pixel, com a MESMA função
        // do compositor. A opacidade entra antes, porque o `pixelBlendMode`
        // trabalha sobre o alpha do source.
        const fonte = cc(doc.width, doc.height);
        const fctx = fonte.getContext('2d');
        fctx.globalAlpha = layer.opacity;
        fctx.drawImage(img, layer.left, layer.top);
        pixelBlendMode(ctx, fonte, layer.psBlend, doc.width, doc.height);
      } else {
        drawLayer(ctx, img, layer.blendMode, layer.opacity, layer.left, layer.top);
      }
    } else if (layer.role === 'adjust' && layer.lut) {
      aplicarLut(
        ctx,
        layer.lut,
        layer.opacity,
        doc.width,
        doc.height,
        layer.maskRef ? assets[layer.maskRef] : null,
        cc
      );
    }
  }

  return canvas;
}

/**
 * Aplica um LUT de adjustment sobre os pixels já compostos — o mesmo que
 * `applyAdjustment` faz em compose.ts, aqui sobre o canvas da cena.
 *
 * Sem isto o Scene Package saía lavado em relação ao PSD: o contraste do
 * Photoshop mora nos adjustment layers, e o Canvas 2D não tem equivalente.
 */
function aplicarLut(
  ctx: any,
  lut: { r: number[]; g: number[]; b: number[] },
  opacity: number,
  W: number,
  H: number,
  mask: any,
  cc: CreateCanvas
) {
  const alpha = Math.max(0, Math.min(1, opacity));
  if (alpha <= 0) return;

  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;

  // Máscara opcional: luminância vira peso por pixel.
  let maskA: Uint8ClampedArray | null = null;
  if (mask) {
    const mc = cc(W, H);
    const mctx = mc.getContext('2d');
    mctx.drawImage(mask, 0, 0);
    maskA = mctx.getImageData(0, 0, W, H).data;
  }

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] === 0) continue; // transparente: nada abaixo pra ajustar
    let a = alpha;
    if (maskA) a *= maskA[i] / 255; // luminância do canal R da máscara
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
/**
 * Desenha a instância da face com o blend e a opacidade DELA. Antes era
 * `drawImage` puro: a face do `paper-ghetto` é `multiply` e saía normal.
 */
function desenharFace(
  ctx: any,
  faceCanvas: any,
  inst: SceneFaceInstance,
  dx: number,
  dy: number,
  doc: SceneDoc,
  cc: CreateCanvas
) {
  if (inst.psBlend && PIXEL_BLEND_SET.has(inst.psBlend)) {
    const fonte = cc(doc.width, doc.height);
    const fctx = fonte.getContext('2d');
    fctx.globalAlpha = inst.opacity;
    fctx.drawImage(faceCanvas, dx, dy);
    pixelBlendMode(ctx, fonte, inst.psBlend, doc.width, doc.height);
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = inst.blendMode || 'source-over';
  ctx.globalAlpha = inst.opacity ?? 1;
  ctx.drawImage(faceCanvas, dx, dy);
  ctx.restore();
}

function aplicarMascara(
  faceCanvas: any,
  maskCanvas: any,
  cc: CreateCanvas,
  dx: number,
  dy: number,
  espacoDoc: boolean
) {
  const w = faceCanvas.width;
  const h = faceCanvas.height;
  if (w <= 0 || h <= 0) return;
  const buf = cc(w, h);
  const bctx = buf.getContext('2d');
  if (espacoDoc) bctx.drawImage(maskCanvas, -dx, -dy);
  else bctx.drawImage(maskCanvas, 0, 0, w, h);
  const fctx = faceCanvas.getContext('2d');
  fctx.save();
  fctx.globalCompositeOperation = 'destination-in';
  fctx.drawImage(buf, 0, 0);
  fctx.restore();
}

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
