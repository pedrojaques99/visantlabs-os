import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { redisClient, initRedis, isRedisHealthy } from '../server/lib/redis';
import { CACHE_TTL, CacheKey, hashQuery } from '../server/lib/cache-utils';

describe('Redis Cache', () => {
  beforeAll(async () => {
    await initRedis();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  it('should connect to Redis', async () => {
    const healthy = await isRedisHealthy();
    expect(healthy).toBe(true);
  });

  it('should cache and retrieve expert RAG', async () => {
    const userId = 'test-user';
    const projectId = 'test-project';
    const query = 'What is brand color?';
    const queryHash = hashQuery(query, '');

    const key = CacheKey.expertRag(userId, projectId, queryHash);
    const testData = { answer: 'Blue is primary' };

    await redisClient.setex(key, CACHE_TTL.EXPERT_RAG, JSON.stringify(testData));
    const cached = await redisClient.get(key);

    expect(cached).toBe(JSON.stringify(testData));
  });

  it('should cache mockup generations', async () => {
    const userId = 'test-user';
    const prompt = 'Create mockup';
    const promptHash = hashQuery(prompt, 'model123');

    const key = CacheKey.mockupGen(userId, promptHash);
    const mockupData = { imageUrl: 'https://example.com/img.png', seed: 123 };

    await redisClient.setex(key, CACHE_TTL.MOCKUP_GEN, JSON.stringify(mockupData));
    const cached = await redisClient.get(key);

    expect(cached).toBe(JSON.stringify(mockupData));
  });

  it('should expire keys after TTL', async () => {
    const key = 'test:expiry';
    await redisClient.setex(key, 1, 'expires soon');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));

    const expired = await redisClient.get(key);
    expect(expired).toBeNull();
  });
});
