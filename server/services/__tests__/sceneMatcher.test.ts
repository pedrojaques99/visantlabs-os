import { describe, it, expect } from 'vitest';
import {
  classifySurfaceKind,
  aspectFit,
  contrastFit,
  kindFit,
  scoreAssetForFace,
  rankSuggestions,
  type AssetForMatch,
  type SceneForMatch,
} from '../sceneMatcher.js';

describe('classifySurfaceKind', () => {
  it('maps filenames/faces to surface kinds', () => {
    expect(classifySurfaceKind('BILLBOARD_downtown.psd')).toBe('signage');
    expect(classifySurfaceKind('tshirt_front.psd')).toBe('apparel');
    expect(classifySurfaceKind('iphone_15_mock.psd')).toBe('device');
    expect(classifySurfaceKind('poster_A2.psd')).toBe('print');
    expect(classifySurfaceKind('business-card.psd')).toBe('card');
    expect(classifySurfaceKind('coffee_box.psd')).toBe('packaging');
    expect(classifySurfaceKind('camiseta_frente.psd')).toBe('apparel'); // PT keyword
    expect(classifySurfaceKind('mystery_scene.psd')).toBe('unknown');
  });
});

describe('aspectFit', () => {
  it('is 1 for identical ratios and decays with mismatch', () => {
    expect(aspectFit(1, 1)).toBe(1);
    expect(aspectFit(2, 2)).toBe(1);
    expect(aspectFit(1, 3)).toBeCloseTo(0, 5); // 3x mismatch → 0
    expect(aspectFit(1, 1.5)).toBeGreaterThan(aspectFit(1, 2.5));
  });
  it('is neutral when a ratio is missing', () => {
    expect(aspectFit(undefined, 2)).toBe(0.5);
  });
});

describe('contrastFit', () => {
  it('full-bleed (opaque) art always reads', () => {
    expect(contrastFit({ url: 'x', hasTransparency: false }, 'dark')).toBe(1);
  });
  it('uses contrastSafeOn when present', () => {
    expect(contrastFit({ url: 'x', hasTransparency: true, contrastSafeOn: ['dark'] }, 'dark')).toBe(
      1
    );
    expect(
      contrastFit({ url: 'x', hasTransparency: true, contrastSafeOn: ['dark'] }, 'light')
    ).toBeLessThan(0.3);
  });
  it('infers from asset luminance when contrastSafeOn missing', () => {
    expect(contrastFit({ url: 'x', hasTransparency: true, luminance: 'light' }, 'dark')).toBe(1);
    expect(
      contrastFit({ url: 'x', hasTransparency: true, luminance: 'dark' }, 'dark')
    ).toBeLessThan(0.3);
  });
});

describe('kindFit', () => {
  it('prefers logos on products, art on signage', () => {
    expect(kindFit('logo', 'apparel')).toBeGreaterThan(kindFit('logo', 'print'));
    expect(kindFit('graphic', 'signage')).toBeGreaterThan(kindFit('graphic', 'card'));
  });
});

describe('scoreAssetForFace picks the right logo variant by scene luminance', () => {
  const darkScene = {
    surfaceKind: 'apparel' as const,
    aspectRatio: 1,
    baseLuminance: 'dark' as const,
  };
  const lightLogo: AssetForMatch = {
    url: 'light',
    variant: 'light',
    kind: 'logo',
    luminance: 'light',
    contrastSafeOn: ['dark'],
    aspectRatio: 1,
    hasTransparency: true,
  };
  const darkLogo: AssetForMatch = {
    url: 'dark',
    variant: 'dark',
    kind: 'logo',
    luminance: 'dark',
    contrastSafeOn: ['light'],
    aspectRatio: 1,
    hasTransparency: true,
  };

  it('the light (dark-bg-safe) logo scores higher on a dark scene', () => {
    expect(scoreAssetForFace(lightLogo, darkScene)).toBeGreaterThan(
      scoreAssetForFace(darkLogo, darkScene)
    );
  });
});

describe('rankSuggestions', () => {
  const assets: AssetForMatch[] = [
    {
      url: 'logo-light',
      variant: 'light',
      kind: 'logo',
      luminance: 'light',
      contrastSafeOn: ['dark'],
      aspectRatio: 1,
      hasTransparency: true,
    },
    {
      url: 'logo-dark',
      variant: 'dark',
      kind: 'logo',
      luminance: 'dark',
      contrastSafeOn: ['light'],
      aspectRatio: 1,
      hasTransparency: true,
    },
    {
      url: 'campaign',
      kind: 'graphic',
      luminance: 'mixed',
      aspectRatio: 1.78,
      hasTransparency: false,
    },
  ];
  const scenes: SceneForMatch[] = [
    {
      psdFileName: 'billboard_wide.psd',
      baseLuminance: 'mixed',
      faces: [{ key: 'f1', name: 'Arte', innerW: 1920, innerH: 1080 }],
    },
    {
      psdFileName: 'tshirt_dark.psd',
      baseLuminance: 'dark',
      faces: [{ key: 'f1', name: 'Front', innerW: 500, innerH: 500 }],
    },
  ];

  it('routes wide campaign art to the billboard and the light logo to the dark tee', () => {
    const ranked = rankSuggestions(assets, scenes);
    const bill = ranked.find((r) => r.psdFileName === 'billboard_wide.psd');
    const tee = ranked.find((r) => r.psdFileName === 'tshirt_dark.psd');
    expect(bill?.assetUrl).toBe('campaign'); // wide graphic on signage
    expect(tee?.assetUrl).toBe('logo-light'); // dark-bg-safe logo on dark apparel
    expect(tee?.variant).toBe('light');
  });

  it('returns one best suggestion per scene, sorted by score', () => {
    const ranked = rankSuggestions(assets, scenes);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('honors the exclude set (MRU)', () => {
    const ranked = rankSuggestions(assets, scenes, {
      exclude: new Set(['billboard_wide.psd:f1']),
    });
    expect(ranked.find((r) => r.psdFileName === 'billboard_wide.psd')).toBeUndefined();
    expect(ranked).toHaveLength(1);
  });
});
