// Browser adapter — backed by the DOM <canvas> + Image. No Node dependencies.
// Used by the Scene Package client (Boxy + Visant web) to render mockups in the
// user's browser. ag-psd is NOT needed here — scene/render operates on the
// SceneDoc + pre-extracted layer images, never on the raw PSD.

import type { CreateCanvas } from '../types.js';

/** Create an HTMLCanvasElement of the given size. */
export const createCanvas: CreateCanvas = (w: number, h: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

/** Load an image from a URL / Blob URL / data URI into an HTMLImageElement. */
export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let revoke: string | null = null;
    img.onload = () => {
      if (revoke) URL.revokeObjectURL(revoke);
      resolve(img);
    };
    img.onerror = () => {
      if (revoke) URL.revokeObjectURL(revoke);
      reject(new Error('Failed to load image'));
    };
    if (typeof src === 'string') {
      img.src = src;
    } else {
      revoke = URL.createObjectURL(src);
      img.src = revoke;
    }
  });
}

/** Export a canvas to a Blob (PNG by default). */
export function toBlob(
  canvas: HTMLCanvasElement,
  mime = 'image/png',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob produced null'))),
      mime,
      quality
    );
  });
}

/** Convenience: the browser adapter bundled as an object (mirrors createNodeAdapter shape). */
export function createBrowserAdapter() {
  return { createCanvas, loadImage, toBlob };
}
