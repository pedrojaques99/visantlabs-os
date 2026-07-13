import { describe, it, expect } from 'vitest';
import { buildBrandContext, buildBrandContextForImageGen } from '../brandContextBuilder.js';

// Sample brand whose typography would previously leak "Fraunces SemiBold 40px"
// onto the generated artwork (a diffusion model prints font specs as label text).
const brand = {
  identity: { name: 'Aurora Coffee', tagline: 'Slow mornings, bright ideas.' },
  colors: [{ name: 'Amber', hex: '#D97706', role: 'primary' }],
  typography: [
    { role: 'heading', family: 'Fraunces', style: 'SemiBold', size: 40 },
    { role: 'body', family: 'Inter', size: 16 },
  ],
} as any;

describe('buildBrandContextForImageGen — typography artifact fix', () => {
  const ctx = buildBrandContextForImageGen(brand);

  it('never emits font names, weights or px sizes (would be printed on the art)', () => {
    expect(ctx).not.toMatch(/Fraunces/i);
    expect(ctx).not.toMatch(/Inter/i);
    expect(ctx).not.toMatch(/SemiBold/i);
    expect(ctx).not.toMatch(/\d+px/);
    expect(ctx).not.toContain('FONTS:');
  });

  it('emits a serif/sans vibe instead', () => {
    expect(ctx).toMatch(/TYPOGRAPHY VIBE/);
    expect(ctx.toLowerCase()).toContain('serif');
  });

  it('still carries colors + logo-less brand identity', () => {
    expect(ctx).toContain('Aurora Coffee');
    expect(ctx).toContain('#D97706');
  });
});

describe('buildBrandContext — default spec mode unchanged (regression guard)', () => {
  it('LLM/design-tool context keeps the full font spec', () => {
    const ctx = buildBrandContext(brand);
    expect(ctx).toContain('FONTS:');
    expect(ctx).toContain('Fraunces');
    expect(ctx).toContain('40px');
  });
});
