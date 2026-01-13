/**
 * Convert hex color to RGB
 * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns RGB values as [r, g, b]
 */
function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Handle 3-digit hex
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return [r, g, b];
  }
  
  // Handle 6-digit hex
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Calculate relative luminance according to WCAG 2.1
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Relative luminance (0-1)
 */
function getLuminance(r: number, g: number, b: number): number {
  // Normalize RGB values to 0-1
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  // Calculate relative luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Get contrast color (white or black) for a given background color
 * Uses WCAG 2.1 contrast ratio formula
 * @param backgroundColor - Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns 'white' if background is dark, 'black' if background is light
 */
export function getContrastColor(backgroundColor: string): 'white' | 'black' {
  if (!backgroundColor) {
    return 'black'; // Default to black text
  }
  
  try {
    const [r, g, b] = hexToRgb(backgroundColor);
    const luminance = getLuminance(r, g, b);
    
    // If luminance is less than 0.5, background is dark, use white text
    // Otherwise, background is light, use black text
    return luminance < 0.5 ? 'white' : 'black';
  } catch (error) {
    console.error('Error calculating contrast color:', error);
    return 'black'; // Default to black text on error
  }
}


















