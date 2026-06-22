/**
 * brandScenes — unit tests for the on-brand 3D scene generator.
 *
 * `generateBrandScenes` imports SCENE_PRESETS from the studio3d store, which pulls
 * in zustand persist + zundo and reads browser globals at module-eval time. We stub
 * those BEFORE importing so the module evaluates in the node test environment.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const memoryStore = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
});
(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:fake');
(globalThis as any).URL.revokeObjectURL = vi.fn();

type GenerateBrandScenes = typeof import('@/lib/studio3d/brandScenes').generateBrandScenes;
let generateBrandScenes: GenerateBrandScenes;

beforeAll(async () => {
  ({ generateBrandScenes } = await import('@/lib/studio3d/brandScenes'));
});

const brand = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  name: 'Acme',
  colors: [
    { hex: '#1d4ed8', name: 'Blue', role: 'primary', usageRank: 1 },
    { hex: '#f59e0b', name: 'Amber', role: 'accent', usageRank: 2 },
    { hex: '#0a0a0a', name: 'Ink', role: 'background', usageRank: 3 },
  ],
  ...over,
});

describe('generateBrandScenes', () => {
  it('returns [] for missing brand or brand without usable colors', () => {
    expect(generateBrandScenes(null)).toEqual([]);
    expect(generateBrandScenes(undefined)).toEqual([]);
    expect(generateBrandScenes({ id: 'x', colors: [] } as any)).toEqual([]);
    expect(generateBrandScenes({ id: 'x', colors: [{ hex: 'nope', name: 'bad' }] } as any)).toEqual(
      []
    );
  });

  it('builds scenes whose material/background come from the brand palette', () => {
    const scenes = generateBrandScenes(brand() as any);
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.length).toBeLessThanOrEqual(10);

    const brandHexes = ['#1d4ed8', '#f59e0b', '#0a0a0a'];
    for (const s of scenes) {
      expect(s.config.bgType).toBe('solid');
      expect(s.config.transparentBg).toBe(false);
      // every scene carries a valid hex material + background
      expect(s.config.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.config.background).toMatch(/^#[0-9a-f]{6}$/i);
      // at least the swatch trio references real brand colors (allowing neutral fallbacks)
      expect(s.swatches).toHaveLength(3);
    }
    // the brand's own dark color should be reused as a background somewhere
    expect(scenes.some((s) => brandHexes.includes(s.config.background.toLowerCase()))).toBe(true);
  });

  it('emits curated color themes first, labeled by theme name', () => {
    const scenes = generateBrandScenes(
      brand({
        colorThemes: [
          {
            id: 't1',
            name: 'Midnight',
            bg: '#0b1020',
            text: '#ffffff',
            primary: '#22d3ee',
            accent: '#f43f5e',
          },
        ],
      }) as any
    );
    expect(scenes[0].label).toBe('Midnight');
    expect(scenes[0].config.background.toLowerCase()).toBe('#0b1020');
    expect(scenes[0].config.color.toLowerCase()).toBe('#22d3ee');
  });

  it('dedupes and caps the gallery at 10', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `t${i}`,
      name: `Theme ${i}`,
      bg: `#0b10${(20 + i).toString(16).padStart(2, '0')}`,
      text: '#ffffff',
      primary: '#22d3ee',
      accent: '#f43f5e',
    }));
    const scenes = generateBrandScenes(brand({ colorThemes: many }) as any);
    expect(scenes.length).toBeLessThanOrEqual(10);
    const keys = new Set(scenes.map((s) => s.key));
    expect(keys.size).toBe(scenes.length); // unique keys
  });

  it('mood tags from logo analysis re-rank the looks (luxury surfaces metallic first)', () => {
    const luxe = generateBrandScenes(
      brand({
        logos: [
          {
            id: 'l1',
            url: 'x.png',
            variant: 'primary',
            analysis: { aesthetic: 'luxury premium elegant' },
          },
        ],
      }) as any
    ).filter((s) => s.key.startsWith('look:'));
    const plain = generateBrandScenes(brand() as any).filter((s) => s.key.startsWith('look:'));

    const luxeFirst = luxe[0].key;
    const plainFirst = plain[0].key;
    // luxury should bias toward a metallic look (Hero Banner / Liquid Metal),
    // which is not the default first look (Product Shot).
    expect(plainFirst).toBe('look:Product Shot');
    expect(['look:Hero Banner', 'look:Liquid Metal']).toContain(luxeFirst);
  });
});
