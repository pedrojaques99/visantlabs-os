// Compositor ag-psd → canvas compartilhado entre render-server.ts e render-cli.ts.
// Regras que o Photoshop aplica e que precisamos replicar:
//   - psd.children[0] é a camada de BAIXO (ordem do arquivo PSD) → desenhar 0..n
//   - smart objects vinculados (mesmo placedLayer.id) compartilham o conteúdo:
//     trocar a arte em um troca em todos
//   - máscaras raster (layer.mask.canvas) multiplicam o alpha da camada
//   - camadas com clipping=true só pintam onde a camada-base abaixo tem pixels
//   - placedLayer.transform/nonAffineTransform são 8 números (quad de cantos)

export type CreateCanvas = (w: number, h: number) => any;

export interface ReplacedLayer {
  name: string;
  width: number;
  height: number;
  warped: boolean;
}

// ── Layer tree helpers ────────────────────────────────────────────────────────

export function flattenLayers(layers: any[], parentPath = ""): any[] {
  const result: any[] = [];
  for (const layer of layers) {
    const currentPath = parentPath ? `${parentPath} > ${layer.name || "unnamed"}` : (layer.name || "unnamed");
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
function coverArtCanvas(artImg: any, innerW: number, innerH: number, cc: CreateCanvas) {
  const canvas = cc(innerW, innerH);
  const ctx = canvas.getContext("2d");
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

/** Aplica a arte em UMA camada SO usando o quad de cantos do placedLayer. */
function replaceOne(orig: any, artImg: any, cc: CreateCanvas): ReplacedLayer {
  const pl = orig.placedLayer || {};
  const innerW = Math.max(1, Math.round(pl.width || (orig.right - orig.left) || 1));
  const innerH = Math.max(1, Math.round(pl.height || (orig.bottom - orig.top) || 1));
  const artCanvas = coverArtCanvas(artImg, innerW, innerH, cc);

  // transform e nonAffineTransform são quads [x1,y1,x2,y2,x3,y3,x4,y4]
  // (TL, TR, BR, BL em coords do documento). nonAffine inclui perspectiva.
  const quad: number[] | null =
    (pl.nonAffineTransform?.length === 8 && pl.nonAffineTransform) ||
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
      perspectiveWarp(warpCanvas.getContext("2d"), artCanvas, innerW, innerH, local);
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
  const path: string = layer.path || "";
  // ancestrais = entradas cujo path é prefixo do path da camada
  return allLayers.some(
    (g: any) => g.children && g.hidden && path.startsWith(g.path + " > ")
  );
}

// ── Perspective warp ──────────────────────────────────────────────────────────

// Subdivide o retângulo fonte em grade, interpola bilinearmente os quads de
// destino a partir dos 4 cantos e desenha cada célula com aproximação afim.
export function perspectiveWarp(
  ctx: any, src: any,
  srcW: number, srcH: number,
  corners: Array<{ x: number; y: number }>, // TL, TR, BR, BL no espaço destino
  gridSize = 20
) {
  const [tl, tr, br, bl] = corners;

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const u0 = gx / gridSize, u1 = (gx + 1) / gridSize;
      const v0 = gy / gridSize, v1 = (gy + 1) / gridSize;

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const bilerp = (u: number, v: number) => ({
        x: lerp(lerp(tl.x, tr.x, u), lerp(bl.x, br.x, u), v),
        y: lerp(lerp(tl.y, tr.y, u), lerp(bl.y, br.y, u), v),
      });

      const p00 = bilerp(u0, v0);
      const p10 = bilerp(u1, v0);
      const p01 = bilerp(u0, v1);
      const p11 = bilerp(u1, v1);

      const sx = u0 * srcW, sy = v0 * srcH;
      const sw = (u1 - u0) * srcW, sh = (v1 - v0) * srcH;

      drawTriangle(ctx, src, sx, sy, sw, sh, p00, p10, p01);
      drawTriangle(ctx, src, sx + sw, sy + sh, -sw, -sh, p11, p01, p10);
    }
  }
}

function drawTriangle(
  ctx: any, src: any,
  sx: number, sy: number, sw: number, sh: number,
  p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }
) {
  const dxu = p1.x - p0.x, dyu = p1.y - p0.y;
  const dxv = p2.x - p0.x, dyv = p2.y - p0.y;

  ctx.save();
  ctx.transform(
    dxu / sw, dyu / sw,
    dxv / sh, dyv / sh,
    p0.x - sx * dxu / sw - sy * dxv / sh,
    p0.y - sx * dyu / sw - sy * dyv / sh
  );
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + sw, sy);
  ctx.lineTo(sx, sy + sh);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

// ── Compositing ───────────────────────────────────────────────────────────────

// Blend modes do PSD (strings do ag-psd) → globalCompositeOperation do Canvas 2D
const BLEND_MAP: Record<string, string> = {
  "normal": "source-over",
  "dissolve": "source-over",
  "darken": "darken",
  "multiply": "multiply",
  "color burn": "color-burn",
  "linear burn": "color-burn",
  "darker color": "darken",
  "lighten": "lighten",
  "screen": "screen",
  "color dodge": "color-dodge",
  "linear dodge": "lighter",
  "lighter color": "lighten",
  "overlay": "overlay",
  "soft light": "soft-light",
  "hard light": "hard-light",
  "vivid light": "hard-light",
  "linear light": "hard-light",
  "pin light": "hard-light",
  "hard mix": "hard-light",
  "difference": "difference",
  "exclusion": "exclusion",
  "subtract": "difference",
  "divide": "source-over",
  "hue": "hue",
  "saturation": "saturation",
  "color": "color",
  "luminosity": "luminosity",
};

/** Composita a árvore inteira num canvas do tamanho do documento. */
export function composePsd(psd: any, cc: CreateCanvas) {
  const canvas = cc(psd.width, psd.height);
  drawChildren(canvas.getContext("2d"), psd.children || [], psd.width, psd.height, cc);
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
  const tctx = tmp.getContext("2d");
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
  const blend = BLEND_MAP[layer.blendMode ?? "normal"] ?? "source-over";

  // Atalho: grupo passthrough sem máscara/clip/opacity renderiza direto no pai
  const passthrough = !layer.blendMode || layer.blendMode === "pass through";
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
    baseAlpha.getContext("2d").drawImage(content, 0, 0);

    const cctx = content.getContext("2d");
    for (const cl of clipped) {
      const clContent = contentCanvas(cl, W, H, cc);
      if (!clContent) continue;
      cctx.save();
      cctx.globalAlpha = layerAlpha(cl);
      cctx.globalCompositeOperation = BLEND_MAP[cl.blendMode ?? "normal"] ?? "source-over";
      cctx.drawImage(clContent, 0, 0);
      cctx.restore();
    }
    cctx.save();
    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(baseAlpha, 0, 0);
    cctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = passthrough && layer.children ? "source-over" : blend;
  ctx.drawImage(content, 0, 0);
  ctx.restore();
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

  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(left, top, rw, rh);
  const d = img.data;

  const mc = mask.canvas;
  const mdata = mc.getContext("2d").getImageData(0, 0, mc.width, mc.height).data;
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
