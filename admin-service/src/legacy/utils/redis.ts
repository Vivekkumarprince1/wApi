import Redis from 'ioredis';
import config from '../config/index.js';

let redis: Redis | null = null;

if (config.redisUrl) {
  try {
    redis = new (Redis as any)(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times: number) {
        // Backoff retry
        return Math.min(times * 100, 3000);
      }
    });

    if (redis) {
      redis.on('error', (err) => {
        console.error(`[Redis Error]: ${err.message}`);
      });

      redis.on('connect', () => {
        console.log('[Redis] Connected to server.');
      });
    }
  } catch (err: any) {
    console.error(`[Redis Connection Error]: ${err.message}`);
  }
}

export const getCache = async (key: string): Promise<string | null> => {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (err: any) {
    console.error(`[Redis getCache Error]: ${err.message}`);
    return null;
  }
};

export const setCache = async (key: string, value: string, ttlSeconds: number = 60): Promise<void> => {
  if (!redis) return;
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch (err: any) {
    console.error(`[Redis setCache Error]: ${err.message}`);
  }
};

export const invalidateCache = async (key: string): Promise<void> => {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err: any) {
    console.error(`[Redis invalidateCache Error]: ${err.message}`);
  }
};

export const invalidateCachePattern = async (pattern: string): Promise<void> => {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err: any) {
    console.error(`[Redis invalidateCachePattern Error]: ${err.message}`);
  }
};

export default redis;
