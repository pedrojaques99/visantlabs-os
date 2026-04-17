import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    if (times > 5) return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.warn('[Redis] Connection failed, graceful degradation enabled', err.message);
});

export const redisClient = redis;

export async function initRedis(): Promise<boolean> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    console.log(`[Redis] Connected (${pong})`);
    return true;
  } catch (err) {
    console.warn('[Redis] Connection failed on init, continuing without cache');
    return false;
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
