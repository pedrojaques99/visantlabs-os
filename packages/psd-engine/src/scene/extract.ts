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
//     ⚠️ Isto NÃO é caso raro, ao contrário do que este comentário afirmou por
//     muito tempo ("the BOXY template keeps lights/shadows as separate sibling
//     top-level groups, so this is safe in practice"). Medido em 10/08/2026 com
//     `scene-fidelity`: 5 de 5 PSDs da amostra guardam luz/sombra DENTRO do
//     container, e a extração descartava tudo com ZERO avisos em 6 arquivos.
//     Agora cada descarte vira `warning` nomeando as camadas. Recompor de
//     verdade (blend + clipping + máscara de grupo) continua pendente, e é o que
//     separa a cena de poder substituir o PSD.
//   - Faces sharing a single top-level container are all extracted, but only one
//     base/over partition (by the first such container) is produced.

import { flattenLayers, composePsd, BLEND_MAP } from '../compose.js';
import { buildAdjustmentLut } from '../adjustments.js';
import { computeFaces } from '../faces.js';
import { BRAND_HIDE } from '../constants.js';
import type { CreateCanvas, FaceSo } from '../types.js';
import type { SceneDoc, SceneFace, SceneLayer, AssetMap, Quad, SceneLut } from './types.js';

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
 * Camadas de decoração que moram DENTRO do container da face — sombra, luz,
 * overlay — e que a extração descarta junto com o container.
 *
 * O cabeçalho deste arquivo afirmava que o template BOXY guarda luz/sombra como
 * grupos irmãos no topo, "safe in practice". Medido em 10/08/2026 sobre a
 * amostra do `scene-fidelity`: **5 de 5** guardam dentro. `Double Cards Stack`
 * tem `Shadow` (multiply .94) e `Light` (hard light .23) dentro de cada grupo de
 * face; `Coffee Paper Cups`, `boxes_scene_3_bg` e `Capa CD` as têm como camadas
 * CLIP logo abaixo; `paper-ghetto` tem um `Mockup Overlay`. É a maior parte da
 * divergência que sobra, e saía **sem um aviso sequer**.
 */
function decoracaoDescartada(
  container: any,
  faceLinkIds: Set<string>,
  facePaths: Set<string>,
  path: string
): string[] {
  const achadas: string[] = [];
  const anda = (layer: any, p: string) => {
    for (const child of layer.children || []) {
      const cp = `${p} > ${child.name || 'unnamed'}`;
      if (subtreeHasFace(child, faceLinkIds, facePaths, cp)) {
        if (child.children) anda(child, cp);
        continue;
      }
      if (child.hidden || layerAlpha(child) <= 0) continue;
      if (child.children) { anda(child, cp); continue; }
      if (!child.canvas && !child.adjustment) continue;
      achadas.push(child.name || 'unnamed');
    }
  };
  anda(container, path);
  return achadas;
}

/**
 * A camada de recorte ("clipping", o CLIP do debug-tree) pinta só onde a camada
 * de BAIXO tem alpha — no template BOXY é assim que `Shadow`/`Light` marcam a
 * sombra em cima do produto sem sujar o cenário.
 *
 * Achatada SOZINHA ela recorta contra o nada e sai 100% transparente. Medido no
 * `Coffee Paper Cups`: `over-1` e `over-2` tinham 19 KB e **0,00% de pixel com
 * alpha** — a cena emitia as duas camadas, o render desenhava as duas, e nenhum
 * pixel mudava. Os copos saíam sem sombra e o cenário batia, o que fazia o diff
 * parecer erro de geometria.
 *
 * A cura é a semântica do Photoshop: achatar SEM o recorte e guardar o alpha da
 * base como máscara.
 */
function baseDoRecorte(irmaos: any[], i: number): any | null {
  for (let j = i - 1; j >= 0; j--) {
    if (!irmaos[j].clipping) return irmaos[j];
  }
  return null;
}

/** Um canvas é totalmente transparente? (o sintoma que passou anos calado) */
function totalmenteTransparente(canvas: any): boolean {
  const w = canvas?.width ?? 0;
  const h = canvas?.height ?? 0;
  if (!w || !h) return true;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
  return true;
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

function hasUsableMask(layer: any): boolean {
  const m = layer.mask;
  return !!(m && !m.disabled && m.canvas && m.canvas.width > 0 && m.canvas.height > 0);
}

/**
 * Um grupo "pass through" sem isolamento não existe como camada: seus filhos
 * compõem DIRETO no pai. É literalmente o que `drawOne` faz em compose.ts
 * (o atalho `passthrough`), e a condição aqui é a mesma — alpha cheio, sem
 * máscara, sem clipping.
 *
 * Isto importa porque o grupo `FX` da BOXY é pass-through e guarda os
 * adjustment layers globais. Tratado como um `over` achatado, ele perdia o
 * ajuste inteiro. Expandido, cada filho vira uma camada de topo e o adjustment
 * é emitido como `role: 'adjust'`, que é o que ele é.
 */
function expandirPassthrough(children: any[]): any[] {
  const out: any[] = [];
  for (const c of children) {
    const alpha = layerAlpha(c);
    const ehPassthrough = !c.blendMode || c.blendMode === 'pass through';
    if (c.children && ehPassthrough && alpha >= 1 && !hasUsableMask(c)) {
      out.push(...expandirPassthrough(c.children));
    } else {
      out.push(c);
    }
  }
  return out;
}

/** `Uint8Array` não sobrevive ao JSON do SceneDoc — vira array comum. */
function lutSerializavel(adjustment: any): SceneLut | null {
  const lut = buildAdjustmentLut(adjustment);
  if (!lut) return null;
  return { r: Array.from(lut.r), g: Array.from(lut.g), b: Array.from(lut.b) };
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
  // Grupos pass-through viram seus próprios filhos ANTES de particionar: eles
  // não isolam nada, e mantê-los inteiros escondia adjustment layers globais
  // dentro de um `over` que os descartava.
  const topChildren: any[] = expandirPassthrough(psd.children || []);

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
      if (isFaceContainer[i]) {
        // Consumido pela geometria da face — mas o que ele levava junto vira
        // aviso. Silêncio aqui é a diferença entre "a cena não serve" e "a cena
        // serve", e por muito tempo a extração respondeu a segunda coisa sem ter
        // olhado.
        const perdidas = decoracaoDescartada(c, faceLinkIds, facePaths, topPaths[i]);
        if (perdidas.length) {
          warnings.push(
            `decoração dentro do container "${topPaths[i]}" descartada: ` +
              `${perdidas.join(', ')} — a cena vai sair mais clara que o PSD`
          );
        }
        continue;
      }
      if (!visibleEligible(c)) continue;

      // Adjustment layer: não tem pixels, tem tabela. Achatá-lo sozinho daria
      // canvas vazio (a LUT não teria nada abaixo para ajustar) e o ajuste
      // sumiria — era esta a causa da cena lavada.
      if (c.adjustment && !c.canvas) {
        const lut = lutSerializavel(c.adjustment);
        if (!lut) {
          // Tipo não suportado pelo buildAdjustmentLut (exposure, vibrance…).
          // Vira aviso em vez de virar silêncio.
          warnings.push(`adjustment não suportado na camada "${c.name || 'unnamed'}" — ignorado`);
          continue;
        }
        const camada: SceneLayer = {
          role: 'adjust',
          src: '',
          lut,
          blendMode: 'source-over',
          opacity: layerAlpha(c),
          left: 0,
          top: 0,
        };
        if (hasUsableMask(c)) {
          const ref = nextRef('adjmask');
          assets[ref] = c.mask.canvas;
          camada.maskRef = ref;
        }
        layers.push(camada);
        continue;
      }

      const rawBlend = c.blendMode ?? 'normal';
      const mapped = BLEND_MAP[rawBlend];
      if (mapped === undefined) {
        warnings.push(`blend mode não mapeado "${rawBlend}" na camada "${c.name || 'unnamed'}"`);
      }
      const ref = nextRef('over');
      // Flatten this single top-level child at full size (preserves its internal
      // composition); its own blend/opacity are applied at render time.
      // `clipping: false` é obrigatório aqui: achatada sozinha, a camada de
      // recorte não tem base contra a qual recortar e sai vazia.
      assets[ref] = flattenSubset(
        [{ ...c, opacity: 1, fillOpacity: 1, blendMode: 'normal', clipping: false }],
        width,
        height,
        cc
      );
      const camadaOver: SceneLayer = {
        role: 'over',
        src: ref,
        blendMode: mapped ?? 'source-over',
        opacity: layerAlpha(c),
        left: 0,
        top: 0,
      };

      // Recorte: o alpha da base vira máscara, que é o que o Photoshop faz.
      if (c.clipping) {
        const base = baseDoRecorte(topChildren, i);
        if (base) {
          const mref = nextRef('clipmask');
          assets[mref] = flattenSubset(
            [{ ...base, opacity: 1, fillOpacity: 1, blendMode: 'normal', clipping: false }],
            width,
            height,
            cc
          );
          camadaOver.maskRef = mref;
        } else {
          warnings.push(
            `camada de recorte "${c.name || 'unnamed'}" sem base embaixo — vai pintar sem recorte`
          );
        }
      }

      // Guarda geral: camada que não tem um pixel opaco não muda nada no render.
      // Vale para qualquer causa futura, não só o recorte.
      if (totalmenteTransparente(assets[ref])) {
        warnings.push(`camada "${c.name || 'unnamed'}" achatou vazia — não muda um pixel do render`);
      }

      layers.push(camadaOver);
    }
  }

  const doc: SceneDoc = { version: 1, width, height, faces: sceneFaces, layers, warnings };
  return { doc, assets };
}
