/**
 * assetPipeline — Redis-backed "Send to →" queue per userId.
 * Lets users push an asset (image URL or base64) from any tool
 * and consume it in any other tool (Canvas, MockupMachine, Extractor).
 *
 * Uses a Redis List per userId (same pattern as pluginQueue).
 * Items expire after 24h — transient handoff, not long-term storage.
 */

import { randomUUID } from 'crypto';
import { redisClient } from './redis.js';
import { CacheKey, CACHE_TTL } from './cache-utils.js';

export type AssetSource = 'canvas' | 'mockupmachine' | 'extractor' | 'creative';
export type AssetTarget = 'canvas' | 'mockupmachine' | 'extractor';

export interface PipelineAsset {
  id: string;
  userId: string;
  source: AssetSource;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  label?: string;
  enqueuedAt: string;
}

const TTL = CACHE_TTL.ASSET_PIPELINE;

export const assetPipeline = {
  async enqueue(userId: string, asset: Omit<PipelineAsset, 'id' | 'userId' | 'enqueuedAt'>): Promise<PipelineAsset> {
    const full: PipelineAsset = {
      ...asset,
      id: randomUUID(),
      userId,
      enqueuedAt: new Date().toISOString(),
    };
    const key = CacheKey.assetPipeline(userId);
    await redisClient.lpush(key, JSON.stringify(full));
    await redisClient.expire(key, TTL);
    return full;
  },

  async list(userId: string): Promise<PipelineAsset[]> {
    const key = CacheKey.assetPipeline(userId);
    const items = await redisClient.lrange(key, 0, -1);
    return items
      .reverse()
      .map((raw) => {
        try { return JSON.parse(raw) as PipelineAsset; }
        catch { return null; }
      })
      .filter((a): a is PipelineAsset => a !== null);
  },

  async remove(userId: string, assetId: string): Promise<void> {
    const key = CacheKey.assetPipeline(userId);
    const items = await redisClient.lrange(key, 0, -1);
    for (const raw of items) {
      try {
        const asset = JSON.parse(raw) as PipelineAsset;
        if (asset.id === assetId) {
          await redisClient.lrem(key, 1, raw);
          return;
        }
      } catch { /* skip malformed */ }
    }
  },

  async clear(userId: string): Promise<void> {
    await redisClient.del(CacheKey.assetPipeline(userId));
  },

  async size(userId: string): Promise<number> {
    return redisClient.llen(CacheKey.assetPipeline(userId));
  },
};
