import { describe, it, expect } from 'vitest';
import {
  buildBrandContextJSON,
  buildBrandContextJSONString,
  buildBrandContext,
  buildBrandContextForImageGen,
} from '@server/lib/brandContextBuilder';

describe('buildBrandContextJSON (Structured Output)', () => {
  it('should build valid JSON contract from brand', () => {
    const brand = {
      identity: { name: 'Test Brand', tagline: 'Test' },
      colors: [{ name: 'primary', hex: '#00bcd4', rgb: 'rgb(0,188,212)', role: 'primary' }],
      typography: [{ role: 'heading', family: 'Inter', style: 'Bold' }],
    };

    const json = buildBrandContextJSON(brand as any);

    expect(json).toHaveProperty('brand');
    expect(json).toHaveProperty('colors');
    expect(json).toHaveProperty('typography');
    expect(json.brand.name).toBe('Test Brand');
    expect(json.colors).toHaveLength(1);
  });

  it('should convert hex colors to RGB format', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'test', hex: '#ffffff', rgb: 'rgb(255,255,255)' }],
      typography: [],
    };

    const json = buildBrandContextJSON(brand as any);
    const color = json.colors[0];

    expect(color.hex).toBe('#ffffff');
    expect(color.rgb).toBeDefined();
    expect(color.rgb.r).toBeCloseTo(1, 0.01);
  });

  it('should be JSON-serializable', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'test', hex: '#000000', rgb: 'rgb(0,0,0)' }],
      typography: [],
    };

    const json = buildBrandContextJSON(brand as any);
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});

describe('buildBrandContextJSONString', () => {
  it('should wrap JSON in brand_context tags', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [],
      typography: [],
    };

    const str = buildBrandContextJSONString(brand as any);

    expect(str).toContain('<brand_context>');
    expect(str).toContain('</brand_context>');
    expect(str).toContain('INSTRUCTIONS:');
  });
});

describe('buildBrandContext (Human-Readable)', () => {
  it('should include brand name', () => {
    const brand = {
      identity: { name: 'Acme' },
      colors: [],
      typography: [],
    };

    const text = buildBrandContext(brand as any);

    expect(text).toContain('BRAND: Acme');
  });

  it('should format colors correctly', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'primary', hex: '#ff0000', role: 'primary' }],
      typography: [],
    };

    const text = buildBrandContext(brand as any);

    expect(text).toContain('COLORS:');
    expect(text).toContain('primary: #ff0000');
  });
});

describe('buildBrandContextForImageGen', () => {
  it('should return compact output', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'test', hex: '#000000', role: 'primary' }],
      typography: [{ role: 'body', family: 'Arial' }],
      logos: [{ variant: 'full', url: 'https://example.com/logo.png' }],
    };

    const text = buildBrandContextForImageGen(brand as any);

    expect(text).toContain('COLORS:');
    expect(text).not.toContain('LOGOS:');
  });
});
