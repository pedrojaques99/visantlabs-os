/**
 * Extracts up to 10 most frequent and well-contrasted colors from an image
 */

export interface ColorExtractionResult {
  colors: string[]; // Array of hex colors (max 10)
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculate color distance (Euclidean distance in RGB space)
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r2 - r1, 2) + 
    Math.pow(g2 - g1, 2) + 
    Math.pow(b2 - b1, 2)
  );
}

/**
 * Calculate contrast ratio between two colors (WCAG)
 */
function getContrastRatio(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Extract up to 10 most frequent and well-contrasted colors from image
 */
export async function extractColors(
  base64: string, 
  mimeType: string = 'image/png',
  maxColors: number = 10
): Promise<ColorExtractionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const dataUrl = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Color frequency map
        const colorMap = new Map<string, { count: number; r: number; g: number; b: number }>();
        let pixelCount = 0;

        // Sample pixels (every 10th pixel for performance)
        for (let i = 0; i < pixels.length; i += 40) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          pixelCount++;

          // Quantize colors to reduce palette (more aggressive quantization for better grouping)
          const quantizedR = Math.round(r / 16) * 16;
          const quantizedG = Math.round(g / 16) * 16;
          const quantizedB = Math.round(b / 16) * 16;
          const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

          const existing = colorMap.get(colorKey);
          if (existing) {
            existing.count++;
            // Update average RGB (running average)
            existing.r = Math.round((existing.r * (existing.count - 1) + r) / existing.count);
            existing.g = Math.round((existing.g * (existing.count - 1) + g) / existing.count);
            existing.b = Math.round((existing.b * (existing.count - 1) + b) / existing.count);
          } else {
            colorMap.set(colorKey, { count: 1, r, g, b });
          }
        }

        // Convert to array and sort by frequency
        const colorEntries = Array.from(colorMap.entries())
          .map(([key, value]) => ({
            key,
            ...value,
            hex: rgbToHex(value.r, value.g, value.b),
          }))
          .sort((a, b) => b.count - a.count);

        // Select colors prioritizing frequency and contrast
        const selectedColors: Array<{ hex: string; r: number; g: number; b: number; score: number }> = [];
        const minContrastRatio = 1.2; // Minimum contrast to consider colors different
        const minDistance = 30; // Minimum color distance in RGB space

        for (const candidate of colorEntries) {
          // Check if we already have enough colors
          if (selectedColors.length >= maxColors) break;

          // Calculate score combining frequency and contrast with already selected colors
          let score = candidate.count;
          let hasGoodContrast = false;

          if (selectedColors.length === 0) {
            // First color: just add the most frequent
            selectedColors.push({
              hex: candidate.hex,
              r: candidate.r,
              g: candidate.g,
              b: candidate.b,
              score: candidate.count,
            });
            continue;
          }

          // Check contrast and distance with already selected colors
          for (const selected of selectedColors) {
            const distance = colorDistance(
              candidate.r, candidate.g, candidate.b,
              selected.r, selected.g, selected.b
            );
            const contrast = getContrastRatio(
              candidate.r, candidate.g, candidate.b,
              selected.r, selected.g, selected.b
            );

            // If color is too similar to an existing one, reduce score
            if (distance < minDistance) {
              score *= 0.1; // Heavily penalize similar colors
            } else if (contrast >= minContrastRatio) {
              hasGoodContrast = true;
              // Boost score for contrasting colors
              score *= (1 + contrast / 10);
            }
          }

          // Prefer colors that contrast well with existing selection
          if (hasGoodContrast || selectedColors.length < 3) {
            selectedColors.push({
              hex: candidate.hex,
              r: candidate.r,
              g: candidate.g,
              b: candidate.b,
              score,
            });
          }
        }

        // Sort final selection by score and take top colors
        const finalColors = selectedColors
          .sort((a, b) => b.score - a.score)
          .slice(0, maxColors)
          .map(c => c.hex);

        // If we have fewer colors than requested, fill with most frequent remaining
        if (finalColors.length < maxColors) {
          const remaining = colorEntries
            .filter(c => !finalColors.includes(c.hex))
            .slice(0, maxColors - finalColors.length)
            .map(c => c.hex);
          finalColors.push(...remaining);
        }

        resolve({
          colors: finalColors.slice(0, maxColors),
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for color extraction'));
    };

    img.src = dataUrl;
  });
}





