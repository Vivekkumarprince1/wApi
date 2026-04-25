const IORedis = require('ioredis');
const { redisUrl } = require('../../config');

/**
 * Shared Redis Connection
 * 
 * To prevent 'ERR max number of clients reached' on free Redis plans (max 30 clients),
 * all non-blocking Redis operations and Queue instances should share this single connection.
 * BullMQ Workers and QueueEvents will duplicate this automatically for their blocking needs.
 */

const sharedConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('[SharedRedis] Connection failed after 10 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  }
});

// Single error handler to avoid console spam
let errorLogged = false;
sharedConnection.on('error', (err) => {
  if (!errorLogged) {
    console.error('[SharedRedis] Error:', err.message);
    errorLogged = true;
    setTimeout(() => { errorLogged = false; }, 5000);
  }
});

sharedConnection.on('connect', () => {
  console.log('[SharedRedis] Connected to Redis');
});

module.exports = {
  sharedConnection
};
