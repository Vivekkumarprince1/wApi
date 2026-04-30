import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);

export const getSharedConnection = () => redis;
export const getConnectionForWorker = () => new Redis(redisUrl, { maxRetriesPerRequest: null });

export default redis;
