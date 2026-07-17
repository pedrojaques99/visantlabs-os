import { describe, it, expect } from 'vitest';
import { parseHex, hexToRgb, rgbToHex } from '@/utils/colorUtils';

describe('parseHex (paste-first hex input)', () => {
  it('normalizes a full hex', () => {
    expect(parseHex('#ff0000')).toBe('#FF0000');
    expect(parseHex('00ff00')).toBe('#00FF00');
  });

  it('expands 3-digit shorthand', () => {
    expect(parseHex('#f00')).toBe('#FF0000');
    expect(parseHex('abc')).toBe('#AABBCC');
  });

  it('tolerates surrounding whitespace and stray chars', () => {
    expect(parseHex('  #AbCdEf ')).toBe('#ABCDEF');
    expect(parseHex('#12-34-56')).toBe('#123456');
  });

  it('returns null until there are enough valid digits', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('#ff')).toBeNull();
    expect(parseHex('xyz')).toBeNull();
  });

  it('truncates overflow to 6 digits', () => {
    expect(parseHex('#1234567890')).toBe('#123456');
  });
});

describe('hexToRgb / rgbToHex', () => {
  it('round-trips a color', () => {
    expect(hexToRgb('#FF8800')).toEqual([255, 136, 0]);
    expect(rgbToHex(255, 136, 0)).toBe('#ff8800');
  });

  it('handles 3-digit hex', () => {
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0]);
  });
});
