import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveSceneLicense,
  effectiveLicense,
  isCommercial,
} from '../sceneLicense.js';
import { listScenes } from '../sceneStore.js';

describe('resolveSceneLicense', () => {
  it('defaults first-party files to commercial-free', () => {
    expect(resolveSceneLicense('VISANT_BILLBOARD_01.psd').license).toBe('commercial-free');
    expect(resolveSceneLicense('boxy-tshirt-front.psd').license).toBe('commercial-free');
  });

  it('flags known paid studios by filename', () => {
    const hazard = resolveSceneLicense('Mockup-Hazard_Poster_A.psd');
    expect(hazard.license).toBe('studio-paid');
    expect(hazard.studio).toBe('Mockup Hazard');

    expect(resolveSceneLicense('maison_frame_scene.psd').license).toBe('studio-paid');
    expect(resolveSceneLicense('MrMockup_device.psd').license).toBe('studio-paid');
  });

  it('does not false-positive on unrelated names', () => {
    // "maison" as a substring inside another word must not trip (\b boundary)
    expect(resolveSceneLicense('comparaison_test.psd').license).toBe('commercial-free');
  });

  it('honors an explicit override (admin at prepare time)', () => {
    const o = resolveSceneLicense('Mockup-Hazard_X.psd', { license: 'commercial-free' });
    expect(o.license).toBe('commercial-free');
  });

  it('picks up extra paid studios from env', () => {
    process.env.SCENE_PAID_STUDIOS = 'AcmeMock, Fancy Studio';
    expect(resolveSceneLicense('acmemock_poster.psd').license).toBe('studio-paid');
    expect(resolveSceneLicense('fancy studio hero.psd').license).toBe('studio-paid');
  });
  afterEach(() => {
    delete process.env.SCENE_PAID_STUDIOS;
  });
});

describe('effectiveLicense / isCommercial', () => {
  it('trusts a stored license when present', () => {
    expect(effectiveLicense({ psdFileName: 'x.psd', license: 'studio-paid' }).license).toBe(
      'studio-paid'
    );
  });

  it('falls back to filename resolution for un-migrated records', () => {
    // No stored license, but the name is a paid studio → still filtered.
    expect(isCommercial({ psdFileName: 'Mockup-Hazard_old.psd' })).toBe(false);
    expect(isCommercial({ psdFileName: 'visant_scene.psd' })).toBe(true);
  });
});

describe('listScenes commercialOnly filter', () => {
  const rows = [
    { psdFileName: 'visant_a.psd', license: 'commercial-free', faces: [], width: 1, height: 1, warnings: [], updatedAt: new Date() },
    { psdFileName: 'paid_b.psd', license: 'studio-paid', faces: [], width: 1, height: 1, warnings: [], updatedAt: new Date() },
    // un-migrated: no license field, but name is a paid studio → must be filtered by fallback
    { psdFileName: 'Mockup-Hazard_c.psd', faces: [], width: 1, height: 1, warnings: [], updatedAt: new Date() },
    // un-migrated first-party → allowed
    { psdFileName: 'boxy_d.psd', faces: [], width: 1, height: 1, warnings: [], updatedAt: new Date() },
  ];
  const fakeDb = {
    collection: () => ({
      find: () => ({ sort: () => ({ toArray: async () => rows.slice() }) }),
    }),
  };

  it('returns everything without the flag', async () => {
    const all = await listScenes(fakeDb);
    expect(all).toHaveLength(4);
  });

  it('keeps only commercial-free (stored OR filename-resolved) when commercialOnly', async () => {
    const pub = await listScenes(fakeDb, { commercialOnly: true });
    const names = pub.map((r) => r.psdFileName).sort();
    expect(names).toEqual(['boxy_d.psd', 'visant_a.psd']);
  });
});
