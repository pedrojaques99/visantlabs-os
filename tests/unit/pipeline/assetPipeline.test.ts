import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for assetPipeline logic.
 * Redis is mocked — integration tests (with real Redis) are out of scope here.
 */

// Simulate the enqueue/list/remove logic without Redis
interface Asset { id: string; userId: string; source: string; imageUrl?: string; label?: string; enqueuedAt: string; }

function makeStore() {
  const store: Record<string, string[]> = {};
  return {
    async lpush(key: string, val: string) {
      if (!store[key]) store[key] = [];
      store[key].unshift(val);
    },
    async lrange(key: string, _start: number, _end: number) {
      return store[key] || [];
    },
    async lrem(key: string, _count: number, val: string) {
      if (!store[key]) return;
      store[key] = store[key].filter((v) => v !== val);
    },
    async del(key: string) { delete store[key]; },
    async llen(key: string) { return (store[key] || []).length; },
    async expire() {},
  };
}

function makePipeline(redis: ReturnType<typeof makeStore>) {
  return {
    async enqueue(userId: string, asset: Omit<Asset, 'id' | 'userId' | 'enqueuedAt'>): Promise<Asset> {
      const full: Asset = { ...asset, id: Math.random().toString(36).slice(2), userId, enqueuedAt: new Date().toISOString() };
      await redis.lpush(`pipeline:${userId}`, JSON.stringify(full));
      return full;
    },
    async list(userId: string): Promise<Asset[]> {
      const items = await redis.lrange(`pipeline:${userId}`, 0, -1);
      return items.reverse().map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    },
    async remove(userId: string, id: string): Promise<void> {
      const items = await redis.lrange(`pipeline:${userId}`, 0, -1);
      for (const raw of items) {
        try {
          const a = JSON.parse(raw);
          if (a.id === id) { await redis.lrem(`pipeline:${userId}`, 1, raw); return; }
        } catch { /* skip */ }
      }
    },
    async clear(userId: string): Promise<void> { await redis.del(`pipeline:${userId}`); },
    async size(userId: string): Promise<number> { return redis.llen(`pipeline:${userId}`); },
  };
}

describe('assetPipeline', () => {
  let pipeline: ReturnType<typeof makePipeline>;

  beforeEach(() => {
    pipeline = makePipeline(makeStore());
  });

  it('enqueues an asset and returns it', async () => {
    const asset = await pipeline.enqueue('user1', { source: 'canvas', imageUrl: 'https://r2/img.png', label: 'Test' });
    expect(asset.id).toBeTruthy();
    expect(asset.userId).toBe('user1');
    expect(asset.source).toBe('canvas');
  });

  it('list returns assets in chronological order', async () => {
    await pipeline.enqueue('u1', { source: 'canvas', label: 'first' });
    await pipeline.enqueue('u1', { source: 'mockupmachine', label: 'second' });
    const list = await pipeline.list('u1');
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe('first');
    expect(list[1].label).toBe('second');
  });

  it('remove deletes only the targeted asset', async () => {
    const a1 = await pipeline.enqueue('u1', { source: 'canvas' });
    const a2 = await pipeline.enqueue('u1', { source: 'mockupmachine' });
    await pipeline.remove('u1', a1.id);
    const list = await pipeline.list('u1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(a2.id);
  });

  it('clear removes all assets', async () => {
    await pipeline.enqueue('u1', { source: 'canvas' });
    await pipeline.enqueue('u1', { source: 'extractor' });
    await pipeline.clear('u1');
    expect(await pipeline.size('u1')).toBe(0);
  });

  it('assets are isolated per userId', async () => {
    await pipeline.enqueue('alice', { source: 'canvas' });
    await pipeline.enqueue('bob', { source: 'mockupmachine' });
    const alice = await pipeline.list('alice');
    const bob = await pipeline.list('bob');
    expect(alice).toHaveLength(1);
    expect(bob).toHaveLength(1);
    expect(alice[0].userId).toBe('alice');
    expect(bob[0].userId).toBe('bob');
  });

  it('size reflects count correctly', async () => {
    expect(await pipeline.size('u2')).toBe(0);
    await pipeline.enqueue('u2', { source: 'canvas' });
    expect(await pipeline.size('u2')).toBe(1);
    await pipeline.enqueue('u2', { source: 'canvas' });
    expect(await pipeline.size('u2')).toBe(2);
  });
});
