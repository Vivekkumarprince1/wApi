import redis from './utils/ioredis';

/**
 * REDIS HELPERS
 * Ported from legacy monolith to support distributed services.
 */

export const connectRedis = async () => {
  // ioredis connects automatically, but we provide this for compatibility
  return redis;
};

export const getJson = async (key: string) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

export const setJson = async (key: string, value: any, ttlSeconds?: number) => {
  const data = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.set(key, data, 'EX', ttlSeconds);
  } else {
    await redis.set(key, data);
  }
};

export const deleteKey = async (key: string) => {
  await redis.del(key);
};

export { redis };
export default redis;
