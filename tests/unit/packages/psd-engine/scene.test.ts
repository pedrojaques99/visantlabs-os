import { describe, it, expect } from 'vitest';
import { composePsd, flattenLayers, replaceLinkedSmartObjects } from '@visantlabs/psd-engine';
import { extractScene, renderScene } from '@visantlabs/psd-engine/scene';
import { cc, solid, artCanvas, meanPixelDiff, pixel } from './helpers.js';

/**
 * Build a synthetic mockup PSD tree:
 *   [0] background group  (base)
 *   [1] face SO group     (placedLayer with an axis-aligned quad)
 *   [2] light group (multiply) (over)
 * No real .psd file — the engine operates on the tree.
 */
function makePsd() {
  const W = 80;
  const H = 80;

  // Face placed in a 40x40 region at (20,20), axis-aligned quad (TL,TR,BR,BL).
  const quad = [20, 20, 60, 20, 60, 60, 20, 60];

  const faceSo = {
    name: 'Design Here',
    left: 20,
    top: 20,
    right: 60,
    bottom: 60,
    placedLayer: { id: 'FACE1', width: 40, height: 40, transform: quad },
    // ag-psd would give the SO a placeholder canvas; compose ignores it once replaced.
    canvas: solid(40, 40, '#888888'),
  };

  const psd = {
    width: W,
    height: H,
    children: [
      // base background (white)
      { name: 'BG', left: 0, top: 0, right: W, bottom: H, canvas: solid(W, H, '#ffffff') },
      // the editable face
      { name: 'Mockup', children: [faceSo] },
      // an over light layer (semi-transparent black, multiply) covering everything
      {
        name: 'Light',
        blendMode: 'multiply',
        opacity: 0.5,
        left: 0,
        top: 0,
        right: W,
        bottom: H,
        canvas: solid(W, H, '#808080'),
      },
    ],
  };
  return { psd, W, H, quad };
}

describe('scene extract → render roundtrip', () => {
  it('produces a SceneDoc with one face, a base layer and an over layer', () => {
    const { psd } = makePsd();
    const { doc, assets } = extractScene(psd, cc);

    expect(doc.version).toBe(1);
    expect(doc.faces).toHaveLength(1);
    expect(doc.faces[0].quad).not.toBeNull();
    expect(doc.faces[0].innerW).toBe(40);

    const roles = doc.layers.map((l) => l.role);
    expect(roles).toContain('base');
    expect(roles).toContain('over');

    const over = doc.layers.find((l) => l.role === 'over')!;
    expect(over.blendMode).toBe('multiply');
    expect(over.opacity).toBeCloseTo(0.5, 2);

    // every layer/face ref resolves to a captured canvas
    for (const l of doc.layers) expect(assets[l.src]).toBeTruthy();
  });

  it('scene render ≈ full composePsd of the same art (pixel tolerance)', () => {
    const art = artCanvas(64, 64);

    // ── Full reference path: replace the SO then compose the whole PSD ──
    const ref = makePsd();
    const allLayers = flattenLayers(ref.psd.children);
    const target = allLayers.find((l: any) => l.name === 'Design Here');
    replaceLinkedSmartObjects(allLayers, target, art, cc);
    const refCanvas = composePsd(ref.psd, cc);

    // ── Scene path: extract from a fresh tree, then render the same art ──
    const fresh = makePsd();
    const { doc, assets } = extractScene(fresh.psd, cc);
    const faceKey = doc.faces[0].key;
    const sceneCanvas = renderScene(doc, assets, { [faceKey]: art }, cc);

    expect(sceneCanvas.width).toBe(refCanvas.width);
    expect(sceneCanvas.height).toBe(refCanvas.height);

    // Center of the face should carry the art (not the grey placeholder).
    const [r, g, b] = pixel(sceneCanvas, 40, 40);
    expect(r + g + b).toBeGreaterThan(0);

    const diff = meanPixelDiff(refCanvas, sceneCanvas);
    // Tolerance: warp grid + blend ordering can differ by a few levels per channel.
    expect(diff).toBeLessThan(12);
  });

  it('records a warning for blend modes outside BLEND_MAP', () => {
    const { psd } = makePsd();
    // Inject an unmapped blend mode on the over layer.
    (psd.children[2] as any).blendMode = 'totally unknown blend';
    const { doc } = extractScene(psd, cc);
    expect(doc.warnings.some((w) => w.includes('totally unknown blend'))).toBe(true);
  });
});
