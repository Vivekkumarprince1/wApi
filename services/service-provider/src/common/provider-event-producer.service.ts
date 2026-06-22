import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ProviderEventProducerService implements OnModuleInit, OnModuleDestroy {
  private redisProducer: Redis | null = null;
  private simulatedMode = false;

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[BSP EventBus Producer] REDIS_URL is missing in production');
      }
      this.simulatedMode = true;
      console.warn('[BSP EventBus Producer] REDIS_URL missing. Running in simulated mode.');
      return;
    }

    console.log('[BSP EventBus Producer] Initializing connection to Redis...');

    try {
      this.redisProducer = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
      await this.redisProducer.connect();
      console.log(`[BSP EventBus Producer] Connected to Redis`);
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`[BSP EventBus Producer] Failed to connect to Redis: ${error.message}`);
      }
      this.simulatedMode = true;
      console.warn(`[BSP EventBus Producer] Failed to connect to Redis: ${error.message}. Running in local fallback mode.`);
    }
  }

  async send(topic: string, messages: Array<{ key?: string; value: string; headers?: Record<string, any> }>) {
    if (this.simulatedMode || !this.redisProducer) {
      console.log(`[SIMULATED BSP PRODUCER] Publish topic: ${topic}, messages:`, JSON.stringify(messages));
      return;
    }
    try {
      for (const msg of messages) {
        await this.redisProducer.publish(topic, JSON.stringify({
          key: msg.key,
          value: msg.value,
          headers: msg.headers
        }));
      }
    } catch (err: any) {
      console.error(`[BSP EventBus Producer] Failed to publish message to topic "${topic}":`, err.message);
    }
  }

  async onModuleDestroy() {
    if (this.redisProducer) {
      try {
        await this.redisProducer.disconnect();
        console.log('[BSP EventBus Producer] Disconnected from Redis.');
      } catch (err: any) {
        console.error('[BSP EventBus Producer] Disconnect error:', err.message);
      }
    }
  }
}
