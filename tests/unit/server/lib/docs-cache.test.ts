import { describe, it, expect, beforeEach, vi } from 'vitest';
import { docsCache } from '../../../../server/lib/docs-cache.js';

describe('docsCache', () => {
  beforeEach(() => {
    docsCache.invalidateAll();
  });

  it('generates on miss, caches on subsequent reads', () => {
    let calls = 0;
    const gen = () => {
      calls++;
      return { value: calls };
    };

    const a = docsCache.getOrGenerate('k1', gen);
    const b = docsCache.getOrGenerate('k1', gen);

    expect(a.value).toBe(1);
    expect(b.value).toBe(1);
    expect(calls).toBe(1);
  });

  it('segregates entries by key', () => {
    const a = docsCache.getOrGenerate('k1', () => 'A');
    const b = docsCache.getOrGenerate('k2', () => 'B');
    expect(a).toBe('A');
    expect(b).toBe('B');
  });

  it('invalidate drops a single entry', () => {
    let calls = 0;
    const gen = () => ++calls;

    docsCache.getOrGenerate('k1', gen);
    docsCache.invalidate('k1');
    docsCache.getOrGenerate('k1', gen);

    expect(calls).toBe(2);
  });

  it('invalidateAll drops every entry', () => {
    docsCache.getOrGenerate('k1', () => 'A');
    docsCache.getOrGenerate('k2', () => 'B');
    docsCache.invalidateAll();

    let regens = 0;
    docsCache.getOrGenerate('k1', () => {
      regens++;
      return 'A2';
    });
    expect(regens).toBe(1);
  });

  it('expires entries after TTL', async () => {
    // lru-cache captures Date.now at construction time so vi.useFakeTimers()
    // doesn't advance the internal clock of the singleton. Use a real short
    // sleep with a 1 ms TTL instead — negligible overhead, reliable signal.
    let calls = 0;
    const gen = () => ++calls;

    docsCache.getOrGenerate('ttl-key', gen, 1);
    await new Promise((r) => setTimeout(r, 10));
    docsCache.getOrGenerate('ttl-key', gen, 1);

    expect(calls).toBe(2);
  });
});
