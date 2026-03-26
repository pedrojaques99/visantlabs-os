/// <reference types="@figma/plugin-typings" />

import type { ColorVariable, FontVariable } from '../../../src/lib/figma-types';
import { rgbToHex } from '../utils/colors';

/**
 * Get all color variables from the file
 */
export async function getColorVariablesFromFile(): Promise<ColorVariable[]> {
  const colors: ColorVariable[] = [];
  const seen = new Set<string>();

  // 1. Local color variables
  try {
    if (figma.variables && typeof figma.variables.getLocalVariablesAsync === 'function') {
      const allVariables = await figma.variables.getLocalVariablesAsync('COLOR');
      for (const variable of allVariables) {
        const value = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
        let colorHex = '#ccc';
        if (typeof value === 'object' && 'r' in value) {
          colorHex = rgbToHex((value as any).r, (value as any).g, (value as any).b);
        }
        colors.push({ id: variable.id, name: variable.name, value: colorHex });
        seen.add(colorHex);
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting color variables:', e);
  }

  // 2. Local paint styles
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    for (const style of paintStyles) {
      const paint = style.paints[0];
      if (paint?.type === 'SOLID' && paint.color) {
        const hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
        if (!seen.has(hex)) {
          colors.push({ id: style.id, name: style.name, value: hex });
          seen.add(hex);
        }
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting paint styles:', e);
  }

  // 3. Library color variables
  try {
    if (figma.teamLibrary && typeof figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync === 'function') {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      for (const col of collections) {
        const libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
        for (const libVar of libVars) {
          if (libVar.resolvedType === 'COLOR') {
            try {
              const imported = await figma.variables.importVariableByKeyAsync(libVar.key);
              if (imported && imported.valuesByMode && typeof imported.valuesByMode === 'object') {
                const modeId = Object.keys(imported.valuesByMode)[0];
                const val = imported.valuesByMode[modeId];
                if (typeof val === 'object' && val !== null && 'r' in val && 'g' in val && 'b' in val) {
                  const hex = rgbToHex((val as any).r, (val as any).g, (val as any).b);
                  if (!seen.has(hex)) {
                    colors.push({ id: imported.id, name: `${col.name}/${libVar.name}`, value: hex });
                    seen.add(hex);
                  }
                }
              }
            } catch {
              // Import may fail
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting library color variables:', e);
  }

  // 4. Colors from current selection
  try {
    const selection = figma.currentPage.selection;
    for (const node of selection) {
      if ('fills' in node && Array.isArray(node.fills)) {
        for (const fill of node.fills as ReadonlyArray<Paint>) {
          if (fill.type === 'SOLID' && (fill as SolidPaint).color) {
            const c = (fill as SolidPaint).color;
            const hex = rgbToHex(c.r, c.g, c.b);
            if (!seen.has(hex)) {
              colors.push({ id: `sel:${node.id}:fill`, name: `${node.name} (fill)`, value: hex });
              seen.add(hex);
            }
          }
        }
      }
      if ('strokes' in node && Array.isArray(node.strokes)) {
        for (const stroke of node.strokes as ReadonlyArray<Paint>) {
          if (stroke.type === 'SOLID' && (stroke as SolidPaint).color) {
            const c = (stroke as SolidPaint).color;
            const hex = rgbToHex(c.r, c.g, c.b);
            if (!seen.has(hex)) {
              colors.push({ id: `sel:${node.id}:stroke`, name: `${node.name} (stroke)`, value: hex });
              seen.add(hex);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('[Plugin] Error extracting selection colors:', e);
  }

  return colors;
}

export async function getFontVariablesFromFile(): Promise<FontVariable[]> {
  const fonts: FontVariable[] = [];
  const seen = new Set<string>();

  // 1. Local Text Styles (most common for typography)
  try {
    const textStyles = await figma.getLocalTextStylesAsync();
    for (const style of textStyles) {
      if (!seen.has(style.id)) {
        fonts.push({
          id: style.id,
          name: style.name,
          family: style.fontName.family,
          style: style.fontName.style
        });
        seen.add(style.id);
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting text styles:', e);
  }

  // 2. Local STRING variables (for design tokens)
  try {
    if (figma.variables && typeof figma.variables.getLocalVariablesAsync === 'function') {
      const allVariables = await figma.variables.getLocalVariablesAsync('STRING');
      for (const variable of allVariables) {
        const nameLower = variable.name.toLowerCase();
        if (nameLower.includes('font') || nameLower.includes('typeface') || nameLower.includes('typography')) {
          if (!seen.has(variable.id)) {
            fonts.push({
              id: variable.id,
              name: variable.name
            });
            seen.add(variable.id);
          }
        }
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting font variables:', e);
  }

  return fonts;
}

/**
 * Get available font families
 */
export async function getAvailableFontFamilies(): Promise<string[]> {
  try {
    const fonts = await figma.listAvailableFontsAsync();
    const families = new Set<string>();
    for (const f of fonts) {
      families.add(f.fontName.family);
    }
    return [...families].sort();
  } catch {
    return [];
  }
}
