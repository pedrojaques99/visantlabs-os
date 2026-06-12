/**
 * Browser Halftone SVG export — thin adapter over @visant/print-fx.
 *
 * The CMYK halftone dot generator now lives in the package
 * (`@visant/print-fx/halftone`). This module keeps the browser-friendly
 * `ImageData`/canvas signatures so existing callers (ImageLabPage) are
 * unchanged; it just unpacks the pixel buffer and delegates.
 */
import { generateHalftoneSvg as generateHalftoneSvgCore } from '@visant/print-fx/halftone';
import type { HalftoneSettings } from './HalftoneRenderer';

export function generateHalftoneSvg(imageData: ImageData, settings: HalftoneSettings): string {
  return generateHalftoneSvgCore(
    imageData.data,
    imageData.width,
    imageData.height,
    settings as unknown as Parameters<typeof generateHalftoneSvgCore>[3]
  );
}

export function generateHalftoneSvgFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  settings: HalftoneSettings
): string {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const { width: w, height: h } = sourceCanvas;
  ctx.canvas.width = w;
  ctx.canvas.height = h;
  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  return generateHalftoneSvg(imageData, settings);
}
