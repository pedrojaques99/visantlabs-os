/**
 * pluginQueue — Redis-backed persistence for Figma operations queued while
 * the plugin is offline. Uses a Redis List per fileId (LPUSH / LRANGE / DEL).
 *
 * Each item in the list is a JSON-encoded QueuedBatch. When the plugin connects,
 * pluginBridge drains the queue by calling pop() in order and pushing via WS.
 */

import { redisClient } from './redis.js';
import { CacheKey, CACHE_TTL } from './cache-utils.js';

export interface QueuedBatch {
  id: string;
  operations: any[];
  enqueuedAt: string;
  userId: string;
  chatSessionId?: string;   // AdminChat session to notify on drain
  meta?: {
    prompt?: string;
    brandId?: string;
    format?: string;
  };
}

const TTL = CACHE_TTL.FIGMA_OP_QUEUE;

export const pluginQueue = {
  /** Append a batch of operations to the queue for a given Figma fileId. */
  async enqueue(fileId: string, batch: QueuedBatch): Promise<void> {
    const key = CacheKey.figmaOpQueue(fileId);
    await redisClient.lpush(key, JSON.stringify(batch));
    await redisClient.expire(key, TTL);
  },

  /** Read all pending batches in insertion order (oldest first). */
  async peek(fileId: string): Promise<QueuedBatch[]> {
    const key = CacheKey.figmaOpQueue(fileId);
    const items = await redisClient.lrange(key, 0, -1);
    // LPUSH prepends → reverse to get chronological order
    return items
      .reverse()
      .map((raw) => {
        try { return JSON.parse(raw) as QueuedBatch; }
        catch { return null; }
      })
      .filter((b): b is QueuedBatch => b !== null);
  },

  /** Remove all batches for a fileId (called after successful drain). */
  async clear(fileId: string): Promise<void> {
    await redisClient.del(CacheKey.figmaOpQueue(fileId));
  },

  /** How many batches are pending. */
  async size(fileId: string): Promise<number> {
    return redisClient.llen(CacheKey.figmaOpQueue(fileId));
  },
};
