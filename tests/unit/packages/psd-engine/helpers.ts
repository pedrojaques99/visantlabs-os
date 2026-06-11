// Shared fixtures/helpers for @visant/psd-engine unit tests.
// Uses node-canvas directly (a project dependency) as the CreateCanvas backend —
// no real .psd file is needed; the engine operates on a plain layer tree.

import { createCanvas } from 'canvas';
import type { CreateCanvas } from '@visant/psd-engine';

export const cc: CreateCanvas = (w: number, h: number) => createCanvas(w, h);

/** A solid-color RGBA canvas of the given size. */
export function solid(w: number, h: number, color: string): any {
  const c = cc(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** A two-tone art canvas so warps/crops are visually detectable. */
export function artCanvas(w = 64, h = 64): any {
  const c = cc(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0, 0, w / 2, h / 2);
  return c;
}

/** Average absolute per-channel pixel difference between two same-size canvases (0..255). */
export function meanPixelDiff(a: any, b: any): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
  const db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
  let sum = 0;
  for (let i = 0; i < da.length; i++) sum += Math.abs(da[i] - db[i]);
  return sum / da.length;
}

/** Read a single pixel [r,g,b,a] at (x,y). */
export function pixel(canvas: any, x: number, y: number): [number, number, number, number] {
  const d = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}
