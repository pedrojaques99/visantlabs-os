/**
 * Extracts up to 10 most frequent and well-contrasted colors from an image
 */

export interface ColorExtractionResult {
  colors: string[]; // Array of hex colors (max 10)
}

/**
 * Convert RGB to hex
 */
/**
 * Convert RGB to Hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
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
 * Extract colors from image
 * Strategy: 70% Dominant (Frequency-based) + 30% Variation (Saturation/Vibrancy-based)
 */
export async function extractColors(
  base64: string,
  mimeType: string = 'image/png',
  maxColors: number = 10,
  shouldRandomize: boolean = false
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
        const colorMap = new Map<string, { count: number; r: number; g: number; b: number; h: number; s: number; l: number }>();
        let pixelCount = 0;

        // Sample pixels (every 40th pixel for performance)
        for (let i = 0; i < pixels.length; i += 40) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          pixelCount++;

          // Quantize colors to reduce palette
          const quantizedR = Math.round(r / 16) * 16;
          const quantizedG = Math.round(g / 16) * 16;
          const quantizedB = Math.round(b / 16) * 16;
          const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

          const existing = colorMap.get(colorKey);
          if (existing) {
            existing.count++;
          } else {
            const hsl = rgbToHsl(quantizedR, quantizedG, quantizedB);
            colorMap.set(colorKey, { count: 1, r: quantizedR, g: quantizedG, b: quantizedB, ...hsl });
          }
        }

        // Convert to array
        const colorEntries = Array.from(colorMap.entries()).map(([key, value]) => ({
          key,
          ...value,
          hex: rgbToHex(value.r, value.g, value.b),
        }));

        // --- SELECTION STRATEGY ---

        // --- SELECTION STRATEGY ---

        const selectedColors: Array<{ hex: string; r: number; g: number; b: number; score: number }> = [];
        const minDistance = 45; // Increased distance to ensure distinctness

        // Helper to check if a color is grayscale (low saturation)
        const isGrayscale = (r: number, g: number, b: number) => {
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          return (max - min) < 20; // If RGB values are close, it's grayscale
        };

        // Partition slots: 40% Dominant (Base), 60% Variation (Accents)
        // This ensures we get the main themes but prioritize finding colorful accents
        const dominantCount = Math.round(maxColors * 0.4);

        // Limit grayscale colors in the dominant pass to avoid "all gray" palettes
        let grayscaleCount = 0;
        const maxGrayscaleInDominant = 2;

        // Helper to check if a candidate is distinct enough from already selected colors
        const isDistinct = (candidate: typeof colorEntries[0]) => {
          return selectedColors.every(selected => {
            const dist = colorDistance(candidate.r, candidate.g, candidate.b, selected.r, selected.g, selected.b);
            return dist >= minDistance;
          });
        };

        // Helper to pick colors from a sorted list with optional randomization
        const pickColors = (
          sourceCandidates: typeof colorEntries,
          targetList: typeof selectedColors,
          countNeeded: number,
          poolSize: number = 20
        ) => {
          // If randomized, take the top N candidates and shuffle them
          let pool = sourceCandidates.slice(0, poolSize);

          if (shouldRandomize) {
            // Fisher-Yates shuffle the pool
            for (let i = pool.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [pool[i], pool[j]] = [pool[j], pool[i]];
            }
          }

          let picked = 0;
          for (const candidate of pool) {
            if (picked >= countNeeded) break;

            // Check distinctness against ALREADY selected colors (from previous passes or this pass)
            if (isDistinct(candidate) && !targetList.some(c => c.hex === candidate.hex)) {

              // Specific logic for Dominant pass (implied by context, can be passed as arg if needed but distinct check handles most)
              // For this helper we just check general constraints

              const isGray = isGrayscale(candidate.r, candidate.g, candidate.b);
              // We don't have the "maxGrayscale" context here easily without passing it in, 
              // so we'll do the simple selection here and handle complex filtering before calling or by checking targetList

              // Re-implement grayscale limit check based on targetList
              if (isGray) {
                const existingGrays = targetList.filter(c => isGrayscale(c.r, c.g, c.b)).length;
                if (existingGrays >= maxGrayscaleInDominant) continue;
              }

              targetList.push({
                hex: candidate.hex,
                r: candidate.r,
                g: candidate.g,
                b: candidate.b,
                score: candidate.count
              });
              picked++;
            }
          }
          return picked;
        };

        // --- PASS 1: Dominant Colors (Frequency) ---
        const sortedByFrequency = [...colorEntries].sort((a, b) => b.count - a.count);

        // We want 'dominantCount' colors. We allow looking at the top 30 candidates.
        pickColors(sortedByFrequency, selectedColors, dominantCount, 30);


        // --- PASS 2: Variations (High Saturation & Vibrancy) ---
        // Sort by Saturation * Lightness (favoring bright, saturated colors)
        const sortedByVibrancy = [...colorEntries].sort((a, b) => {
          const lightnessScoreA = 1 - Math.abs(a.l - 0.55);
          const lightnessScoreB = 1 - Math.abs(b.l - 0.55);

          let scoreA = (a.s * a.s) * lightnessScoreA;
          let scoreB = (b.s * b.s) * lightnessScoreB;

          // Penalize very dark or very bright colors in this pass
          if (a.l < 0.15 || a.l > 0.90) scoreA *= 0.1;
          if (b.l < 0.15 || b.l > 0.90) scoreB *= 0.1;

          return scoreB - scoreA;
        });

        const neededVariations = maxColors - selectedColors.length;

        // Take top 50 vibrant candidates and shuffle them if randomized
        // We relax the grayscale check for variations implicitly because pickColors checks isDistinct
        // We need to manually skip grayscale for variations if we want to enforce color

        // Create a filtered vibrant list first to avoid grays in variation pass
        const vibrantCandidates = sortedByVibrancy.filter(c => !isGrayscale(c.r, c.g, c.b));

        // Fallback: if we don't have enough vibrant colors, use the original list inclusive of grays
        const sourceForVariation = vibrantCandidates.length >= neededVariations * 2 ? vibrantCandidates : sortedByVibrancy;

        // Pick variations
        pickColors(sourceForVariation, selectedColors, neededVariations, 50);

        // --- PASS 3: Fill-in (if needed) ---
        if (selectedColors.length < maxColors) {
          const neededFill = maxColors - selectedColors.length;
          // Just try to grab anything distinct from the frequency list again, looking deeper
          const deepPool = sortedByFrequency.slice(30); // Skip the ones we likely checked

          for (const candidate of deepPool) {
            if (selectedColors.length >= maxColors) break;
            if (isDistinct(candidate) && !selectedColors.some(c => c.hex === candidate.hex)) {
              selectedColors.push({
                hex: candidate.hex,
                r: candidate.r,
                g: candidate.g,
                b: candidate.b,
                score: 0
              });
            }
          }
        }

        resolve({
          colors: selectedColors.map(c => c.hex),
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





