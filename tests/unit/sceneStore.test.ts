import { describe, it, expect } from 'vitest';
import { sceneHash, SCENES_COLLECTION } from '../../server/services/sceneStore.js';

describe('sceneStore — cache key (sceneHash)', () => {
  it('is deterministic for the same (psdFileName, mtime)', () => {
    const a = sceneHash('Uns - Flag Mockup.psd', 1_700_000_000_000);
    const b = sceneHash('Uns - Flag Mockup.psd', 1_700_000_000_000);
    expect(a).toBe(b);
  });

  it('changes when the PSD name changes', () => {
    const a = sceneHash('a.psd', 1_700_000_000_000);
    const b = sceneHash('b.psd', 1_700_000_000_000);
    expect(a).not.toBe(b);
  });

  it('changes when the mtime changes (PSD re-uploaded)', () => {
    const a = sceneHash('a.psd', 1_700_000_000_000);
    const b = sceneHash('a.psd', 1_700_000_000_001);
    expect(a).not.toBe(b);
  });

  it('ignores sub-millisecond drift (floors mtime)', () => {
    const a = sceneHash('a.psd', 1_700_000_000_000.4);
    const b = sceneHash('a.psd', 1_700_000_000_000.9);
    expect(a).toBe(b);
  });

  it('produces a short, url/path-safe hex token', () => {
    const h = sceneHash('a.psd', 1);
    expect(h).toMatch(/^[0-9a-f]{24}$/);
  });

  it('exposes the Mongo collection name', () => {
    expect(SCENES_COLLECTION).toBe('psd_scenes');
  });
});
