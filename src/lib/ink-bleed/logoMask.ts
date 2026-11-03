/**
 * Reduces an uploaded logo to a white alpha mask: the ink color tints it inside the
 * filter, so it behaves like text. A file with transparency keeps its alpha. A flat
 * one (JPG, or a PNG on a solid background) gets alpha from its distance to the
 * background color, sampled at the corners, which handles dark-on-light and light-on-dark.
 */
import type { InkLogo } from './types';

const MAX_SIDE = 2400;

/** Mutates `data` (RGBA). Exported for tests. */
export function toAlphaMask(data: Uint8ClampedArray, width: number, height: number): void {
  const at = (x: number, y: number) => (y * width + x) * 4;
  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      hasTransparency = true;
      break;
    }
  }

  if (hasTransparency) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
    return;
  }

  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, i) => sum + data[i + c], 0) / 4);

  // Normalize by the strongest difference, so a low-contrast logo still reads as solid ink.
  let peak = 1;
  for (let i = 0; i < data.length; i += 4) {
    const d =
      Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    if (d > peak) peak = d;
  }
  for (let i = 0; i < data.length; i += 4) {
    const d =
      Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round((d / peak) * 255);
  }
}

/** `src` must be same-origin, a data URL, a blob URL or served with CORS. */
export async function createLogoMask(src: string, name: string): Promise<InkLogo> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not read this image'));
    image.src = src;
  });

  // An SVG without intrinsic size reports 0, and a vector can be drawn at any size anyway.
  const naturalW = image.naturalWidth || MAX_SIDE;
  const naturalH = image.naturalHeight || MAX_SIDE;
  const isVector = /\.svg($|\?)/i.test(name) || src.startsWith('data:image/svg');
  const scale = isVector
    ? MAX_SIDE / Math.max(naturalW, naturalH)
    : Math.min(1, MAX_SIDE / Math.max(naturalW, naturalH));
  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(image, 0, 0, width, height);

  const pixels = ctx.getImageData(0, 0, width, height);
  toAlphaMask(pixels.data, width, height);
  ctx.putImageData(pixels, 0, 0);

  return { dataUrl: canvas.toDataURL('image/png'), width, height, name };
}
