/**
 * Analyzes an image to extract color information and generate recommendations
 * for better contrast and color matching in mockups
 */

export interface ImageAnalysis {
  dominantColors: string[]; // Hex colors
  averageBrightness: number; // 0-255
  isLight: boolean;
  contrast: 'high' | 'medium' | 'low';
  recommendedBackground: 'light' | 'dark' | 'neutral';
  colorRecommendations: string;
}

/**
 * Analyze image from base64 to extract color information
 */
export async function analyzeImage(base64: string, mimeType: string = 'image/png'): Promise<ImageAnalysis> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
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

        // Analyze colors
        const colorMap = new Map<string, number>();
        let totalBrightness = 0;
        let pixelCount = 0;

        // Sample pixels (every 10th pixel for performance)
        for (let i = 0; i < pixels.length; i += 40) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          totalBrightness += brightness;
          pixelCount++;

          // Quantize colors to reduce palette
          const quantizedR = Math.round(r / 32) * 32;
          const quantizedG = Math.round(g / 32) * 32;
          const quantizedB = Math.round(b / 32) * 32;
          const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

          colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
        }

        const averageBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 128;
        const isLight = averageBrightness > 128;

        // Get dominant colors (top 3)
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        const dominantColors = sortedColors.map(([colorKey]) => {
          const [r, g, b] = colorKey.split(',').map(Number);
          return rgbToHex(r, g, b);
        });

        // Calculate contrast (difference between lightest and darkest areas)
        let minBrightness = 255;
        let maxBrightness = 0;
        for (let i = 0; i < pixels.length; i += 40) {
          const a = pixels[i + 3];
          if (a < 128) continue;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          minBrightness = Math.min(minBrightness, brightness);
          maxBrightness = Math.max(maxBrightness, brightness);
        }

        const brightnessRange = maxBrightness - minBrightness;
        let contrast: 'high' | 'medium' | 'low';
        if (brightnessRange > 150) {
          contrast = 'high';
        } else if (brightnessRange > 80) {
          contrast = 'medium';
        } else {
          contrast = 'low';
        }

        // Recommend background based on image characteristics
        let recommendedBackground: 'light' | 'dark' | 'neutral';
        if (isLight) {
          // Light design works better on dark/neutral backgrounds
          recommendedBackground = contrast === 'low' ? 'dark' : 'neutral';
        } else {
          // Dark design works better on light/neutral backgrounds
          recommendedBackground = contrast === 'low' ? 'light' : 'neutral';
        }

        // Generate color recommendations text
        const colorRecommendations = generateColorRecommendations(
          dominantColors,
          averageBrightness,
          isLight,
          contrast,
          recommendedBackground
        );

        resolve({
          dominantColors,
          averageBrightness,
          isLight,
          contrast,
          recommendedBackground,
          colorRecommendations,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for analysis'));
    };

    img.src = dataUrl;
  });
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
 * Generate color recommendations text for the prompt
 */
function generateColorRecommendations(
  dominantColors: string[],
  averageBrightness: number,
  isLight: boolean,
  contrast: 'high' | 'medium' | 'low',
  recommendedBackground: 'light' | 'dark' | 'neutral'
): string {
  const recommendations: string[] = [];

  // Background recommendation
  if (recommendedBackground === 'light') {
    recommendations.push('Use a light, bright background to create strong contrast with the dark design elements');
  } else if (recommendedBackground === 'dark') {
    recommendations.push('Use a dark or deep background to create strong contrast with the light design elements');
  } else {
    recommendations.push('Use a neutral background (gray, beige, or soft tones) that complements the design without competing');
  }

  // Contrast enhancement
  if (contrast === 'low') {
    recommendations.push('Ensure high contrast between the design and background for maximum visibility and readability');
  } else if (contrast === 'medium') {
    recommendations.push('Maintain good contrast between design elements and background for clear visibility');
  }

  // Color harmony
  if (dominantColors.length > 0) {
    const colorDesc = dominantColors.slice(0, 2).join(' and ');
    recommendations.push(`The design features ${colorDesc} as dominant colors - ensure the mockup environment complements these colors without clashing`);
  }

  // Brightness adjustment
  if (isLight && averageBrightness > 200) {
    recommendations.push('Design is very light - use darker background tones to ensure the design stands out clearly');
  } else if (!isLight && averageBrightness < 60) {
    recommendations.push('Design is very dark - use lighter background tones to ensure the design is clearly visible');
  }

  return recommendations.join('. ') + '.';
}

/**
 * Enhance mockup prompt with color analysis recommendations
 */
export function enhanceMockupPrompt(originalPrompt: string, analysis: ImageAnalysis): string {
  // If prompt is JSON (structured), we need to parse and enhance it
  let enhancedPrompt = originalPrompt;
  
  try {
    // Try to parse as JSON first
    const promptData = JSON.parse(originalPrompt);
    if (promptData && typeof promptData === 'object') {
      // It's a structured prompt - enhance the style section
      if (promptData.image?.style) {
        if (!promptData.image.style.effects) {
          promptData.image.style.effects = '';
        }
        promptData.image.style.effects += ' ' + analysis.colorRecommendations;
      } else if (promptData.image) {
        promptData.image.style = {
          effects: analysis.colorRecommendations,
        };
      }
      
      // Enhance lighting if needed
      if (promptData.image?.lighting) {
        if (analysis.recommendedBackground === 'light') {
          promptData.image.lighting.contrast = 'High contrast lighting to emphasize dark design on light background';
        } else if (analysis.recommendedBackground === 'dark') {
          promptData.image.lighting.contrast = 'High contrast lighting to emphasize light design on dark background';
        }
      }
      
      enhancedPrompt = JSON.stringify(promptData);
    } else {
      // Not valid JSON, treat as plain text
      enhancedPrompt = `${originalPrompt} ${analysis.colorRecommendations}`;
    }
  } catch {
    // Not JSON, treat as plain text prompt
    enhancedPrompt = `${originalPrompt} ${analysis.colorRecommendations}`;
  }

  return enhancedPrompt;
}




























