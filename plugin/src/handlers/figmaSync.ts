/// <reference types="@figma/plugin-typings" />
/**
 * Figma Sync Handlers - Extract/push data for brand guideline sync
 */

import { rgbToHex } from '../utils/colors';
import { getAgentComponents } from './operations';

export interface FigmaSyncData {
  fileKey: string;
  variables: {
    colors: Array<{ id: string; name: string; value: string }>;
    numbers: Array<{ id: string; name: string; value: number }>;
  };
  styles: {
    colors: Array<{ id: string; name: string; value: string }>;
    text: Array<{ id: string; name: string; family: string; style: string; size: number }>;
    effects: Array<{ id: string; name: string; shadows: any }>;
  };
  components: Array<{ id: string; key: string; name: string; metadata: any }>;
}

/**
 * Extract all design system data from current file for sync
 */
export async function extractForSync(): Promise<FigmaSyncData> {
  const fileKey = figma.fileKey || 'unknown';

  const data: FigmaSyncData = {
    fileKey,
    variables: { colors: [], numbers: [] },
    styles: { colors: [], text: [], effects: [] },
    components: [],
  };

  // 1. Extract color variables
  try {
    if (figma.variables?.getLocalVariablesAsync) {
      const colorVars = await figma.variables.getLocalVariablesAsync('COLOR');
      for (const v of colorVars) {
        const modeId = Object.keys(v.valuesByMode)[0];
        const val = v.valuesByMode[modeId];
        if (typeof val === 'object' && 'r' in val) {
          data.variables.colors.push({
            id: v.id,
            name: v.name,
            value: rgbToHex((val as any).r, (val as any).g, (val as any).b),
          });
        }
      }
    }
  } catch (e) {
    console.log('[FigmaSync] Error extracting color variables:', e);
  }

  // 2. Extract number variables (spacing, radius)
  try {
    if (figma.variables?.getLocalVariablesAsync) {
      const floatVars = await figma.variables.getLocalVariablesAsync('FLOAT');
      for (const v of floatVars) {
        const modeId = Object.keys(v.valuesByMode)[0];
        const val = v.valuesByMode[modeId];
        if (typeof val === 'number') {
          data.variables.numbers.push({
            id: v.id,
            name: v.name,
            value: val,
          });
        }
      }
    }
  } catch (e) {
    console.log('[FigmaSync] Error extracting number variables:', e);
  }

  // 3. Extract paint styles (colors)
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    for (const style of paintStyles) {
      const paint = style.paints[0];
      if (paint?.type === 'SOLID' && paint.color) {
        data.styles.colors.push({
          id: style.id,
          name: style.name,
          value: rgbToHex(paint.color.r, paint.color.g, paint.color.b),
        });
      }
    }
  } catch (e) {
    console.log('[FigmaSync] Error extracting paint styles:', e);
  }

  // 4. Extract text styles
  try {
    const textStyles = await figma.getLocalTextStylesAsync();
    for (const style of textStyles) {
      data.styles.text.push({
        id: style.id,
        name: style.name,
        family: style.fontName.family,
        style: style.fontName.style,
        size: style.fontSize,
      });
    }
  } catch (e) {
    console.log('[FigmaSync] Error extracting text styles:', e);
  }

  // 5. Extract effect styles (shadows)
  try {
    const effectStyles = await figma.getLocalEffectStylesAsync();
    for (const style of effectStyles) {
      const shadows = style.effects
        .filter((e: Effect) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW')
        .map((e: Effect) => {
          const shadow = e as DropShadowEffect;
          return {
            type: e.type,
            color: shadow.color ? rgbToHex(shadow.color.r, shadow.color.g, shadow.color.b) : '#000',
            opacity: shadow.color?.a ?? 1,
            x: shadow.offset?.x ?? 0,
            y: shadow.offset?.y ?? 0,
            blur: shadow.radius ?? 0,
            spread: shadow.spread ?? 0,
          };
        });

      if (shadows.length > 0) {
        data.styles.effects.push({
          id: style.id,
          name: style.name,
          shadows,
        });
      }
    }
  } catch (e) {
    console.log('[FigmaSync] Error extracting effect styles:', e);
  }

  // 6. Extract @agent:* components
  try {
    const agentComponents = await getAgentComponents();
    data.components = agentComponents.map((c: any) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      metadata: c.metadata,
    }));
  } catch (e) {
    console.log('[FigmaSync] Error extracting agent components:', e);
  }

  return data;
}

/**
 * Push brand guideline data to Figma as Variables
 */
export async function pushToFigma(guideline: any): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Get or create "Brand Tokens" collection
  let collection: VariableCollection | null = null;
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    collection = collections.find(c => c.name === 'Brand Tokens') || null;

    if (!collection) {
      collection = figma.variables.createVariableCollection('Brand Tokens');
      created++;
    }
  } catch (e) {
    console.log('[FigmaSync] Error getting/creating collection:', e);
    throw new Error('Failed to create Brand Tokens collection');
  }

  const modeId = collection.modes[0].modeId;

  // Helper to create or update variable
  const upsertVariable = async (
    name: string,
    type: VariableResolvedDataType,
    value: any
  ) => {
    try {
      const existingVars = await figma.variables.getLocalVariablesAsync(type);
      const existing = existingVars.find(v =>
        v.name === name && v.variableCollectionId === collection!.id
      );

      if (existing) {
        existing.setValueForMode(modeId, value);
        updated++;
      } else {
        const newVar = figma.variables.createVariable(name, collection!.id, type);
        newVar.setValueForMode(modeId, value);
        created++;
      }
    } catch (e) {
      console.log(`[FigmaSync] Error upserting variable ${name}:`, e);
    }
  };

  // Push colors
  if (guideline.colors) {
    for (const color of guideline.colors) {
      const name = `Colors/${color.name || 'Unnamed'}`;
      // Parse hex to RGB
      const hex = color.hex?.replace('#', '') || '888888';
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      await upsertVariable(name, 'COLOR', { r, g, b });
    }
  }

  // Push spacing tokens
  if (guideline.tokens?.spacing) {
    for (const [key, value] of Object.entries(guideline.tokens.spacing)) {
      const name = `Spacing/${key}`;
      await upsertVariable(name, 'FLOAT', value as number);
    }
  }

  // Push radius tokens
  if (guideline.tokens?.radius) {
    for (const [key, value] of Object.entries(guideline.tokens.radius)) {
      const name = `Radius/${key}`;
      await upsertVariable(name, 'FLOAT', value as number);
    }
  }

  return { created, updated };
}
