export interface BgRemovalOptions {
  threshold: number; // 0-100, color distance threshold
  feather: number; // 0-10px edge softening
}

const DEFAULTS: BgRemovalOptions = {
  threshold: 30,
  feather: 2,
};

/** Euclidean distance in RGB space (0-441.67) */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Average color of an 8x8 region starting at (sx, sy) */
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

/**
 * Remove background from an image using canvas-based color distance.
 * Samples the 4 corner regions to detect the background color, then
 * sets matching pixels to transparent with optional edge feathering.
 */
export async function removeBackground(
  imageUrl: string,
  options?: Partial<BgRemovalOptions>,
): Promise<string> {
  const opts = { ...DEFAULTS, ...options };
  const maxDist = (opts.threshold / 100) * 441.67; // scale 0-100 to 0-max euclidean
  const featherRange = opts.feather * 8; // px → distance units for smooth falloff

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;
        const S = 8; // corner sample size

        // Sample background color from 4 corners
        const corners = [
          sampleRegion(data, width, 0, 0, S),
          sampleRegion(data, width, width - S, 0, S),
          sampleRegion(data, width, 0, height - S, S),
          sampleRegion(data, width, width - S, height - S, S),
        ];
        const bgR = corners.reduce((a, c) => a + c.r, 0) / 4;
        const bgG = corners.reduce((a, c) => a + c.g, 0) / 4;
        const bgB = corners.reduce((a, c) => a + c.b, 0) / 4;

        // Process each pixel
        for (let i = 0; i < data.length; i += 4) {
          const dist = colorDistance(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB);

          if (dist < maxDist) {
            // Fully within threshold → transparent
            data[i + 3] = 0;
          } else if (featherRange > 0 && dist < maxDist + featherRange) {
            // Feather zone → fade alpha proportionally
            const alpha = ((dist - maxDist) / featherRange) * data[i + 3];
            data[i + 3] = Math.round(alpha);
          }
          // else: keep original alpha
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}
