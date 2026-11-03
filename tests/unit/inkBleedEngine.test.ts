import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickBrandColors, applyBrandToDoc } from '@/lib/ink-bleed/brand';
import {
  FORMATS,
  buildArtworkSvg,
  computeFilterParams,
  fitFontSize,
  frameProgress,
  motionFactors,
} from '@/lib/ink-bleed/engine';
import { toAlphaMask } from '@/lib/ink-bleed/logoMask';
import { createDocStorage } from '@/lib/ink-bleed/docStorage';
import { cssString } from '@/lib/ink-bleed/fonts';
import { luminance, patchRects } from '@/lib/ink-bleed/paper';
import { PRESETS, createDefaultDoc } from '@/lib/ink-bleed/presets';
import { inkPaperContrast, shuffleDoc, varyDoc } from '@/lib/ink-bleed/shuffle';
import { mergePreset } from '@/stores/inkBleedStore';
import type { BrandGuideline } from '@/lib/figma-types';

const baseOptions = {
  filterId: 'f',
  width: 1200,
  height: 900,
  scale: 1,
  mode: 'bleed-in' as const,
  progress: 1,
  seed: 42,
};

describe('computeFilterParams', () => {
  const { ink } = createDefaultDoc();

  it('keeps the bleed the same size on the artwork at any export scale', () => {
    const one = computeFilterParams(ink, baseOptions);
    const four = computeFilterParams(ink, { ...baseOptions, scale: 4 });
    expect(four.displacementScale).toBeCloseTo(one.displacementScale * 4);
    expect(four.blurStdDev).toBeCloseTo(one.blurStdDev * 4);
    const freq = (s: string) => Number(s.split(' ')[0]);
    expect(freq(four.baseFrequency)).toBeCloseTo(freq(one.baseFrequency) / 4, 4);
    expect(four.gritFrequency).toBeCloseTo(one.gritFrequency / 4);
  });

  it('does not reseed the edge when roughness changes', () => {
    const a = computeFilterParams({ ...ink, roughness: 20 }, baseOptions);
    const b = computeFilterParams({ ...ink, roughness: 80 }, baseOptions);
    expect(a.seed).toBe(b.seed);
  });

  it('turns core density into a proportion, not an on/off switch', () => {
    expect(computeFilterParams({ ...ink, coreFillDensity: 50 }, baseOptions).coreDensity).toBe(0.5);
  });
});

describe('motionFactors', () => {
  it('closes the cycle of every mode, so a loop never jumps', () => {
    for (const mode of ['bleed-in', 'pulse', 'capillary-flow', 'xerox-burn'] as const) {
      const start = motionFactors(mode, 0);
      const end = motionFactors(mode, 1);
      expect(end.spread).toBeCloseTo(start.spread);
      expect(end.roughness).toBeCloseTo(start.roughness);
    }
  });

  it('shows the slider values exactly when bleed-in is finished', () => {
    const m = motionFactors('bleed-in', 1);
    expect(m.spread).toBeCloseTo(1);
    expect(m.roughness).toBeCloseTo(1);
    expect(m.frequency).toBeCloseTo(1);
  });

  it('grows bleed-in on one seed, without jumps', () => {
    expect(motionFactors('bleed-in', 0).seedOffset).toBe(0);
    expect(motionFactors('bleed-in', 0.7).seedOffset).toBe(0);
    expect(motionFactors('bleed-in', 0.5).spread).toBeLessThan(
      motionFactors('bleed-in', 0.6).spread
    );
  });
});

describe('buildArtworkSvg', () => {
  const doc = createDefaultDoc();

  it('escapes text, so a typed tag stays text', () => {
    const svg = buildArtworkSvg(
      {
        ...doc,
        typography: { ...doc.typography, text: '<img src=x onerror=alert(1)>', uppercase: false },
      },
      { filterId: 'f' }
    );
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;img');
  });

  it('escapes the font family and the ink color', () => {
    const svg = buildArtworkSvg(
      {
        ...doc,
        ink: { ...doc.ink, inkColor: '"/><script>' },
        typography: { ...doc.typography, fontFamily: `a"><script>` },
      },
      { filterId: 'f' }
    );
    expect(svg).not.toContain('<script>');
  });

  it('writes one element per line', () => {
    const svg = buildArtworkSvg(
      { ...doc, typography: { ...doc.typography, text: 'A\nB\nC' } },
      { filterId: 'f' }
    );
    expect(svg.match(/<text /g)).toHaveLength(3);
  });

  it('multiplies the output size by the scale', () => {
    const svg = buildArtworkSvg(doc, { filterId: 'f', scale: 4 });
    expect(svg).toContain('width="4800"');
    expect(svg).toContain('height="3600"');
  });

  it('embeds the font when given, because an <img> cannot see page fonts', () => {
    const svg = buildArtworkSvg(doc, { filterId: 'f', fontCss: '@font-face{font-family:X}' });
    expect(svg).toContain('@font-face{font-family:X}');
  });

  it('tints a logo with the ink, and falls back to text without one', () => {
    const logo = { dataUrl: 'data:image/png;base64,AA', width: 100, height: 50, name: 'l' };
    const withLogo = buildArtworkSvg({ ...doc, source: 'logo' }, { filterId: 'f', logo });
    expect(withLogo).toContain('<image');
    expect(withLogo).toContain('feFlood');
    const withoutLogo = buildArtworkSvg({ ...doc, source: 'logo' }, { filterId: 'f', logo: null });
    expect(withoutLogo).toContain('<text');
  });

  it('gives every preset valid markup', () => {
    for (const p of PRESETS) {
      const svg = buildArtworkSvg(
        { ...doc, ink: p.ink, paper: p.paper, typography: p.typography },
        { filterId: `f-${p.id}` }
      );
      expect(svg).toContain(`filter="url(#f-${p.id})"`);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('undefined');
    }
  });
});

describe('fitFontSize', () => {
  const doc = createDefaultDoc();
  // Every character is 0.5em wide, close to a real sans.
  const measure = (lines: string[], size: number) =>
    Math.max(...lines.map((l) => l.length)) * size * 0.5;

  it('fits the widest line inside the margins', () => {
    const fitted = {
      ...doc,
      typography: { ...doc.typography, text: 'A VERY LONG LINE OF TEXT', letterSpacing: 0 },
    };
    const size = fitFontSize(fitted, measure);
    const width = measure(['A VERY LONG LINE OF TEXT'], size);
    expect(width).toBeLessThanOrEqual(FORMATS['4:3'].width * 0.8);
    expect(width).toBeGreaterThan(FORMATS['4:3'].width * 0.7);
  });

  it('is limited by height when there are many lines', () => {
    const fitted = {
      ...doc,
      format: '16:9' as const,
      typography: { ...doc.typography, text: 'A\nB\nC\nD\nE\nF', lineHeight: 1, letterSpacing: 0 },
    };
    const size = fitFontSize(fitted, measure);
    expect(size * 6).toBeLessThanOrEqual(FORMATS['16:9'].height * 0.8);
  });
});

describe('frameProgress', () => {
  it('starts an exported bleed-in on dry ink', () => {
    expect(frameProgress('bleed-in', 0, 10)).toBe(0.5);
    expect(frameProgress('bleed-in', 5, 10)).toBe(0);
  });

  it('stops a loop one frame short, so the first frame is not shown twice', () => {
    expect(frameProgress('pulse', 9, 10)).toBeCloseTo(0.9);
  });
});

describe('toAlphaMask', () => {
  const pixels = (list: number[][]) => new Uint8ClampedArray(list.flat());

  it('keeps the alpha of a file with transparency', () => {
    const data = pixels([
      [10, 20, 30, 0],
      [10, 20, 30, 128],
      [10, 20, 30, 255],
      [10, 20, 30, 255],
    ]);
    toAlphaMask(data, 2, 2);
    expect([...data.slice(0, 8)]).toEqual([255, 255, 255, 0, 255, 255, 255, 128]);
  });

  it('turns a dark logo on a white background into ink', () => {
    const white = [255, 255, 255, 255];
    const black = [0, 0, 0, 255];
    const data = pixels([white, white, white, white, black, white, white, white, white]);
    toAlphaMask(data, 3, 3);
    expect(data[3]).toBe(0);
    expect(data[4 * 4 + 3]).toBe(255);
  });

  it('turns a light logo on a black background into ink', () => {
    const white = [255, 255, 255, 255];
    const black = [0, 0, 0, 255];
    const data = pixels([black, black, black, black, white, black, black, black, black]);
    toAlphaMask(data, 3, 3);
    expect(data[3]).toBe(0);
    expect(data[4 * 4 + 3]).toBe(255);
  });
});

describe('brand as input', () => {
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('uses the role of the color when it gives contrast', () => {
    const pair = pickBrandColors([
      { hex: '#0c2461', role: 'primary' },
      { hex: '#f7f4ea', role: 'background' },
    ]);
    expect(pair).toEqual({ ink: '#0c2461', paper: '#f7f4ea' });
  });

  it('never returns ink that cannot be read on the paper', () => {
    const pair = pickBrandColors([
      { hex: '#ffff00', role: 'primary' },
      { hex: '#ffffee', role: 'background' },
    ]);
    expect(contrast(pair!.ink, pair!.paper)).toBeGreaterThanOrEqual(3);
  });

  it('survives an empty or invalid palette', () => {
    expect(pickBrandColors([])).toBeNull();
    expect(pickBrandColors(undefined)).toBeNull();
    expect(pickBrandColors([{ hex: 'not-a-color' }])).toBeNull();
  });

  it('applies identity and keeps the texture of the print', () => {
    const doc = createDefaultDoc();
    const brand = {
      name: 'Axio',
      colors: [{ hex: '#111111', name: 'a', role: 'primary' }],
      typography: [{ family: 'Syne', role: 'heading' }],
    } as BrandGuideline;
    const next = applyBrandToDoc(doc, brand);
    expect(next.typography.text).toBe('Axio');
    expect(next.typography.fontFamily).toBe('Syne');
    expect(next.ink.inkColor).toBe('#111111');
    expect(next.ink.bleedSpread).toBe(doc.ink.bleedSpread);
  });

  it('leaves a transparent paper transparent', () => {
    const doc = createDefaultDoc();
    const transparent = { ...doc, paper: { ...doc.paper, paperType: 'transparent' as const } };
    const brand = { colors: [{ hex: '#111111', name: 'a' }] } as BrandGuideline;
    expect(applyBrandToDoc(transparent, brand).paper).toBe(transparent.paper);
  });
});

describe('trying a style', () => {
  const zine = PRESETS.find((p) => p.id === 'zine')!;

  it('swaps a sample text for the sample of the style', () => {
    const next = mergePreset(createDefaultDoc(), zine);
    expect(next.typography.text).toBe(zine.typography.text);
    expect(next.ink).toEqual(zine.ink);
  });

  it('keeps a text the person wrote', () => {
    const doc = createDefaultDoc();
    const mine = { ...doc, typography: { ...doc.typography, text: 'Minha frase' } };
    expect(mergePreset(mine, zine).typography.text).toBe('Minha frase');
  });

  it('keeps the brand while it is locked, and changes only the print', () => {
    const brand = {
      name: 'Axio',
      colors: [
        { hex: '#7a1f2b', name: 'a', role: 'primary' },
        { hex: '#f3ecdf', name: 'b', role: 'background' },
      ],
      typography: [{ family: 'Syne', role: 'heading' }],
    } as BrandGuideline;
    const next = mergePreset(applyBrandToDoc(createDefaultDoc(), brand), zine);
    expect(next.typography.text).toBe('Axio');
    expect(next.typography.fontFamily).toBe('Syne');
    expect(next.ink.inkColor).toBe('#7a1f2b');
    expect(next.paper.baseColor).toBe('#f3ecdf');
    expect(next.ink.bleedSpread).toBe(zine.ink.bleedSpread);
  });
});

describe('optical effects', () => {
  const doc = createDefaultDoc();
  const render = (ink: Partial<typeof doc.ink>, scale = 1) =>
    buildArtworkSvg({ ...doc, ink: { ...doc.ink, ...ink } }, { filterId: 'f', scale });

  it('adds nothing when off, so the classic styles stay as they were', () => {
    const svg = render({});
    expect(svg).not.toContain('dragNoise');
    expect(svg).not.toContain('result="halo"');
    expect(svg).not.toContain('result="ghost"');
  });

  it('softens the edge and removes the hard core as focus goes', () => {
    const sharp = computeFilterParams(doc.ink, baseOptions);
    const soft = computeFilterParams({ ...doc.ink, defocus: 60 }, baseOptions);
    expect(soft.blurStdDev).toBeGreaterThan(sharp.blurStdDev * 3);
    expect(soft.alphaMultiplier).toBeLessThan(sharp.alphaMultiplier / 4);
    expect(soft.coreDensity).toBeLessThan(0.05);
  });

  it('moves streaks only along the chosen axis', () => {
    const vertical = render({ drag: 50, dragAxis: 'vertical' });
    expect(vertical).toContain('xChannelSelector="G" yChannelSelector="R" result="dragFull"');
    const horizontal = render({ drag: 50, dragAxis: 'horizontal' });
    expect(horizontal).toContain('xChannelSelector="R" yChannelSelector="G" result="dragFull"');
  });

  it('scales every optical distance with the export', () => {
    const ink = { ...doc.ink, defocus: 40, halo: 40, drag: 40, ghost: 40 };
    const one = computeFilterParams(ink, baseOptions);
    const four = computeFilterParams(ink, { ...baseOptions, scale: 4 });
    expect(four.dragScale).toBeCloseTo(one.dragScale * 4);
    expect(four.haloBlur).toBeCloseTo(one.haloBlur * 4);
    expect(four.ghostX).toBeCloseTo(one.ghostX * 4);
    expect(four.blurStdDev).toBeCloseTo(one.blurStdDev * 4);
  });

  it('starts a bleed-in in focus and ends it at the slider value', () => {
    const ink = { ...doc.ink, defocus: 50, bleedSpread: 40 };
    const start = computeFilterParams(ink, { ...baseOptions, progress: 0.5 });
    const end = computeFilterParams(ink, { ...baseOptions, progress: 1 });
    expect(start.blurStdDev).toBeLessThan(end.blurStdDev / 5);
  });
});

describe('collage', () => {
  it('lands in the same place for the same seed, and moves with a new one', () => {
    expect(patchRects(60, 42)).toEqual(patchRects(60, 42));
    expect(patchRects(60, 42)).not.toEqual(patchRects(60, 179));
  });

  it('never leaves the artwork', () => {
    for (const rect of patchRects(100, 7)) {
      expect(rect.x + rect.w).toBeLessThanOrEqual(1);
      expect(rect.y + rect.h).toBeLessThanOrEqual(1);
      expect(rect.w).toBeGreaterThan(0);
      expect(rect.h).toBeGreaterThan(0);
    }
  });

  it('is empty when off', () => {
    expect(patchRects(0, 42)).toEqual([]);
  });
});

describe('shuffle', () => {
  // Same sequence every run, so a failure can be reproduced.
  const seeded = (seed: number) => () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const rolls = (doc = createDefaultDoc()) =>
    Array.from({ length: 200 }, (_, i) => shuffleDoc(doc, seeded(i + 1)));

  it('keeps the content of the person', () => {
    const doc = createDefaultDoc();
    const mine = {
      ...doc,
      format: '9:16' as const,
      typography: { ...doc.typography, text: 'Minha frase', fontFamily: 'Syne' },
    };
    for (const next of rolls(mine)) {
      expect(next.typography).toEqual(mine.typography);
      expect(next.format).toBe('9:16');
    }
  });

  it('changes the picture', () => {
    const doc = createDefaultDoc();
    const distinct = new Set(rolls(doc).map((d) => JSON.stringify([d.ink, d.paper, d.seed])));
    expect(distinct.size).toBeGreaterThan(190);
  });

  it('always stays readable', () => {
    for (const next of rolls()) {
      expect(inkPaperContrast(next)).toBeGreaterThanOrEqual(3);
      expect(next.ink.defocus).toBeLessThanOrEqual(55);
      expect(next.ink.drag).toBeLessThanOrEqual(45);
    }
  });

  it('keeps the colors of a locked brand', () => {
    const doc = createDefaultDoc();
    const locked = {
      ...doc,
      brandLocked: true,
      ink: { ...doc.ink, inkColor: '#7a1f2b' },
      paper: { ...doc.paper, baseColor: '#f3ecdf' },
    };
    for (const next of rolls(locked)) {
      expect(next.ink.inkColor).toBe('#7a1f2b');
      expect(next.paper.baseColor).toBe('#f3ecdf');
    }
  });

  it('does not bring paper back to a transparent artwork', () => {
    const doc = createDefaultDoc();
    const transparent = { ...doc, paper: { ...doc.paper, paperType: 'transparent' as const } };
    for (const next of rolls(transparent)) expect(next.paper.paperType).toBe('transparent');
  });
});

describe('doc storage', () => {
  afterEach(() => vi.useRealTimers());

  const setup = (setItem: (key: string, value: string) => void) => {
    vi.useFakeTimers();
    const onSaveFailed = vi.fn();
    const storage = createDocStorage({
      storage: () => ({ getItem: () => null, removeItem: () => {}, setItem }),
      onSaveFailed,
    });
    return { storage, onSaveFailed };
  };
  const value = (doc: ReturnType<typeof createDefaultDoc>) => ({ state: { doc }, version: 1 });

  it('writes once for a document that did not change, as during playback', () => {
    const setItem = vi.fn();
    const { storage } = setup(setItem);
    const doc = createDefaultDoc();
    for (let i = 0; i < 60; i++) storage.setItem('k', value(doc));
    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 60; i++) storage.setItem('k', value(doc));
    vi.advanceTimersByTime(1000);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('survives a full storage and reports it once', () => {
    const { storage, onSaveFailed } = setup(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => {
      storage.setItem('k', value(createDefaultDoc()));
      vi.advanceTimersByTime(1000);
      storage.setItem('k', value(createDefaultDoc()));
      vi.advanceTimersByTime(1000);
    }).not.toThrow();
    expect(onSaveFailed).toHaveBeenCalledTimes(1);
  });

  it('flush saves the last edit without waiting', () => {
    const setItem = vi.fn();
    const { storage } = setup(setItem);
    storage.setItem('k', value(createDefaultDoc()));
    storage.flush();
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});

describe('varyDoc', () => {
  const zine = PRESETS.find((p) => p.id === 'zine')!;
  const base = mergePreset(createDefaultDoc(), zine);

  it('keeps the style: colors, type, and the effects it leaves off', () => {
    for (let i = 0; i < 50; i++) {
      const next = varyDoc(base);
      expect(next.presetId).toBe('zine');
      expect(next.ink.inkColor).toBe(base.ink.inkColor);
      expect(next.paper.baseColor).toBe(base.paper.baseColor);
      expect(next.typography).toEqual(base.typography);
      for (const key of ['defocus', 'halo', 'drag', 'ghost', 'inkErosion', 'tonerGrit'] as const) {
        if (base.ink[key] === 0) expect(next.ink[key]).toBe(0);
      }
    }
  });

  it('moves values inside the slider ranges and changes the picture', () => {
    let changed = 0;
    for (let i = 0; i < 50; i++) {
      const next = varyDoc(base);
      if (next.ink.bleedSpread !== base.ink.bleedSpread) changed++;
      expect(next.ink.bleedSpread).toBeGreaterThanOrEqual(0);
      expect(next.ink.bleedSpread).toBeLessThanOrEqual(100);
      expect(next.ink.frequency).toBeGreaterThanOrEqual(0.008);
      expect(next.ink.frequency).toBeLessThanOrEqual(0.08);
    }
    expect(changed).toBeGreaterThan(0);
  });
});

describe('drag', () => {
  const svg = (drag: number) => {
    const doc = createDefaultDoc();
    return buildArtworkSvg({ ...doc, ink: { ...doc.ink, drag } }, { filterId: 'f', scale: 1 });
  };

  it('keeps the untouched shape under the streaks, so the word survives', () => {
    expect(svg(40)).toContain('result="dragPart"');
    expect(svg(40)).toMatch(
      /<feMerge result="dragged"><feMergeNode in="[^"]+"\/><feMergeNode in="dragPart"\/>/
    );
  });

  it('adds no extra work when the effect is off', () => {
    expect(svg(0)).not.toContain('dragPatch');
  });
});

describe('cssString', () => {
  it('leaves ordinary family names alone', () => {
    expect(cssString('Space Grotesk')).toBe('Space Grotesk');
    expect(cssString('Noto-Sans_2')).toBe('Noto-Sans_2');
  });

  it('cannot close the CSS string or the style tag', () => {
    const out = cssString(`x\\';}</style><script>alert(1)</script>`);
    expect(out).not.toMatch(/['<>;}]/);
    // Only the backslashes of the escapes themselves remain.
    expect(out).toMatch(/^x\\5c \\27 /);
  });
});
