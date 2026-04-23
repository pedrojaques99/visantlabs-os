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
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Redis] Connection failed, graceful degradation enabled', err.message);
  }
});

// Safe proxy: returns no-op defaults when Redis is not connected, preventing
// unhandled "Connection is closed" errors from crashing the server.
const NOOP_DEFAULTS: Record<string, unknown> = {
  lpush: 0, rpush: 0, lrange: [], lrem: 0, llen: 0,
  get: null, set: 'OK', del: 0, expire: 0, exists: 0,
  hget: null, hset: 0, hdel: 0, hgetall: null,
  sadd: 0, smembers: [], srem: 0,
  ping: 'PONG',
};

export const redisClient = new Proxy(redis, {
  get(target, prop: string) {
    const value = target[prop as keyof typeof target];
    if (typeof value !== 'function') return value;
    return async (...args: unknown[]) => {
      if (target.status !== 'ready') {
        return prop in NOOP_DEFAULTS ? NOOP_DEFAULTS[prop] : null;
      }
      return (value as Function).apply(target, args);
    };
  },
});

export async function initRedis(): Promise<boolean> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    console.log(`[Redis] Connected (${pong})`);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Redis] Connection failed on init, continuing without cache');
    }
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
