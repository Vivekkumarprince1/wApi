import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisClient.on('error', (err) => {
  console.error('[Redis Service] Connection Error:', err);
});

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
