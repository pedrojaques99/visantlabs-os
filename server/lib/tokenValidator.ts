// server/lib/tokenValidator.ts

import type { Operation } from './pluginBridge.js';
import type { TokenRegistry, RGB } from './tokenRegistry.js';
import { rgbToHex } from './tokenRegistry.js';
import { findClosestColor, findClosestNumber, colorInPalette, numberInTokens } from './tokenMatcher.js';

export interface Correction {
  operationIndex: number;
  field: string;
  original: any;
  corrected: any;
  tokenUsed: string;
  reason: string;
}

export interface TokenValidationResult {
  operations: Operation[];
  corrections: Correction[];
  isValid: boolean;
}

/**
 * Validate and correct operations against token registry
 */
export function validateOperations(
  operations: Operation[],
  registry: TokenRegistry
): TokenValidationResult {
  const corrections: Correction[] = [];
  const validatedOps: Operation[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const corrected = validateOperation(op, registry, i, corrections);
    validatedOps.push(corrected);
  }

  return {
    operations: validatedOps,
    corrections,
    isValid: corrections.length === 0,
  };
}

function validateOperation(
  op: Operation,
  registry: TokenRegistry,
  index: number,
  corrections: Correction[]
): Operation {
  // Deep clone to avoid mutating original
  const result = JSON.parse(JSON.stringify(op));

  // Skip MESSAGE operations
  if (op.type === 'MESSAGE') return result;

  // Validate props if present
  if ('props' in result && result.props) {
    validateProps(result.props, registry, index, corrections);
  }

  // Validate fills/strokes on SET_FILL, SET_STROKE
  if (result.type === 'SET_FILL' && result.fills) {
    validateFills(result.fills, registry, index, corrections);
  }
  if (result.type === 'SET_STROKE' && result.strokes) {
    validateFills(result.strokes, registry, index, corrections, 'strokes');
  }

  // Validate cornerRadius on SET_CORNER_RADIUS
  if (result.type === 'SET_CORNER_RADIUS' && typeof result.cornerRadius === 'number') {
    const validated = validateNumber(result.cornerRadius, registry.radius, `cornerRadius`);
    if (validated.corrected) {
      corrections.push({
        operationIndex: index,
        field: 'cornerRadius',
        original: result.cornerRadius,
        corrected: validated.value,
        tokenUsed: validated.token!,
        reason: 'Radius mais próximo no token',
      });
      result.cornerRadius = validated.value;
    }
  }

  return result;
}

function validateProps(
  props: any,
  registry: TokenRegistry,
  index: number,
  corrections: Correction[]
): void {
  // Validate fills
  if (props.fills && Array.isArray(props.fills)) {
    validateFills(props.fills, registry, index, corrections);
  }

  // Validate strokes
  if (props.strokes && Array.isArray(props.strokes)) {
    validateFills(props.strokes, registry, index, corrections, 'strokes');
  }

  // Validate cornerRadius
  if (typeof props.cornerRadius === 'number' && registry.radius.size > 0) {
    const validated = validateNumber(props.cornerRadius, registry.radius, 'cornerRadius');
    if (validated.corrected) {
      corrections.push({
        operationIndex: index,
        field: 'props.cornerRadius',
        original: props.cornerRadius,
        corrected: validated.value,
        tokenUsed: validated.token!,
        reason: 'Radius mais próximo',
      });
      props.cornerRadius = validated.value;
    }
  }

  // Validate spacing fields
  const spacingFields = ['itemSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  for (const field of spacingFields) {
    if (typeof props[field] === 'number' && registry.spacing.size > 0) {
      const validated = validateNumber(props[field], registry.spacing, field);
      if (validated.corrected) {
        corrections.push({
          operationIndex: index,
          field: `props.${field}`,
          original: props[field],
          corrected: validated.value,
          tokenUsed: validated.token!,
          reason: 'Spacing mais próximo',
        });
        props[field] = validated.value;
      }
    }
  }

  // Validate fontSize against typography tokens
  if (typeof props.fontSize === 'number' && registry.typography.size > 0) {
    const sizes = new Map<string, { name: string; value: number; source: 'mongodb' | 'figma-json' }>();
    for (const [name, token] of registry.typography) {
      if (token.value?.size) {
        sizes.set(name, { name, value: token.value.size, source: token.source });
      }
    }
    if (sizes.size > 0) {
      const validated = validateNumber(props.fontSize, sizes as any, 'fontSize');
      if (validated.corrected) {
        corrections.push({
          operationIndex: index,
          field: 'props.fontSize',
          original: props.fontSize,
          corrected: validated.value,
          tokenUsed: validated.token!,
          reason: 'Font size mais próximo',
        });
        props.fontSize = validated.value;
      }
    }
  }
}

function validateFills(
  fills: any[],
  registry: TokenRegistry,
  index: number,
  corrections: Correction[],
  fieldName = 'fills'
): void {
  if (registry.colors.size === 0) return;

  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    if (fill.type === 'SOLID' && fill.color) {
      const rgb: RGB = fill.color;
      const existingToken = colorInPalette(rgb, registry.colors);

      if (!existingToken) {
        // Color not in palette, find closest
        const closest = findClosestColor(rgb, registry.colors);
        if (closest) {
          corrections.push({
            operationIndex: index,
            field: `props.${fieldName}[${i}].color`,
            original: rgbToHex(rgb),
            corrected: rgbToHex(closest.rgb),
            tokenUsed: closest.token,
            reason: 'Cor mais próxima na paleta',
          });
          fill.color = closest.rgb;
        }
      }
    }
  }
}

function validateNumber(
  value: number,
  tokens: Map<string, any>,
  fieldName: string
): { value: number; corrected: boolean; token?: string } {
  const existing = numberInTokens(value, tokens);
  if (existing) {
    return { value, corrected: false };
  }

  const closest = findClosestNumber(value, tokens);
  if (closest) {
    return { value: closest.value, corrected: true, token: closest.token };
  }

  return { value, corrected: false };
}

/**
 * Format corrections for user-friendly message
 */
export function formatCorrections(corrections: Correction[]): string {
  return corrections
    .map(c => `- ${c.field}: ${c.original} -> ${c.corrected} (${c.tokenUsed})`)
    .join('\n');
}
