import { describe, it, expect } from 'vitest';
import { brandToPresetVars, brandToFonts } from '../preset-vars.js';
import { getWebPreset, listWebPresets } from '../preset-registry.js';

const brand: any = {
  identity: { name: 'Lola' },
  colors: [
    { hex: '#766CFF', role: 'accent' },
    { hex: '#111111', role: 'text' },
    { hex: '#EFEFEF', role: 'background' },
  ],
  typography: [
    { family: 'Geist', role: 'heading' },
    { family: 'Open Sans', role: 'body' },
  ],
  tokens: { radius: { lg: 40 } },
};

describe('brandToPresetVars', () => {
  it('maps brand tokens to CSS-ready preset vars', () => {
    const v = brandToPresetVars(brand);
    expect(v.bg).toBe('#EFEFEF');
    expect(v.accent).toBe('#766CFF');
    expect(v.text).toBe('#111111');
    expect(v.accentText).toBe('#000000'); // WCAG: black passes 5.4:1 on #766CFF, white only 3.9:1
    expect(v.headingFont).toBe('Geist Sans'); // @fontsource-usable name
    expect(v.bodyFont).toBe('Open Sans');
    expect(v.radius).toBe(40);
  });

  it('falls back cleanly for a bare brand', () => {
    const v = brandToPresetVars({ identity: { name: 'X' }, colors: [{ hex: '#FF0000' }] } as any);
    expect(v.accent).toBe('#FF0000');
    expect(v.headingFont).toBe('Inter');
    expect(v.radius).toBe(32);
  });
});

describe('brandToFonts', () => {
  it('returns the brand font families with weights', () => {
    const fonts = brandToFonts(brand);
    expect(fonts.map((f) => f.family).sort()).toEqual(['Geist', 'Open Sans']);
    expect(fonts[0].weights?.length).toBeGreaterThan(0);
  });
});

describe('web preset registry', () => {
  it('lists and resolves Post/Launch', () => {
    expect(listWebPresets().some((p) => p.id === 'Post/Launch')).toBe(true);
    const p = getWebPreset('post/launch');
    expect(p?.width).toBe(1080);
    expect(p?.imageSlots.map((s) => s.id)).toEqual(['photo1', 'logo']);
  });

  it('builds HTML from vars + slots + fonts', () => {
    const v = brandToPresetVars(brand);
    const html = getWebPreset('Post/Launch')!.build(
      v,
      { h1: 'Volta às aulas', infos: ['08/07', '@zola'] },
      { photo1: { imageUrl: 'https://x/p.png' }, logo: { imageUrl: 'https://x/l.png' } },
      '/* font css */'
    );
    expect(html).toContain('Volta às aulas');
    expect(html).toContain('https://x/p.png'); // photo slot
    expect(html).toContain('https://x/l.png'); // logo slot
    expect(html).toContain('#766CFF'); // brand accent themed in
    expect(html).toContain("font-family:'Geist Sans'"); // heading font applied
  });
});
