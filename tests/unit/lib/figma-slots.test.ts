import { describe, it, expect } from 'vitest';
import {
  parseSlotName,
  isSlotLayer,
  aspectLabel,
  validateSlotFills,
  type TemplateManifest,
} from '../../../src/lib/figma-slots';

describe('parseSlotName', () => {
  it('parses plain, optional, list, and optional-list slots', () => {
    expect(parseSlotName('#h1')).toEqual({ id: 'h1', optional: false, list: false });
    expect(parseSlotName('#h2?')).toEqual({ id: 'h2', optional: true, list: false });
    expect(parseSlotName('#infos[]')).toEqual({ id: 'infos', optional: false, list: true });
    expect(parseSlotName('#photo1[]?')).toEqual({ id: 'photo1', optional: true, list: true });
    expect(parseSlotName('  #cta  ')).toEqual({ id: 'cta', optional: false, list: false });
  });

  it('rejects non-slot layer names', () => {
    expect(parseSlotName('Heading')).toBeNull();
    expect(parseSlotName('#')).toBeNull();
    expect(parseSlotName('#1bad')).toBeNull(); // must start with a letter
    expect(parseSlotName('#h1 extra')).toBeNull();
    expect(isSlotLayer('Frame 12')).toBe(false);
    expect(isSlotLayer('#logo')).toBe(true);
  });
});

describe('aspectLabel', () => {
  it('snaps dimensions to the common aspect set', () => {
    expect(aspectLabel(1080, 1080)).toBe('1:1');
    expect(aspectLabel(1080, 1350)).toBe('4:5');
    expect(aspectLabel(1080, 1920)).toBe('9:16');
    expect(aspectLabel(1920, 1080)).toBe('16:9');
    expect(aspectLabel(0, 0)).toBe('1:1');
  });
});

describe('validateSlotFills', () => {
  const manifest: Pick<TemplateManifest, 'slots'> = {
    slots: [
      { id: 'h1', type: 'text', optional: false, list: false },
      { id: 'h2', type: 'text', optional: true, list: false },
      { id: 'infos', type: 'text', optional: true, list: true },
      { id: 'photo1', type: 'image', optional: false, list: false },
    ],
  };

  it('passes a correct fill', () => {
    const r = validateSlotFills(manifest, {
      h1: 'Volta às aulas',
      infos: ['12/06', 'R$99'],
      photo1: { imageUrl: 'https://x/y.png' },
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('flags a missing required slot', () => {
    const r = validateSlotFills(manifest, { h1: 'x' }); // photo1 missing
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/missing required slot "photo1"/);
  });

  it('flags wrong types and unknown slots', () => {
    const r = validateSlotFills(manifest, {
      h1: { imageUrl: 'no' } as any, // text expected
      photo1: 'not-an-image' as any, // image expected
      bogus: 'x' as any, // unknown
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/slot "h1" expects text/);
    expect(r.errors.join()).toMatch(/slot "photo1" expects an image/);
    expect(r.errors.join()).toMatch(/unknown slot "bogus"/);
  });

  it('treats null on an optional slot as skip (no error)', () => {
    const r = validateSlotFills(manifest, { h1: 'x', h2: null, photo1: { imageHash: 'abc' } });
    expect(r.ok).toBe(true);
  });
});
