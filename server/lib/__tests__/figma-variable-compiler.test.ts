import { describe, it, expect } from 'vitest';
import { compileFigmaVariables } from '../figma-variable-compiler.js';

const brand: any = {
  identity: { name: 'Lola' },
  colors: [
    { hex: '#7C3AED', role: 'accent', name: 'Roxo' },
    { hex: '#111111', role: 'text', name: 'Tinta' },
    { hex: '#FFFFFF', role: 'background', name: 'Papel' },
  ],
  typography: [
    { family: 'Fraunces', role: 'heading' },
    { family: 'Inter', role: 'body' },
  ],
  tokens: { radius: { sm: 4, md: 8, lg: 16 } },
};

describe('compileFigmaVariables', () => {
  it('maps brand roles to semantic variable values', () => {
    const out = compileFigmaVariables(brand);
    expect(out.collectionName).toBe('Brand');
    expect(out.modeName).toBe('Lola');
    const byName = Object.fromEntries(out.values.map((v) => [v.name, v]));

    // accent (purple) → RGB 0–1
    expect(byName.accent.type).toBe('COLOR');
    expect((byName.accent.value as any).r).toBeCloseTo(124 / 255, 3);

    // fonts
    expect(byName['heading-font'].value).toBe('Fraunces');
    expect(byName['body-font'].value).toBe('Inter');

    // radius floats
    expect(byName['radius-md'].value).toBe(8);
  });

  it('computes accent-text for contrast (white on a dark purple accent)', () => {
    const out = compileFigmaVariables(brand);
    const at = out.values.find((v) => v.name === 'accent-text')!.value as any;
    expect(at).toEqual({ r: 1, g: 1, b: 1, a: 1 }); // dark accent → white text
  });

  it('picks black accent-text on a light accent', () => {
    const out = compileFigmaVariables({
      ...brand,
      colors: [{ hex: '#FFEB3B', role: 'accent' }],
    } as any);
    const at = out.values.find((v) => v.name === 'accent-text')!.value as any;
    expect(at).toEqual({ r: 0, g: 0, b: 0, a: 1 }); // light accent → black text
  });

  it('only emits tokens the brand provides (no fabrication)', () => {
    const out = compileFigmaVariables({
      identity: { name: 'Bare' },
      colors: [{ hex: '#FF0000' }],
    } as any);
    const names = out.values.map((v) => v.name);
    expect(names).toContain('accent'); // from first color
    expect(names).not.toContain('radius-md'); // no tokens provided
    expect(names).not.toContain('heading-font'); // no typography
  });

  it('lets the brand mode name be overridden', () => {
    const out = compileFigmaVariables(brand, { modeName: 'Lola — Dark' });
    expect(out.modeName).toBe('Lola — Dark');
  });
});
