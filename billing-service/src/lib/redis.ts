import IORedis from 'ioredis';
import {
  assertRedisPolicy,
  bullmqConnectionOptions,
  resolveRedisUrl,
} from '@wapi/contracts';

const redisUrl = process.env.REDIS_URL || resolveRedisUrl();

export const redisClient = new IORedis(redisUrl, bullmqConnectionOptions());

redisClient.on('error', (err) => {
  console.error('[Redis Service] Connection Error:', err);
});

let policyChecked = false;

/**
 * Validate Redis `maxmemory-policy` once on boot. Subsequent calls are
 * no-ops so workers and the HTTP server can both invoke this without
 * double-logging.
 */
export async function ensureRedisPolicy() {
  if (policyChecked) return;
  policyChecked = true;
  try {
    await assertRedisPolicy({
      client: redisClient as any,
      service: 'billing-service',
    });
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[billing-service] fatal redis policy error:', err?.message || err);
      process.exit(1);
    }
  }
}

/**
 * Publish an event to the global event bridge
 */
export async function publishEvent(channel: 'automation:events' | 'campaign:events' | 'billing:events', event: string, workspaceId: string, payload: any) {
  try {
    const message = JSON.stringify({
      event,
      workspaceId,
      payload,
      timestamp: new Date().toISOString()
    });
    await redisClient.publish(channel, message);
  } catch (error) {
    console.error(`[Redis Service] Failed to publish event ${event}:`, error);
  }
}
