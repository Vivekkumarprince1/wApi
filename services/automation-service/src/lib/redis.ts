import IORedis from 'ioredis';
import {
  assertRedisPolicy,
  bullmqConnectionOptions,
  resolveRedisUrl,
} from '@wapi/contracts';

const redisUrl = resolveRedisUrl();

export const redisClient = new IORedis(redisUrl, bullmqConnectionOptions());

redisClient.on('error', (err) => {
  console.error('[Redis Service] Connection Error:', err);
});

redisClient.on('connect', () => {
  console.log('[Redis Service] Connected to Redis');
});

let policyChecked = false;

export async function ensureRedisPolicy() {
  if (policyChecked) return;
  policyChecked = true;
  try {
    await assertRedisPolicy({
      client: redisClient as any,
      service: 'automation-service',
    });
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[automation-service] fatal redis policy error:', err?.message || err);
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
