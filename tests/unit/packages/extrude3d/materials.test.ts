import { describe, it, expect } from 'vitest';
import {
  materialPresets,
  MATERIAL_LIB,
  MATERIAL_UI,
  resolveMaterial,
  getSimpleMaterialProps,
} from '@visant/extrude3d/materials';

describe('@visant/extrude3d — material presets', () => {
  it('exposes the full preset library with stable count', () => {
    // Pinned: changing the preset set is a deliberate, reviewable change.
    expect(Object.keys(materialPresets).length).toBe(38);
  });

  it('surfaces a curated, ordered UI list of 28 entries', () => {
    expect(MATERIAL_UI.length).toBe(28);
    expect(MATERIAL_LIB.length).toBe(28);
    // every UI id maps to a real preset and carries a concrete label
    for (const entry of MATERIAL_LIB) {
      expect(materialPresets[entry.id]).toBeDefined();
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('pins key preset PBR values', () => {
    expect(materialPresets.chrome).toMatchObject({
      metalness: 1,
      roughness: 0.05,
      reflectivity: 1,
    });
    expect(materialPresets.glass).toMatchObject({
      opacity: 0.35,
      transparent: true,
    });
    expect(materialPresets.gold.metalness).toBe(1);
  });
});

describe('@visant/extrude3d — resolveMaterial', () => {
  it('applies overrides over the preset base', () => {
    const r = resolveMaterial('metal', { roughness: 0.5, wireframe: true });
    expect(r.preset).toBe('metal');
    expect(r.metalness).toBe(materialPresets.metal.metalness); // not overridden
    expect(r.roughness).toBe(0.5); // overridden
    expect(r.wireframe).toBe(true);
  });

  it('marks transparent when opacity drops below 1', () => {
    const r = resolveMaterial('plastic', { opacity: 0.4 });
    expect(r.opacity).toBe(0.4);
    expect(r.transparent).toBe(true);
  });

  it('falls back to default for an unknown preset', () => {
    const r = resolveMaterial('does-not-exist', {});
    expect(r.metalness).toBe(materialPresets.default.metalness);
  });
});

describe('@visant/extrude3d — getSimpleMaterialProps', () => {
  it('produces a flat prop bag for meshPhysicalMaterial', () => {
    const p = getSimpleMaterialProps('chrome', '#ff0066');
    expect(p.color).toBe('#ff0066');
    expect(p.metalness).toBe(materialPresets.chrome.metalness);
    expect(p.roughness).toBe(materialPresets.chrome.roughness);
    expect(p.ior).toBe(1.5); // default when preset omits ior
    expect(p.emissive).toBe('#000000'); // non-emissive preset
  });

  it('lights emissive color only for emissive presets', () => {
    const p = getSimpleMaterialProps('emissive', '#00ff00');
    expect(p.emissiveIntensity).toBeGreaterThan(0);
    expect(p.emissive).toBe('#00ff00');
  });
});
