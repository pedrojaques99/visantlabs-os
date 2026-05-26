/**
 * Headless TextureFilter renderer — pure Canvas2D, no DOM/store dependencies.
 * Used by both the standalone TextureFilter page and the React Flow node.
 */

export interface TextureFilterRenderSettings {
  opacity: number;
  scale: number;
  blendMode: string;
  textureColor: string;
  useOriginalColor: boolean;
  rotation: number;
  offsetX: number;
  offsetY: number;
  tileMode: boolean;
  tileGapX: number;
  tileGapY: number;
  maskMode: boolean;
  maskInvert: boolean;
}

export const TEXTURE_FILTER_RENDER_DEFAULTS: TextureFilterRenderSettings = {
  opacity: 0.6,
  scale: 1.0,
  blendMode: 'multiply',
  textureColor: '#FF6038',
  useOriginalColor: true,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  tileMode: true,
  tileGapX: 0,
  tileGapY: 0,
  maskMode: false,
  maskInvert: false,
};

function drawTexture(
  ctx: CanvasRenderingContext2D,
  texture: HTMLImageElement,
  sw: number,
  sh: number,
  settings: TextureFilterRenderSettings,
) {
  const tw = texture.naturalWidth || texture.width;
  const th = texture.naturalHeight || texture.height;
  const scaledW = tw * settings.scale;
  const scaledH = th * settings.scale;

  let texSource: HTMLImageElement | HTMLCanvasElement = texture;

  if (!settings.useOriginalColor) {
    const offscreen = document.createElement('canvas');
    offscreen.width = tw;
    offscreen.height = th;
    const octx = offscreen.getContext('2d')!;
    octx.drawImage(texture, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = settings.textureColor;
    octx.fillRect(0, 0, tw, th);
    texSource = offscreen;
  }

  if (settings.tileMode) {
    const stepX = scaledW + settings.tileGapX * settings.scale;
    const stepY = scaledH + settings.tileGapY * settings.scale;
    for (let x = settings.offsetX % stepX - stepX; x < sw + stepX; x += stepX) {
      for (let y = settings.offsetY % stepY - stepY; y < sh + stepY; y += stepY) {
        ctx.drawImage(texSource, x, y, scaledW, scaledH);
      }
    }
  } else {
    ctx.drawImage(texSource, settings.offsetX, settings.offsetY, scaledW, scaledH);
  }
}

/**
 * Renders a texture overlay onto an input image and returns the result canvas.
 * Pure function — no React/store/DOM dependencies beyond document.createElement.
 */
export function renderTextureFilter(
  inputImage: HTMLImageElement | HTMLCanvasElement,
  textureImage: HTMLImageElement,
  settings: TextureFilterRenderSettings,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const sw = inputImage instanceof HTMLImageElement ? inputImage.naturalWidth : inputImage.width;
  const sh = inputImage instanceof HTMLImageElement ? inputImage.naturalHeight : inputImage.height;
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, sw, sh);

  if (settings.maskMode) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = sw;
    maskCanvas.height = sh;
    const mctx = maskCanvas.getContext('2d')!;

    if (settings.maskInvert) {
      mctx.fillStyle = '#ffffff';
      mctx.fillRect(0, 0, sw, sh);
      mctx.globalCompositeOperation = 'destination-out';
    }

    mctx.save();
    if (settings.rotation !== 0) {
      mctx.translate(sw / 2, sh / 2);
      mctx.rotate((settings.rotation * Math.PI) / 180);
      mctx.translate(-sw / 2, -sh / 2);
    }
    mctx.globalAlpha = 1;
    drawTexture(mctx, textureImage, sw, sh, { ...settings, useOriginalColor: false, textureColor: '#ffffff' });
    mctx.restore();

    ctx.drawImage(inputImage, 0, 0, sw, sh);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.drawImage(inputImage, 0, 0, sw, sh);

    ctx.save();
    ctx.globalCompositeOperation = settings.blendMode as GlobalCompositeOperation;
    ctx.globalAlpha = settings.opacity;

    if (settings.rotation !== 0) {
      ctx.translate(sw / 2, sh / 2);
      ctx.rotate((settings.rotation * Math.PI) / 180);
      ctx.translate(-sw / 2, -sh / 2);
    }

    drawTexture(ctx, textureImage, sw, sh, settings);
    ctx.restore();
  }

  return canvas;
}

// Re-export loadImage from the shared utility for backward compatibility
export { loadImage } from '@/utils/imageUtils';
