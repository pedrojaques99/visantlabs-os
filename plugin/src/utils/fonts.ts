/// <reference types="@figma/plugin-typings" />

/**
 * Font loading utilities
 */

export const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };

export async function loadFont(family: string, style: string = 'Regular'): Promise<FontName> {
  const font: FontName = { family, style };
  try {
    await figma.loadFontAsync(font);
    return font;
  } catch {
    await figma.loadFontAsync(DEFAULT_FONT);
    return DEFAULT_FONT;
  }
}

export async function loadFontVariants(family: string, styles: string[] = ['Regular', 'Bold', 'Semi Bold']): Promise<void> {
  for (const style of styles) {
    try {
      await figma.loadFontAsync({ family, style });
    } catch {
      // Silently skip unavailable styles
    }
  }
}

export async function getAvailableFontFamilies(): Promise<string[]> {
  try {
    const fonts = await figma.listAvailableFontsAsync();
    const families = new Set<string>();
    for (const f of fonts) {
      families.add(f.fontName.family);
    }
    return Array.from(families).sort();
  } catch {
    return ['Inter', 'Roboto', 'Open Sans'];
  }
}
