import { describe, it, expect } from 'vitest';
import {
  resolveFill,
  resolveSlot,
  hexWithOpacity,
  VAR_TO_ROLE,
  type TemplateContent,
} from '../../../src/components/brand/guidelines/preview/templateResolve';
import type { RoleTheme } from '../../../src/components/brand/guidelines/preview/mockTokens';

const theme: RoleTheme = {
  accent: '#4d8f8f',
  accentText: '#000000',
  primary: '#eca43d',
  secondary: '#733d1f',
  bg: '#fdf5e6',
  surface: '#fdf5e6',
  text: '#1c1a14',
  textMuted: '#733d1f',
};

describe('resolveFill', () => {
  it('binds a variable name to the live brand token', () => {
    expect(resolveFill({ varName: 'accent', opacity: 1 }, theme)).toBe('#4d8f8f');
    expect(resolveFill({ varName: 'text-muted', opacity: 1 }, theme)).toBe('#733d1f');
  });

  it('applies opacity as rgba', () => {
    expect(resolveFill({ varName: 'text', opacity: 0.5 }, theme)).toBe('rgba(28,26,20,0.5)');
  });

  it('keeps a literal hex when no variable is bound', () => {
    expect(resolveFill({ hex: '#ff0000', opacity: 1 }, theme)).toBe('#ff0000');
  });

  it('returns undefined for an empty or unknown fill', () => {
    expect(resolveFill(undefined, theme)).toBeUndefined();
    expect(resolveFill({ varName: 'nonsense', opacity: 1 }, theme)).toBeUndefined();
  });

  it('maps every VAR_TO_ROLE key to a defined theme color', () => {
    for (const varName of Object.keys(VAR_TO_ROLE)) {
      expect(resolveFill({ varName, opacity: 1 }, theme)).toBeTruthy();
    }
  });
});

describe('resolveSlot', () => {
  const c: TemplateContent = {
    name: 'Padoo',
    headline: 'Do forno à sua porta.',
    body: 'Bakery body.',
    caption: 'A vó mais descolada.',
    tagL: 'Left',
    tagR: 'Right',
    keywords: ['artisanal', 'authentic', 'strategic'],
  };

  it('maps named slots to content', () => {
    expect(resolveSlot('h1', c)).toBe('Do forno à sua porta.');
    expect(resolveSlot('brand', c)).toBe('Padoo');
    expect(resolveSlot('body', c)).toBe('Bakery body.');
    expect(resolveSlot('tagL', c)).toBe('Left');
    expect(resolveSlot('tagR', c)).toBe('Right');
    expect(resolveSlot('caption', c)).toBe('A vó mais descolada.');
  });

  it('maps indexed keyword slots (1-based) and empties out of range', () => {
    expect(resolveSlot('kw1', c)).toBe('artisanal');
    expect(resolveSlot('kw3', c)).toBe('strategic');
    expect(resolveSlot('kw4', c)).toBe('');
  });

  it('returns empty for unknown slots', () => {
    expect(resolveSlot('mystery', c)).toBe('');
  });
});

describe('hexWithOpacity', () => {
  it('passes through at full opacity, converts to rgba below', () => {
    expect(hexWithOpacity('#123456', 1)).toBe('#123456');
    expect(hexWithOpacity('#123456', 0.25)).toBe('rgba(18,52,86,0.25)');
  });
});
