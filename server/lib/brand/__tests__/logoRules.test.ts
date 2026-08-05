import { describe, it, expect } from 'vitest';
import {
  measureLogo,
  deriveClearSpace,
  deriveMinSize,
  deriveBackgrounds,
  boilerplateMisuse,
  type LogoGeometry,
} from '../logoRules.js';

/** Synthetic asset so the expected numbers are known exactly, not eyeballed. */
async function png(
  canvas: { w: number; h: number },
  rects: Array<{ x: number; y: number; w: number; h: number }>,
  opts: { opaqueBackground?: string } = {}
): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  const shapes = rects
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#000"/>`)
    .join('');
  const bg = opts.opaqueBackground
    ? `<rect width="${canvas.w}" height="${canvas.h}" fill="${opts.opaqueBackground}"/>`
    : '';
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.w}" height="${canvas.h}">${bg}${shapes}</svg>`
    )
  )
    .png()
    .toBuffer();
}

const geometry = (over: Partial<LogoGeometry> = {}): LogoGeometry => ({
  canvas: { width: 1000, height: 200 },
  bbox: { x: 0, y: 0, width: 1000, height: 200 },
  aspectRatio: 5,
  bakedPadding: { top: 0, right: 0, bottom: 0, left: 0 },
  capHeight: 200,
  stemWidth: 40,
  barWidth: 30,
  thinnestStroke: 20,
  inkColor: '#000000',
  inkDensity: 0.4,
  ...over,
});

describe('measureLogo', () => {
  it('finds the ink bounds inside a padded canvas', async () => {
    const buf = await png({ w: 400, h: 200 }, [{ x: 50, y: 40, w: 300, h: 120 }]);
    const g = await measureLogo(buf);

    expect(g.canvas).toEqual({ width: 400, height: 200 });
    expect(g.bbox.x).toBeCloseTo(50, -1);
    expect(g.bbox.width).toBeCloseTo(300, -1);
    expect(g.bbox.height).toBeCloseTo(120, -1);
    expect(g.aspectRatio).toBeCloseTo(2.5, 1);
  });

  it('reports padding already baked into the file, relative to ink width', async () => {
    const buf = await png({ w: 400, h: 200 }, [{ x: 50, y: 40, w: 300, h: 120 }]);
    const g = await measureLogo(buf);

    // 50px of left padding against 300px of ink.
    expect(g.bakedPadding.left).toBeCloseTo(50 / 300, 2);
    expect(g.bakedPadding.top).toBeCloseTo(40 / 300, 2);
  });

  it('measures the dominant stroke, not the antialiasing', async () => {
    // An "H": two 20px stems 100 tall, joined by a 10px bar.
    const buf = await png({ w: 120, h: 100 }, [
      { x: 0, y: 0, w: 20, h: 100 },
      { x: 80, y: 0, w: 20, h: 100 },
      { x: 20, y: 45, w: 60, h: 10 },
    ]);
    const g = await measureLogo(buf);

    expect(g.stemWidth).toBe(20);
    expect(g.capHeight).toBe(100);
    // The 10px crossbar is the first thing to vanish when scaled down.
    expect(g.thinnestStroke).toBeLessThanOrEqual(20);
    expect(g.thinnestStroke).toBeGreaterThanOrEqual(10);
  });

  it('falls back to luminance when the file has no transparency', async () => {
    const buf = await png({ w: 400, h: 200 }, [{ x: 50, y: 40, w: 300, h: 120 }], {
      opaqueBackground: '#ffffff',
    });
    const g = await measureLogo(buf);

    expect(g.bbox.width).toBeCloseTo(300, -1);
    expect(g.inkColor).toBe('#000000');
  });

  it('throws instead of returning nonsense for an empty raster', async () => {
    const buf = await png({ w: 50, h: 50 }, []);
    await expect(measureLogo(buf)).rejects.toThrow(/no ink/i);
  });
});

describe('deriveClearSpace', () => {
  it('expresses the module as a ratio of the applied width', () => {
    const r = deriveClearSpace(geometry(), 'capHeight');
    expect(r.px).toBe(200);
    expect(r.ratioOfWidth).toBeCloseTo(0.2, 4);
    expect(r.css).toContain('0.2');
  });

  it('halves the module on request', () => {
    expect(deriveClearSpace(geometry(), 'halfCapHeight').px).toBe(100);
    expect(deriveClearSpace(geometry(), 'stem').px).toBe(40);
  });

  it('warns when the file already carries its own margin', () => {
    const withPadding = geometry({
      bakedPadding: { top: 0.15, right: 0.15, bottom: 0.15, left: 0.15 },
    });
    expect(deriveClearSpace(withPadding, 'capHeight').statement).toMatch(/folga embutida/);
    expect(deriveClearSpace(geometry(), 'capHeight').statement).not.toMatch(/folga embutida/);
  });
});

describe('deriveMinSize', () => {
  it('lets the thin stroke govern when the mark is delicate', () => {
    // thinnestStroke 2/1000 → needs 500px before the stroke reaches 1 device px,
    // while cap height only needs 40px.
    const r = deriveMinSize(geometry({ thinnestStroke: 2 }));
    expect(r.screenGovernedBy).toBe('stroke');
    expect(r.screenPx).toBeGreaterThanOrEqual(500);
    expect(r.statement).toMatch(/traço mais fino/);
  });

  it('lets cap height govern when the mark is chunky', () => {
    // Thick strokes, short cap: legibility of the letterform binds first.
    const r = deriveMinSize(geometry({ thinnestStroke: 300, capHeight: 200 }));
    expect(r.screenGovernedBy).toBe('capHeight');
    expect(r.statement).toMatch(/caixa-alta/);
  });

  it('applies the safety multiplier and rounds screen to a 4px step', () => {
    const bare = deriveMinSize(geometry({ thinnestStroke: 2 }), 1);
    const padded = deriveMinSize(geometry({ thinnestStroke: 2 }), 2);
    expect(padded.screenPx).toBeGreaterThan(bare.screenPx);
    expect(bare.screenPx % 4).toBe(0);
    expect(padded.safety).toBe(2);
  });

  it('refuses to invent a number from unusable geometry', () => {
    expect(() => deriveMinSize(geometry({ thinnestStroke: 0 }))).toThrow();
  });
});

describe('deriveBackgrounds', () => {
  const palette = [
    { hex: '#FFFFFF', name: 'Branco' },
    { hex: '#767676', name: 'Cinza' },
    { hex: '#000000', name: 'Preto' },
  ];

  it('ranks backgrounds by contrast against the measured ink', () => {
    const out = deriveBackgrounds(geometry({ inkColor: '#000000' }), palette);
    expect(out[0].hex).toBe('#FFFFFF');
    expect(out[0].contrast).toBeCloseTo(21, 0);
    expect(out[0].verdict).toBe('ok');
  });

  it('fails a background the logo would disappear on', () => {
    const out = deriveBackgrounds(geometry({ inkColor: '#000000' }), palette);
    const black = out.find((b) => b.hex === '#000000')!;
    expect(black.contrast).toBeCloseTo(1, 1);
    expect(black.verdict).toBe('fail');
  });

  it('judges at the 3:1 non-text bar, not the 4.5:1 text bar', () => {
    // #767676 on black is ~4.5:1 against white but sits between the two bars here.
    const out = deriveBackgrounds(geometry({ inkColor: '#000000' }), [
      { hex: '#767676', name: 'Cinza' },
    ]);
    expect(out[0].contrast).toBeGreaterThan(3);
    expect(out[0].verdict).toBe('ok');
  });

  it('skips malformed hexes instead of throwing', () => {
    const out = deriveBackgrounds(geometry(), [{ hex: 'not-a-color' }, { hex: '#FFFFFF' }]);
    expect(out).toHaveLength(1);
  });
});

describe('boilerplateMisuse', () => {
  it('covers the rules every manual repeats', () => {
    const list = boilerplateMisuse();
    expect(list.length).toBeGreaterThanOrEqual(8);
    expect(list.join(' ')).toMatch(/distorcer/);
    expect(list.join(' ')).toMatch(/área de respiro/);
  });
});
