/**
 * Documentation Caching Service
 * Manages in-memory caching with TTL for generated specs
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

export class DocsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private timers = new Map<string, NodeJS.Timeout>();

  /**
   * Get cached value or generate new one
   * @param key - Cache key
   * @param generator - Function to generate value if not cached
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  getOrGenerate<T>(
    key: string,
    generator: () => T,
    ttl: number = 5 * 60 * 1000 // 5 minutes default
  ): T {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached value if still valid
    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }

    try {
      // Generate new value
      const data = generator();

      // Store in cache
      this.cache.set(key, {
        data,
        timestamp: now,
        ttl,
      });

      // Clear old timer if exists
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }

      // Set auto-cleanup timer
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl);

      this.timers.set(key, timer);

      return data;
    } catch (error) {
      // Log error but don't cache failures
      console.error(`[DocsCache] Generation failed for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Manually invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      totalEntries: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const docsCache = new DocsCache();
