export interface BgRemovalOptions {
  threshold: number;
  feather: number;
}

export type BgRemovalMode = 'simple' | 'ai';

export type ProgressCallback = (phase: string, progress: number) => void;

const DEFAULTS: BgRemovalOptions = {
  threshold: 30,
  feather: 2,
};

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function sampleRegion(data: Uint8ClampedArray, w: number, sx: number, sy: number, size: number) {
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = sy; y < sy + size && y >= 0; y++) {
    for (let x = sx; x < sx + size && x >= 0; x++) {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  return { r: r / count, g: g / count, b: b / count };
}

export async function removeBackgroundSimple(
  imageUrl: string,
  options?: Partial<BgRemovalOptions>,
  onProgress?: ProgressCallback,
): Promise<string> {
  const opts = { ...DEFAULTS, ...options };
  const maxDist = (opts.threshold / 100) * 441.67;
  const featherRange = opts.feather * 8;

  onProgress?.('Loading image', 0.1);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        onProgress?.('Processing pixels', 0.3);

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;
        const S = 8;

        const corners = [
          sampleRegion(data, width, 0, 0, S),
          sampleRegion(data, width, width - S, 0, S),
          sampleRegion(data, width, 0, height - S, S),
          sampleRegion(data, width, width - S, height - S, S),
        ];
        const bgR = corners.reduce((a, c) => a + c.r, 0) / 4;
        const bgG = corners.reduce((a, c) => a + c.g, 0) / 4;
        const bgB = corners.reduce((a, c) => a + c.b, 0) / 4;

        onProgress?.('Removing background', 0.5);

        for (let i = 0; i < data.length; i += 4) {
          const dist = colorDistance(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB);
          if (dist < maxDist) {
            data[i + 3] = 0;
          } else if (featherRange > 0 && dist < maxDist + featherRange) {
            const alpha = ((dist - maxDist) / featherRange) * data[i + 3];
            data[i + 3] = Math.round(alpha);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        onProgress?.('Done', 1);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * Crop an image to a focus region before processing.
 * Region is normalized 0-1 coords { x, y, w, h }.
 * Adds 5% padding on each side for better edge handling.
 */
function cropToRegion(
  sourceCanvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
): HTMLCanvasElement {
  const { width, height } = sourceCanvas;
  const pad = 0.05;
  const sx = Math.max(0, Math.floor((region.x - pad) * width));
  const sy = Math.max(0, Math.floor((region.y - pad) * height));
  const ex = Math.min(width, Math.ceil((region.x + region.w + pad) * width));
  const ey = Math.min(height, Math.ceil((region.y + region.h + pad) * height));

  const crop = document.createElement('canvas');
  crop.width = ex - sx;
  crop.height = ey - sy;
  const ctx = crop.getContext('2d')!;
  ctx.drawImage(sourceCanvas, sx, sy, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop;
}

export interface FocusRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function removeBackgroundAI(
  imageUrl: string,
  onProgress?: ProgressCallback,
  focusRegion?: FocusRegion | null,
): Promise<string> {
  onProgress?.('Loading AI model', 0.05);

  const { removeBackground: imglyRemove } = await import('@imgly/background-removal');

  onProgress?.('Preparing image', 0.1);

  let sourceBlob: Blob;

  if (focusRegion) {
    const img = await loadImage(imageUrl);
    const full = document.createElement('canvas');
    full.width = img.width;
    full.height = img.height;
    const fCtx = full.getContext('2d')!;
    fCtx.drawImage(img, 0, 0);

    const cropped = cropToRegion(full, focusRegion);
    sourceBlob = await new Promise<Blob>((res, rej) =>
      cropped.toBlob((b) => (b ? res(b) : rej(new Error('Canvas toBlob failed'))), 'image/png'),
    );
    onProgress?.('Focus region cropped', 0.15);
  } else {
    const resp = await fetch(imageUrl);
    sourceBlob = await resp.blob();
  }

  onProgress?.('Running AI removal', 0.2);

  const resultBlob = await imglyRemove(sourceBlob, {
    progress: (key: string, current: number, total: number) => {
      const ratio = total > 0 ? current / total : 0;
      const mapped = 0.2 + ratio * 0.75;
      onProgress?.(key === 'compute:inference' ? 'AI processing' : 'Loading model', mapped);
    },
    output: { format: 'image/png', quality: 1 },
  });

  onProgress?.('Finalizing', 0.98);

  const resultUrl = URL.createObjectURL(resultBlob);

  const resultImg = await loadImage(resultUrl);
  const out = document.createElement('canvas');
  out.width = resultImg.width;
  out.height = resultImg.height;
  const outCtx = out.getContext('2d')!;
  outCtx.drawImage(resultImg, 0, 0);
  URL.revokeObjectURL(resultUrl);

  onProgress?.('Done', 1);
  return out.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/** Legacy default export for backwards compat */
export const removeBackground = removeBackgroundSimple;
