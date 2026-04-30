import IORedis from 'ioredis';
import { config } from './config';

const REDIS_URL = config.redisUrl;

// Caching connections in global object for Next.js HMR to prevent connection leaks
const globalForRedis = global as unknown as { 
  ioredisShared?: IORedis;
  ioredisSubscriber?: IORedis;
  ioredisBclient?: IORedis;
};

export const getSharedConnection = () => {
  if (!globalForRedis.ioredisShared) {
    globalForRedis.ioredisShared = new IORedis(REDIS_URL, { 
      maxRetriesPerRequest: null,
      family: 4 
    });
  }
  return globalForRedis.ioredisShared;
};

export const getConnectionForWorker = (type: 'client' | 'subscriber' | 'bclient') => {
  if (type === 'client') return getSharedConnection();
  
  if (type === 'subscriber') {
    if (!globalForRedis.ioredisSubscriber) {
      globalForRedis.ioredisSubscriber = new IORedis(REDIS_URL, { 
        maxRetriesPerRequest: null,
        family: 4 
      });
    }
    return globalForRedis.ioredisSubscriber;
  }
  
  if (type === 'bclient') {
    if (!globalForRedis.ioredisBclient) {
      globalForRedis.ioredisBclient = new IORedis(REDIS_URL, { 
        maxRetriesPerRequest: null,
        family: 4 
      });
    }
    return globalForRedis.ioredisBclient;
  }
  
  return getSharedConnection();
};
