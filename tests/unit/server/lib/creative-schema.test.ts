import { describe, it, expect } from 'vitest';
import {
  CreativeAIResponseSchema,
  clampLayerBounds,
} from '../../../../server/lib/creative-schema.js';

describe('CreativeAIResponseSchema', () => {
  const validPlan = {
    background: { prompt: 'studio shot' },
    overlay: { type: 'gradient', direction: 'bottom', opacity: 0.5, color: '#000000' },
    layers: [
      {
        type: 'text',
        content: 'Hello',
        role: 'headline',
        position: { x: 0.1, y: 0.1 },
        size: { w: 0.8, h: 0.1 },
        align: 'left',
        fontSize: 64,
        color: '#ffffff',
        bold: true,
      },
    ],
  };

  it('accepts a valid plan', () => {
    const r = CreativeAIResponseSchema.safeParse(validPlan);
    expect(r.success).toBe(true);
  });

  it('rejects positions outside [0,1]', () => {
    const bad = {
      ...validPlan,
      layers: [{ ...validPlan.layers[0], position: { x: 1.5, y: 0.1 } }],
    };
    const r = CreativeAIResponseSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it('rejects malformed hex colors', () => {
    const bad = { ...validPlan, layers: [{ ...validPlan.layers[0], color: 'red' }] };
    const r = CreativeAIResponseSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it('rejects empty layers array', () => {
    const r = CreativeAIResponseSchema.safeParse({ ...validPlan, layers: [] });
    expect(r.success).toBe(false);
  });

  it('discriminates layer types', () => {
    const r = CreativeAIResponseSchema.safeParse({
      ...validPlan,
      layers: [{ type: 'unknown', position: { x: 0, y: 0 }, size: { w: 0.1, h: 0.1 } }],
    });
    expect(r.success).toBe(false);
  });
});

describe('clampLayerBounds', () => {
  it('shrinks layer width when x+w exceeds 1', () => {
    const plan = CreativeAIResponseSchema.parse({
      layers: [
        {
          type: 'shape',
          shape: 'rect',
          color: '#ff0000',
          position: { x: 0.9, y: 0 },
          size: { w: 0.5, h: 0.1 },
        },
      ],
    });
    const clamped = clampLayerBounds(plan);
    expect(clamped.layers[0].size.w).toBeCloseTo(0.1);
  });

  it('preserves layers already in bounds', () => {
    const plan = CreativeAIResponseSchema.parse({
      layers: [
        {
          type: 'shape',
          shape: 'rect',
          color: '#ff0000',
          position: { x: 0.1, y: 0.1 },
          size: { w: 0.5, h: 0.3 },
        },
      ],
    });
    const clamped = clampLayerBounds(plan);
    expect(clamped.layers[0].position).toEqual({ x: 0.1, y: 0.1 });
    expect(clamped.layers[0].size).toEqual({ w: 0.5, h: 0.3 });
  });
});
