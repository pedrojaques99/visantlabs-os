/**
 * Apply shader effect to any HTMLCanvasElement
 *
 * Used by export pipelines to bake shader effects into PNG/video output.
 */

import type { ShaderSettings } from './shaderRenderer';
import { applyShaderEffect } from './shaderRenderer';
import { loadImage } from '@/utils/imageUtils';

export async function applyShaderToCanvas(
  sourceCanvas: HTMLCanvasElement,
  settings: ShaderSettings,
): Promise<HTMLCanvasElement> {
  const base64 = await applyShaderEffect(
    sourceCanvas,
    sourceCanvas.width,
    sourceCanvas.height,
    settings,
  );

  const imgSrc = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  const img = await loadImage(imgSrc, null);

  const out = document.createElement('canvas');
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return out;
}

export async function applyShaderToBlob(
  sourceCanvas: HTMLCanvasElement,
  settings: ShaderSettings,
): Promise<Blob> {
  const result = await applyShaderToCanvas(sourceCanvas, settings);
  return new Promise<Blob>((resolve) => {
    result.toBlob((b) => resolve(b!), 'image/png');
  });
}
