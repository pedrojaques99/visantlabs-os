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

/**
 * Get contrast text color as hex value
 * @param backgroundColor - Hex color string (e.g., "#0C0C0C" or "0C0C0C")
 * @returns '#FFFFFF' for dark backgrounds, '#000000' for light backgrounds
 */
export function getContrastTextColor(backgroundColor: string): string {
  const contrast = getContrastColor(backgroundColor);
  return contrast === 'white' ? '#FFFFFF' : '#000000';
}

/**
 * Get muted text color based on contrast
 * @param backgroundColor - Hex color string
 * @returns Muted text color (lighter gray for dark bg, darker gray for light bg)
 */
export function getMutedTextColor(backgroundColor: string): string {
  const contrast = getContrastColor(backgroundColor);
  // For dark backgrounds, use light gray. For light backgrounds, use dark gray
  return contrast === 'white' ? '#9ca3af' : '#4b5563';
}

/**
 * Get subtle text color based on contrast
 * @param backgroundColor - Hex color string
 * @returns Subtle text color (darker gray for dark bg, lighter gray for light bg)
 */
export function getSubtleTextColor(backgroundColor: string): string {
  const contrast = getContrastColor(backgroundColor);
  // For dark backgrounds, use darker gray. For light backgrounds, use lighter gray
  return contrast === 'white' ? '#6b7280' : '#9ca3af';
}

/**
 * Calculate effective background color when using opacity/alpha
 * Blends a semi-transparent color with a base background
 * @param overlayColor - Hex color with opacity (e.g., from bg-brand-cyan/20)
 * @param baseColor - Base background color to blend with
 * @param opacity - Opacity value (0-1, e.g., 0.2 for /20)
 * @returns Effective hex color after blending
 */
export function blendColors(overlayColor: string, baseColor: string, opacity: number): string {
  try {
    const [or, og, ob] = hexToRgb(overlayColor);
    const [br, bg, bb] = hexToRgb(baseColor);
    
    // Blend: result = overlay * opacity + base * (1 - opacity)
    const r = Math.round(or * opacity + br * (1 - opacity));
    const g = Math.round(og * opacity + bg * (1 - opacity));
    const b = Math.round(ob * opacity + bb * (1 - opacity));
    
    return `#${[r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  } catch (error) {
    console.error('Error blending colors:', error);
    return baseColor;
  }
}

/**
 * Get text color for a button/textarea based on its background
 * Handles both solid colors and semi-transparent overlays
 * @param elementBgColor - Background color of the element (can be with opacity like "brand-cyan/20")
 * @param nodeBgColor - Background color of the parent node
 * @returns Appropriate text color (hex)
 */
export function getElementTextColor(elementBgColor: string, nodeBgColor: string): string {
  if (!elementBgColor || !nodeBgColor) {
    return '#e5e7eb'; // Default light text
  }
  
  // Handle opacity notation (e.g., "brand-cyan/20")
  const opacityMatch = elementBgColor.match(/\/(\d+)$/);
  let effectiveBg = elementBgColor;
  let opacity = 1;
  
  if (opacityMatch) {
    opacity = parseInt(opacityMatch[1]) / 100;
    // Remove opacity notation to get base color
    effectiveBg = elementBgColor.replace(/\/\d+$/, '');
    
    // Map common color names to hex
    const colorMap: Record<string, string> = {
      'brand-cyan': '#00d9ff',
      'green-500': '#22c55e',
      'amber-400': '#fbbf24',
      'red-500': '#ef4444',
    };
    
    if (colorMap[effectiveBg]) {
      effectiveBg = colorMap[effectiveBg];
      // Blend with node background
      effectiveBg = blendColors(effectiveBg, nodeBgColor, opacity);
    }
  }
  
  // Calculate contrast
  return getContrastTextColor(effectiveBg);
}

/**
 * Lighten a color by a specified amount
 * @param hexColor - Hex color string (e.g., "#0C0C0C" or "0C0C0C")
 * @param amount - Amount to lighten (0-1, where 0.1 = 10% lighter)
 * @returns Lightened hex color string
 */
export function lightenColor(hexColor: string, amount: number = 0.15): string {
  if (!hexColor) {
    return '#0A0A0A'; // Default fallback
  }

  try {
    // Remove # if present
    const cleanHex = hexColor.replace('#', '');
    
    // Handle both 3-digit and 6-digit hex
    let r: number, g: number, b: number;
    
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    }
    
    // Lighten by blending with white
    // Formula: newColor = originalColor + (255 - originalColor) * amount
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
    
    // Clamp values to 0-255
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    
    // Convert back to hex
    return `#${[r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  } catch (error) {
    console.error('Error lightening color:', error);
    return '#0A0A0A'; // Default fallback on error
  }
}


















