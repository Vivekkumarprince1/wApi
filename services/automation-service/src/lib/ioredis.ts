import Redis from 'ioredis';
import { resolveRedisUrl } from '@wapi/contracts';

const redisUrl = resolveRedisUrl();

export const redis = new Redis(redisUrl);

export const getSharedConnection = () => redis;
export const getConnectionForWorker = () => new Redis(redisUrl, { maxRetriesPerRequest: null });

export default redis;
