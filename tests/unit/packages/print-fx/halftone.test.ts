import { describe, it, expect } from 'vitest';
import { generateHalftoneSvg } from '@visant/print-fx/halftone';
import { HALFTONE_DEFAULTS } from '@visant/print-fx';
import type { HalftoneSettings } from '@visant/print-fx';

// Build a tiny solid-color RGBA buffer (width*height*4).
function solid(width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    px[i * 4] = r;
    px[i * 4 + 1] = g;
    px[i * 4 + 2] = b;
    px[i * 4 + 3] = 255;
  }
  return px;
}

// Low frequency + no randomness → a small, fully deterministic dot grid that is
// big enough to clear the radius-cull threshold on a modest buffer.
const LOW_FREQ: HalftoneSettings = { ...HALFTONE_DEFAULTS, frequency: 4, randomness: 0 };

describe('@visant/print-fx halftone — generateHalftoneSvg', () => {
  it('emits a well-formed SVG with the source dimensions', () => {
    const svg = generateHalftoneSvg(solid(8, 8, 0, 0, 0), 8, 8, HALFTONE_DEFAULTS);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 8 8"');
    expect(svg).toContain('width="8" height="8"');
  });

  it('is deterministic — identical inputs produce byte-identical output', () => {
    const px = solid(64, 64, 128, 64, 200);
    const a = generateHalftoneSvg(px, 64, 64, LOW_FREQ);
    const b = generateHalftoneSvg(px, 64, 64, LOW_FREQ);
    expect(a).toBe(b);
  });

  it('a pure-black image produces black-ink (K) dots over the paper rect', () => {
    const svg = generateHalftoneSvg(solid(64, 64, 0, 0, 0), 64, 64, LOW_FREQ);
    expect(svg).toContain(`fill="${HALFTONE_DEFAULTS.paperColor}"`); // paperAlpha=1
    expect(svg).toContain(`fill="${HALFTONE_DEFAULTS.blackInk}"`);
    expect((svg.match(/<circle /g) || []).length).toBeGreaterThan(0);
  });

  it('locks the deterministic dot count for a known black buffer (regression guard)', () => {
    const svg = generateHalftoneSvg(solid(64, 64, 0, 0, 0), 64, 64, LOW_FREQ);
    // Pure black → C=M=Y=0, K=1 → only the black channel emits dots.
    expect((svg.match(/<circle /g) || []).length).toBe(13);
  });

  it('a pure-white image produces no ink dots (all channels below threshold)', () => {
    const svg = generateHalftoneSvg(solid(64, 64, 255, 255, 255), 64, 64, LOW_FREQ);
    expect(svg).not.toContain('<circle ');
  });

  it('hiding every channel removes all dots', () => {
    const allOff: HalftoneSettings = {
      ...LOW_FREQ,
      showCyan: false,
      showMagenta: false,
      showYellow: false,
      showBlack: false,
    };
    const svg = generateHalftoneSvg(solid(64, 64, 0, 0, 0), 64, 64, allOff);
    expect(svg).not.toContain('<circle ');
  });
});
