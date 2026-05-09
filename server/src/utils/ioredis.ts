import IORedis, { Redis as IORedisType, RedisOptions } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const baseOptions: RedisOptions = {
  // BullMQ workers require this; harmless for general use.
  maxRetriesPerRequest: null,
};

/**
 * Shared Redis client.
 *
 * Use this for general key/value access (caches, locks, rate limiting,
 * fire-and-forget pub/sub). BullMQ workers and Redis subscribers MUST
 * use a dedicated connection — call `getConnectionForWorker(...)` for
 * those (Redis blocks on the connection while subscribed and BullMQ
 * needs a long-lived blocking client).
 */
const sharedRedis: IORedisType = new IORedis(redisUrl, baseOptions);

sharedRedis.on('error', (err) => {
  console.error('[Redis][shared]', err?.message || err);
});
sharedRedis.on('reconnecting', () => {
  console.warn('[Redis][shared] reconnecting…');
});
sharedRedis.on('end', () => {
  console.warn('[Redis][shared] connection closed');
});

/**
 * Returns a NEW dedicated Redis connection for callers that need to
 * subscribe or block (BullMQ workers, pub/sub subscribers). Each
 * connection wires its own error handler.
 */
export const getConnectionForWorker = (label: string): IORedisType => {
  const conn = new IORedis(redisUrl, baseOptions);
  conn.on('error', (err) => {
    console.error(`[Redis][${label}]`, err?.message || err);
  });
  return conn;
};

/**
 * Returns the shared (pooled) Redis client. Always returns the same
 * instance; do not call `.disconnect()` on this client.
 */
export const getSharedConnection = (): IORedisType => sharedRedis;

/** Alias to keep grep-friendly naming consistent across the codebase. */
export const getSharedRedis = getSharedConnection;

export { sharedRedis as redis };
export default sharedRedis;
