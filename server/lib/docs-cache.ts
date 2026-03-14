/**
 * Documentation Caching Service
 * Uses lru-cache for efficient in-memory caching with TTL
 */

import { LRUCache } from 'lru-cache';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new LRUCache<string, any>({
  max: 50,
  ttl: DEFAULT_TTL,
});

export const docsCache = {
  /**
   * Get cached value or generate new one
   * @param key - Cache key
   * @param generator - Function to generate value if not cached
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  getOrGenerate<T>(key: string, generator: () => T, ttl: number = DEFAULT_TTL): T {
    const cached = cache.get(key) as T | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const data = generator();
    cache.set(key, data, { ttl });
    return data;
  },

  /** Manually invalidate cache entry */
  invalidate(key: string): void {
    cache.delete(key);
  },

  /** Invalidate all cache entries */
  invalidateAll(): void {
    cache.clear();
  },

  /** Get cache statistics */
  getStats() {
    return {
      totalEntries: cache.size,
      keys: [...cache.keys()],
    };
  },
};
