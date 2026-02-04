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
 * Normalize color string to hex (handles Tailwind color names, hex values, oklch, etc)
 * @param color - Color string (hex, Tailwind name, oklch, or CSS variable)
 * @returns Hex color string
 */
function normalizeColorToHex(color: string): string {
  if (!color) return '#00d9ff'; // Default brand-cyan
  
  // If already hex, return as is
  if (color.startsWith('#')) {
    return color;
  }
  
  // If it's a CSS variable reference, try to get computed value
  if (color.startsWith('var(') || color.startsWith('--')) {
    // Try to get computed value from document
    if (typeof document !== 'undefined') {
      try {
        const root = document.documentElement;
        const varName = color.startsWith('var(') 
          ? color.replace('var(', '').replace(')', '').trim()
          : color;
        const computed = getComputedStyle(root).getPropertyValue(varName).trim();
        if (computed) {
          return normalizeColorToHex(computed); // Recursively normalize
        }
      } catch {
        // Fall through to default
      }
    }
    return '#00d9ff';
  }
  
  // Handle oklch format - try to get from CSS variable if it's brand-cyan
  if (color.startsWith('oklch')) {
    // If it's the default brand-cyan oklch, try to get computed value
    if (typeof document !== 'undefined') {
      try {
        const root = document.documentElement;
        const computed = getComputedStyle(root).getPropertyValue('--brand-cyan').trim();
        if (computed && computed.startsWith('#')) {
          return computed;
        }
      } catch {
        // Fall through
      }
    }
    return '#00d9ff';
  }
  
  // Map common Tailwind color names to hex or try to get from CSS variable
  if (color === 'brand-cyan') {
    // Try to get from CSS variable and convert to hex
    if (typeof document !== 'undefined') {
      try {
        const root = document.documentElement;
        const tempEl = document.createElement('div');
        tempEl.style.color = 'var(--brand-cyan)';
        root.appendChild(tempEl);
        const computed = getComputedStyle(tempEl).color;
        root.removeChild(tempEl);
        
        // Convert rgb/rgba to hex
        if (computed && computed.startsWith('rgb')) {
          const rgbMatch = computed.match(/\d+/g);
          if (rgbMatch && rgbMatch.length >= 3) {
            const r = parseInt(rgbMatch[0]);
            const g = parseInt(rgbMatch[1]);
            const b = parseInt(rgbMatch[2]);
            return `#${[r, g, b].map(x => {
              const hex = x.toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('')}`;
          }
        }
      } catch {
        // Fall through to default
      }
    }
    return '#00d9ff';
  }
  
  // If it's not a known format, try to use as-is (might be hex without #)
  // If it looks like it could be a color, try to parse it
  return color;
}

/**
 * Calculate contrast ratio between two colors (WCAG 2.1)
 * @param color1 - First color (hex)
 * @param color2 - Second color (hex)
 * @returns Contrast ratio (1.0 to 21.0)
 */
function getContrastRatio(color1: string, color2: string): number {
  try {
    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);
    
    const lum1 = getLuminance(r1, g1, b1);
    const lum2 = getLuminance(r2, g2, b2);
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return 1; // Minimum contrast on error
  }
}

/**
 * Darken a color by a specified amount
 * @param hexColor - Hex color string
 * @param amount - Amount to darken (0-1, where 0.5 = 50% darker)
 * @returns Darkened hex color string
 */
function darkenColor(hexColor: string, amount: number = 0.4): string {
  if (!hexColor) return '#000000';
  
  try {
    const [r, g, b] = hexToRgb(hexColor);
    const darkenedR = Math.round(r * (1 - amount));
    const darkenedG = Math.round(g * (1 - amount));
    const darkenedB = Math.round(b * (1 - amount));
    
    return `#${[darkenedR, darkenedG, darkenedB].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  } catch {
    return hexColor;
  }
}

/**
 * Get accent color based on background contrast and user brand color
 * Automatically adjusts to ensure adequate contrast in both light and dark modes
 * @param backgroundColor - Hex color string
 * @param brandColor - User configured brand color (hex, name, or CSS variable)
 * @returns Accent color that works with the background with adequate contrast
 */
function getAccentColor(backgroundColor: string, brandColor?: string): string {
  const isDark = getContrastColor(backgroundColor) === 'white';
  
  // Normalize brand color to hex
  let normalizedBrand = '#00d9ff'; // Default
  if (brandColor) {
    normalizedBrand = normalizeColorToHex(brandColor);
    // If normalization didn't work (still not hex), try to get from CSS
    if (!normalizedBrand.startsWith('#')) {
      normalizedBrand = '#00d9ff';
    }
  }
  
  // Target contrast ratio (WCAG AA requires 4.5:1 for normal text, 3:1 for large text)
  // We aim for at least 3:1 for accent colors
  const minContrast = 3.0;
  
  if (isDark) {
    // For dark backgrounds, check if brand color has enough contrast
    let contrast = getContrastRatio(normalizedBrand, backgroundColor);
    
    if (contrast >= minContrast) {
      // Brand color has adequate contrast, use as-is
      return normalizedBrand;
    } else {
      // Need to lighten the brand color for better contrast
      // Try progressively lighter versions
      for (let lightenAmount = 0.1; lightenAmount <= 0.8; lightenAmount += 0.1) {
        const lightened = lightenColor(normalizedBrand, lightenAmount);
        contrast = getContrastRatio(lightened, backgroundColor);
        if (contrast >= minContrast) {
          return lightened;
        }
      }
      // Fallback: use a very light version
      return lightenColor(normalizedBrand, 0.7);
    }
  } else {
    // For light backgrounds, darken the brand color for better contrast
    let contrast = getContrastRatio(normalizedBrand, backgroundColor);
    
    if (contrast >= minContrast) {
      // Brand color already has adequate contrast
      return normalizedBrand;
    } else {
      // Need to darken the brand color for better contrast
      // Try progressively darker versions
      for (let darkenAmount = 0.2; darkenAmount <= 0.7; darkenAmount += 0.1) {
        const darkened = darkenColor(normalizedBrand, darkenAmount);
        contrast = getContrastRatio(darkened, backgroundColor);
        if (contrast >= minContrast) {
          return darkened;
        }
      }
      // Fallback: use a very dark version
      return darkenColor(normalizedBrand, 0.6);
    }
  }
}

/**
 * Get adaptive secondary brand color that automatically adjusts for contrast
 * This creates a complementary/secondary accent color that works in both light and dark modes
 * @param backgroundColor - Hex color string of the background
 * @param brandColor - User configured primary brand color (hex, name, or CSS variable)
 * @returns Secondary brand color that adapts to light/dark mode with adequate contrast
 */
export function getAdaptiveBrandColor(backgroundColor: string, brandColor?: string): string {
  const isDark = getContrastColor(backgroundColor) === 'white';
  
  // Normalize brand color to hex
  let normalizedBrand = '#00d9ff'; // Default
  if (brandColor) {
    normalizedBrand = normalizeColorToHex(brandColor);
    if (!normalizedBrand.startsWith('#')) {
      normalizedBrand = '#00d9ff';
    }
  }
  
  // For secondary brand color, we create a variation that:
  // - In dark mode: slightly lighter/more saturated version
  // - In light mode: darker/more muted version
  // Both ensure adequate contrast
  
  const minContrast = 3.0;
  
  if (isDark) {
    // Dark mode: create a lighter, more vibrant secondary color
    // Start with a lighter version
    let secondary = lightenColor(normalizedBrand, 0.15);
    let contrast = getContrastRatio(secondary, backgroundColor);
    
    // If not enough contrast, lighten more
    if (contrast < minContrast) {
      for (let amount = 0.2; amount <= 0.5; amount += 0.1) {
        secondary = lightenColor(normalizedBrand, amount);
        contrast = getContrastRatio(secondary, backgroundColor);
        if (contrast >= minContrast) {
          return secondary;
        }
      }
      // Fallback: very light version
      return lightenColor(normalizedBrand, 0.4);
    }
    
    return secondary;
  } else {
    // Light mode: create a darker, more muted secondary color
    // Start with a darker version
    let secondary = darkenColor(normalizedBrand, 0.3);
    let contrast = getContrastRatio(secondary, backgroundColor);
    
    // If not enough contrast, darken more
    if (contrast < minContrast) {
      for (let amount = 0.4; amount <= 0.7; amount += 0.1) {
        secondary = darkenColor(normalizedBrand, amount);
        contrast = getContrastRatio(secondary, backgroundColor);
        if (contrast >= minContrast) {
          return secondary;
        }
      }
      // Fallback: very dark version
      return darkenColor(normalizedBrand, 0.6);
    }
    
    return secondary;
  }
}

/**
 * Get all text colors based on background contrast
 * @param backgroundColor - Hex color string (e.g., "#0C0C0C" or "0C0C0C")
 * @param brandColor - Optional user configured brand color
 * @returns Object with primary, muted, subtle, accent, and secondaryAccent text colors
 */
export function getTextColors(backgroundColor: string, brandColor?: string): {
  primary: string;
  muted: string;
  subtle: string;
  accent: string;
  secondaryAccent: string;
} {
  const isDark = getContrastColor(backgroundColor) === 'white';
  
  return {
    primary: isDark ? '#FFFFFF' : '#000000',
    muted: isDark ? '#9ca3af' : '#4b5563',
    subtle: isDark ? '#6b7280' : '#9ca3af',
    accent: getAccentColor(backgroundColor, brandColor),
    secondaryAccent: getAdaptiveBrandColor(backgroundColor, brandColor),
  };
}

/**
 * Get contrast text color as hex value
 * @param backgroundColor - Hex color string (e.g., "#0C0C0C" or "0C0C0C")
 * @returns '#FFFFFF' for dark backgrounds, '#000000' for light backgrounds
 */
export function getContrastTextColor(backgroundColor: string): string {
  return getTextColors(backgroundColor).primary;
}

/**
 * Get muted text color based on contrast
 * @param backgroundColor - Hex color string
 * @returns Muted text color (lighter gray for dark bg, darker gray for light bg)
 */
export function getMutedTextColor(backgroundColor: string): string {
  return getTextColors(backgroundColor).muted;
}

/**
 * Get subtle text color based on contrast
 * @param backgroundColor - Hex color string
 * @returns Subtle text color (darker gray for dark bg, lighter gray for light bg)
 */
export function getSubtleTextColor(backgroundColor: string): string {
  return getTextColors(backgroundColor).subtle;
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


















