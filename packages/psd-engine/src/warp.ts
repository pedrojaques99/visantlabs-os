import type { CreateCanvas } from './types.js';

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
