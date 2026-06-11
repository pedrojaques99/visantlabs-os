import { describe, it, expect } from 'vitest';
import {
  composePsd,
  flattenLayers,
  perspectiveWarp,
  coverArtCanvas,
  BLEND_MAP,
} from '@visantlabs/psd-engine';
import { cc, solid, artCanvas, pixel } from './helpers.js';

describe('BLEND_MAP', () => {
  it('maps common PSD blend modes to Canvas-2D composite ops', () => {
    expect(BLEND_MAP['normal']).toBe('source-over');
    expect(BLEND_MAP['multiply']).toBe('multiply');
    expect(BLEND_MAP['screen']).toBe('screen');
    expect(BLEND_MAP['linear dodge']).toBe('lighter');
  });
});

describe('coverArtCanvas', () => {
  it('produces a canvas of the requested inner size (cover, centered)', () => {
    const art = artCanvas(200, 100); // wide art
    const out = coverArtCanvas(art, 100, 100, cc); // square target
    expect(out.width).toBe(100);
    expect(out.height).toBe(100);
    // Center should be filled (red), proving the art covered the whole square.
    const [r, g, b, a] = pixel(out, 50, 50);
    expect(a).toBe(255);
    expect(r + g + b).toBeGreaterThan(0);
  });
});

describe('perspectiveWarp', () => {
  it('fills an axis-aligned destination quad with the source', () => {
    const src = solid(40, 40, '#ff0000');
    const out = cc(40, 40);
    // Identity quad (TL,TR,BR,BL) covering the full canvas → near 1:1 copy.
    perspectiveWarp(out.getContext('2d'), src, 40, 40, [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ]);
    const [r, , , a] = pixel(out, 20, 20);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(200); // red survived the warp
  });
});

describe('composePsd — synthetic in-memory tree', () => {
  it('composites layers bottom-up (layer[0] is the background)', () => {
    // Two full-document opaque layers; the top (index 1) wins.
    const psd = {
      width: 20,
      height: 20,
      children: [
        { name: 'bg', left: 0, top: 0, right: 20, bottom: 20, canvas: solid(20, 20, '#ff0000') },
        { name: 'fg', left: 0, top: 0, right: 20, bottom: 20, canvas: solid(20, 20, '#0000ff') },
      ],
    };
    const out = composePsd(psd, cc);
    expect(out.width).toBe(20);
    const [r, g, b] = pixel(out, 10, 10);
    expect(b).toBeGreaterThan(200); // top blue layer on top
    expect(r).toBeLessThan(50);
  });

  it('respects hidden layers and partial coverage', () => {
    const psd = {
      width: 20,
      height: 20,
      children: [
        { name: 'bg', left: 0, top: 0, right: 20, bottom: 20, canvas: solid(20, 20, '#ff0000') },
        // hidden top layer must NOT paint
        { name: 'hidden', hidden: true, left: 0, top: 0, right: 20, bottom: 20, canvas: solid(20, 20, '#0000ff') },
        // small green square only over the left-top corner
        { name: 'dot', left: 0, top: 0, right: 5, bottom: 5, canvas: solid(5, 5, '#00ff00') },
      ],
    };
    const out = composePsd(psd, cc);
    const [, g] = pixel(out, 2, 2);
    expect(g).toBeGreaterThan(200); // green dot
    const [r2] = pixel(out, 15, 15);
    expect(r2).toBeGreaterThan(200); // red bg showing (blue hidden)
  });

  it('applies layer opacity', () => {
    const psd = {
      width: 10,
      height: 10,
      children: [
        { name: 'bg', left: 0, top: 0, right: 10, bottom: 10, canvas: solid(10, 10, '#000000') },
        { name: 'half', opacity: 0.5, left: 0, top: 0, right: 10, bottom: 10, canvas: solid(10, 10, '#ffffff') },
      ],
    };
    const out = composePsd(psd, cc);
    const [r] = pixel(out, 5, 5);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(180); // ~50% white over black
  });
});

describe('flattenLayers', () => {
  it('flattens a nested tree and records dotted paths + __original refs', () => {
    const child = { name: 'inner' };
    const tree = [{ name: 'group', children: [child] }];
    const flat = flattenLayers(tree);
    const inner = flat.find((l) => l.name === 'inner');
    expect(inner.path).toBe('group > inner');
    expect(inner.__original).toBe(child);
  });
});
