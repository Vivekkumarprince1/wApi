import IORedis, { RedisOptions } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const MAX_REDIS_RECONNECT_ATTEMPTS = 5;

export function createRedisConnection(
  label = 'campaign-service',
  options: RedisOptions = {}
) {
  const redis = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 4,
    retryStrategy(times) {
      if (times > MAX_REDIS_RECONNECT_ATTEMPTS) return null;
      return Math.min(times * 500, 5000);
    },
    ...options,
  });

  const loggedMessages = new Set<string>();
  redis.on('error', (err) => {
    if (loggedMessages.has(err.message)) return;
    loggedMessages.add(err.message);
    console.warn(`[${label}] Redis connection unavailable: ${err.message}`);
  });

  redis.on('ready', () => {
    loggedMessages.clear();
  });

  return redis;
}

const redis = createRedisConnection('campaign-service:shared');

export const getSharedRedis = () => redis;
export default redis;
