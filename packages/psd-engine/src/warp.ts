import type { CreateCanvas } from './types.js';

/** Desenha a arte (cover, sem distorção) num canvas do tamanho interno do SO. */
export function coverArtCanvas(artImg: any, innerW: number, innerH: number, cc: CreateCanvas) {
  const canvas = cc(innerW, innerH);
  const ctx = canvas.getContext('2d');
  const artRatio = artImg.width / artImg.height;
  const soRatio = innerW / innerH;
  let sx = 0,
    sy = 0,
    sw = artImg.width,
    sh = artImg.height;
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

/**
 * Compute exact 3×3 homography matrix from 4 point correspondences via DLT.
 *
 * Maps src[i] = [x, y] → dst[i] = [x', y'] for i in 0..3.
 * No external dependencies — pure Gaussian elimination with partial pivoting.
 *
 * Returns H as a flat 9-element array [h00,h01,h02, h10,h11,h12, h20,h21,1].
 */
function computeHomography(src: number[][], dst: number[][]): number[] {
  // 8×9 augmented matrix for the system Ah=0 (h22=1 normalization)
  // Each point pair gives 2 equations:
  //   h00*x + h01*y + h02 - x'*h20*x - x'*h21*y = x'
  //   h10*x + h11*y + h12 - y'*h20*x - y'*h21*y = y'
  const M: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [xp, yp] = dst[i];
    M.push([x, y, 1, 0, 0, 0, -xp * x, -xp * y, xp]);
    M.push([0, 0, 0, x, y, 1, -yp * x, -yp * y, yp]);
  }

  const n = 8;
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row][col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue; // degenerate — skip (shouldn't happen for valid quads)
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / pivot;
      for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
    }
  }

  // Back substitution
  const h = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    h[i] = M[i][n];
    for (let j = i + 1; j < n; j++) h[i] -= M[i][j] * h[j];
    h[i] /= M[i][i];
  }
  // h = [h00,h01,h02, h10,h11,h12, h20,h21], h22=1
  return [...h, 1];
}

/**
 * Apply 3×3 homography to a single source point (src coords → dest coords).
 * h is the flat 9-element array from computeHomography.
 */
function applyH(h: number[], x: number, y: number): { x: number; y: number } {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

/**
 * Warp source image onto a perspective quad using exact projective homography.
 *
 * PREVIOUS: bilinear bilerp (lerp of lerp) — approximation, distorts at high angles.
 * NOW: DLT homography (exact 3×3 projective matrix) per grid cell corner.
 *
 * Grid size 64×64 (up from 32) gives ~1px cell granularity for 4K images.
 * Each cell corner is computed from the exact H matrix — no approximation.
 */
export function perspectiveWarp(
  ctx: any,
  src: any,
  srcW: number,
  srcH: number,
  corners: Array<{ x: number; y: number }>, // TL, TR, BR, BL in destination space
  gridSize = 64
) {
  const [tl, tr, br, bl] = corners;

  // Compute exact homography: art corners → destination quad corners
  const H = computeHomography(
    [[0, 0], [srcW, 0], [srcW, srcH], [0, srcH]],
    [[tl.x, tl.y], [tr.x, tr.y], [br.x, br.y], [bl.x, bl.y]],
  );

  const E = 2.0; // clip expansion to seal inter-cell gaps (0.5 leaves sub-pixel seams on extreme perspective)

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const u0 = gx / gridSize,       u1 = (gx + 1) / gridSize;
      const v0 = gy / gridSize,       v1 = (gy + 1) / gridSize;

      // Exact projective corners of this cell in destination space
      const p00 = applyH(H, u0 * srcW, v0 * srcH); // TL of cell in dest
      const p10 = applyH(H, u1 * srcW, v0 * srcH); // TR
      const p01 = applyH(H, u0 * srcW, v1 * srcH); // BL

      const sx = u0 * srcW, sy = v0 * srcH;
      const sw = (u1 - u0) * srcW, sh = (v1 - v0) * srcH;

      // TL-affine: maps (sx,sy)→p00, (sx+sw,sy)→p10, (sx,sy+sh)→p01
      const dxu = p10.x - p00.x, dyu = p10.y - p00.y;
      const dxv = p01.x - p00.x, dyv = p01.y - p00.y;

      ctx.save();
      ctx.transform(
        dxu / sw, dyu / sw,
        dxv / sh, dyv / sh,
        p00.x - (sx * dxu) / sw - (sy * dxv) / sh,
        p00.y - (sx * dyu) / sw - (sy * dyv) / sh,
      );
      ctx.beginPath();
      ctx.rect(sx - E, sy - E, sw + 2 * E, sh + 2 * E);
      ctx.clip();
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    }
  }
}
