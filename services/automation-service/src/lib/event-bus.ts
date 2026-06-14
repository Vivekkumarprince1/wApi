import Redis from 'ioredis';
import { KafkaTopics } from '@wapi/contracts';

let producerClient: Redis | null = null;
let producerReady: Promise<void> | null = null;

async function ensureProducer() {
  if (!producerReady) {
    const url = process.env.REDIS_URL;
    if (!url) {
      producerReady = Promise.reject(new Error('REDIS_URL is not defined'));
      return producerReady;
    }

    producerClient = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
    producerReady = producerClient.connect().then(() => {
      console.log('[Automation EventBus] Redis Producer connected.');
    }).catch((error) => {
      producerReady = null;
      throw error;
    });
  }
  return producerReady;
}

export async function publishAutomationEvent(event: string, workspaceId: string, payload: any) {
  const message = {
    eventId: `${event}_${workspaceId}_${Date.now()}`,
    event,
    workspaceId,
    payload,
    timestamp: new Date().toISOString()
  };

  try {
    await ensureProducer();
    if (producerClient) {
      await producerClient.publish(
        KafkaTopics.AUTOMATION_EVENTS,
        JSON.stringify({ key: workspaceId, value: JSON.stringify(message) })
      );
    }
    return;
  } catch (error: any) {
    console.error(`[Automation EventBus] Failed to publish ${event}:`, error.message);
    throw error;
  }
}
