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

describe('resolveSlot (alias pipeline)', () => {
  const c: TemplateContent = {
    name: 'Padoo',
    headline: 'Do forno à sua porta.',
    body: 'Bakery body.',
    caption: 'A vó mais descolada.',
    tagL: 'Left',
    tagR: 'Right',
    keywords: ['artisanal', 'authentic', 'strategic'],
    tagline: 'A vó mais descolada do bairro',
    description: 'Full description.',
  };

  it('maps canonical slot ids to content', () => {
    expect(resolveSlot('h1', c)).toBe('Do forno à sua porta.');
    expect(resolveSlot('brand', c)).toBe('Padoo');
    expect(resolveSlot('body', c)).toBe('Bakery body.');
    expect(resolveSlot('tagL', c)).toBe('Left');
    expect(resolveSlot('tagR', c)).toBe('Right');
    expect(resolveSlot('caption', c)).toBe('A vó mais descolada.');
  });

  it('accepts natural aliases (EN + PT), case/separator-insensitive', () => {
    expect(resolveSlot('headline', c)).toBe(c.headline);
    expect(resolveSlot('Title', c)).toBe(c.headline);
    expect(resolveSlot('manchete', c)).toBe(c.headline);
    expect(resolveSlot('MARCA', c)).toBe('Padoo');
    expect(resolveSlot('wordmark', c)).toBe('Padoo');
    expect(resolveSlot('slogan', c)).toBe(c.tagline);
    expect(resolveSlot('descricao', c)).toBe('Bakery body.');
    expect(resolveSlot('sub-title', c)).toBe('Bakery body.');
  });

  it('handles indexed keyword slots by several prefixes (1-based)', () => {
    expect(resolveSlot('kw1', c)).toBe('artisanal');
    expect(resolveSlot('keyword2', c)).toBe('authentic');
    expect(resolveSlot('tag3', c)).toBe('strategic');
    expect(resolveSlot('kw4', c)).toBe(''); // out of range, no fallback
    expect(resolveSlot('kw4', c, 'placeholder')).toBe('placeholder');
  });

  it('falls back to the layer literal for unknown or unfilled slots', () => {
    expect(resolveSlot('mystery', c)).toBe('');
    expect(resolveSlot('mystery', c, 'drawn text')).toBe('drawn text');
    // mapped but empty field → fallback
    const empty = { ...c, headline: '' };
    expect(resolveSlot('h1', empty, 'literal h1')).toBe('literal h1');
  });
});

describe('hexWithOpacity', () => {
  it('passes through at full opacity, converts to rgba below', () => {
    expect(hexWithOpacity('#123456', 1)).toBe('#123456');
    expect(hexWithOpacity('#123456', 0.25)).toBe('rgba(18,52,86,0.25)');
  });
});
