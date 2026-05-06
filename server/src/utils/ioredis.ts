import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

/**
 * BullMQ requires a dedicated connection for workers
 */
export const getConnectionForWorker = (type: string) => {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
};

/**
 * Shared connection for queues
 */
export const getSharedConnection = () => {
  return redis;
};

export { redis };
export default redis;
