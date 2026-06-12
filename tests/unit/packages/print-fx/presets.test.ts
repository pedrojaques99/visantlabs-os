import { describe, it, expect } from 'vitest';
import {
  HALFTONE_PRESETS_DATA,
  RISO_FULL_PRESETS_DATA,
  TEXTURE_PRESETS_DATA,
} from '@visant/print-fx/presets';

describe('@visant/print-fx presets — catalog integrity', () => {
  it('exposes the three preset catalogs as non-empty records', () => {
    expect(Object.keys(HALFTONE_PRESETS_DATA).length).toBeGreaterThan(0);
    expect(Object.keys(RISO_FULL_PRESETS_DATA).length).toBeGreaterThan(0);
    expect(Object.keys(TEXTURE_PRESETS_DATA).length).toBeGreaterThan(0);
  });

  it('halftone preset values are JSON-serializable primitives', () => {
    for (const [name, preset] of Object.entries(HALFTONE_PRESETS_DATA)) {
      expect(preset, name).toBeTypeOf('object');
      for (const v of Object.values(preset)) {
        expect(['number', 'string', 'boolean']).toContain(typeof v);
      }
    }
  });

  it('every riso preset has the required ink-pipeline fields and a color list', () => {
    for (const [name, preset] of Object.entries(RISO_FULL_PRESETS_DATA)) {
      expect(preset.frequency, name).toBeTypeOf('number');
      expect(preset.dotSize, name).toBeTypeOf('number');
      expect(preset.paperColor, name).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(Array.isArray(preset.colors), name).toBe(true);
      expect(preset.colors.length, name).toBeGreaterThan(0);
      for (const hex of preset.colors) expect(hex).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });

  it('roundtrips through JSON without loss (pure data, no functions/refs)', () => {
    for (const catalog of [HALFTONE_PRESETS_DATA, RISO_FULL_PRESETS_DATA, TEXTURE_PRESETS_DATA]) {
      const clone = JSON.parse(JSON.stringify(catalog));
      expect(clone).toEqual(catalog);
    }
  });

  it("'Classic Print' halftone preset is an empty override (defaults passthrough)", () => {
    expect(HALFTONE_PRESETS_DATA['Classic Print']).toEqual({});
  });
});
