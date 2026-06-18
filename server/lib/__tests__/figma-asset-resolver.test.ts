import { describe, it, expect } from 'vitest';
import {
  pickLogoUrl,
  brandBgIsLight,
  resolveImageSlots,
  buildPresetFillOp,
} from '../figma-asset-resolver.js';

const logos = [
  { id: 'l1', variant: 'dark', url: 'http://x/dark.png' },
  { id: 'l2', variant: 'light', url: 'http://x/light.png' },
  { id: 'l3', variant: 'icon', url: 'http://x/icon.png' },
];
const media = [
  { id: 'm1', type: 'image', url: 'http://x/p1.png', label: 'hero' },
  { id: 'm2', type: 'image', url: 'http://x/p2.png', label: 'pattern' },
];

const lightBrand: any = {
  id: 'b1',
  colors: [{ hex: '#EFEFEF', role: 'background' }],
  logos,
  media,
};
const darkBrand: any = { id: 'b2', colors: [{ hex: '#0F0F12', role: 'background' }], logos, media };

describe('pickLogoUrl', () => {
  it('honors an explicit variant', () => {
    expect(pickLogoUrl(logos, { variant: 'light' })).toBe('http://x/light.png');
  });
  it('picks a dark logo on a light bg, light logo on a dark bg', () => {
    expect(pickLogoUrl(logos, { bgIsLight: true })).toBe('http://x/dark.png');
    expect(pickLogoUrl(logos, { bgIsLight: false })).toBe('http://x/light.png');
  });
});

describe('brandBgIsLight', () => {
  it('reads the brand background luminance', () => {
    expect(brandBgIsLight(lightBrand)).toBe(true);
    expect(brandBgIsLight(darkBrand)).toBe(false);
  });
});

describe('resolveImageSlots', () => {
  it('resolves logo by contrast and photo from media order (no brief = no search)', async () => {
    const out = await resolveImageSlots(lightBrand, [
      { id: 'logo' },
      { id: 'photo1' },
      { id: 'photo2' },
    ]);
    expect(out.logo).toEqual({ imageUrl: 'http://x/dark.png' }); // light bg → dark logo
    expect(out.photo1).toEqual({ imageUrl: 'http://x/p1.png' });
    expect(out.photo2).toEqual({ imageUrl: 'http://x/p2.png' });
  });

  it('resolves an icon slot from an icon-variant logo', async () => {
    const out = await resolveImageSlots(lightBrand, [{ id: 'icon' }]);
    expect(out.icon).toEqual({ imageUrl: 'http://x/icon.png' });
  });

  it('honors a slot variant hint', async () => {
    const out = await resolveImageSlots(lightBrand, [{ id: 'logo', variant: 'light' }]);
    expect(out.logo).toEqual({ imageUrl: 'http://x/light.png' });
  });
});

describe('buildPresetFillOp', () => {
  it('assembles a FILL_TEMPLATE op with text + resolved images + brand mode', async () => {
    const op = await buildPresetFillOp({
      brand: lightBrand,
      templateName: 'Post/Launch',
      text: { h1: 'Olá', infos: ['a', 'b'] },
      imageSlots: [{ id: 'logo' }, { id: 'photo1' }],
    });
    expect(op.type).toBe('FILL_TEMPLATE');
    expect(op.templateName).toBe('Post/Launch');
    expect(op.clone).toBe(true);
    expect(op.slots.h1).toBe('Olá');
    expect(op.slots.infos).toEqual(['a', 'b']);
    expect(op.slots.logo).toEqual({ imageUrl: 'http://x/dark.png' });
    expect(op.slots.photo1).toEqual({ imageUrl: 'http://x/p1.png' });
    expect(op.brandMode.collectionName).toBe('Brand');
    expect(op.brandMode.values.length).toBeGreaterThan(0);
  });
});
