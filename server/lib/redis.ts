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

// Throttle noisy repeated errors (same message fires on every reconnect attempt
// and every queued command after connection is down). One log per minute per message.
const lastLoggedAt = new Map<string, number>();
const LOG_THROTTLE_MS = 60_000;
redis.on('error', (err) => {
  const key = err.message;
  const now = Date.now();
  const prev = lastLoggedAt.get(key) ?? 0;
  if (now - prev < LOG_THROTTLE_MS) return;
  lastLoggedAt.set(key, now);
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
