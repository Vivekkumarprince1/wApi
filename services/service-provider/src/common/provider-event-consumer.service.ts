import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { WebhooksService } from '../channels/whatsapp/webhooks/webhooks.service';
import { InstagramWebhooksService } from '../channels/instagram/instagram-webhooks.service';
import { ProviderEventProducerService } from './provider-event-producer.service';
import { config } from '../config';
import { createRedisClient } from './redis.service';

@Injectable()
export class ProviderEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private redisConsumer: Redis | null = null;
  private simulatedMode = false;

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly instagramWebhooksService: InstagramWebhooksService,
    private readonly eventProducer: ProviderEventProducerService,
  ) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    const topicName = 'raw-webhook-events';
    const backgroundWorkersEnabled = process.env.ENABLE_BACKGROUND_WORKERS !== 'false';

    if (!backgroundWorkersEnabled) {
      this.simulatedMode = true;
      console.warn('[BSP EventBus Consumer] Disabled for local development. Set ENABLE_BACKGROUND_WORKERS=true to enable it.');
      return;
    }

    if (!redisUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[BSP EventBus Consumer] REDIS_URL is missing in production');
      }
      this.simulatedMode = true;
      console.warn('[BSP EventBus Consumer] REDIS_URL missing. Running in simulated mode.');
      return;
    }

    console.log('[BSP EventBus Consumer] Initializing connection to Redis...');

    try {
      this.redisConsumer = createRedisClient('bsp-event-consumer', redisUrl);
      
      this.redisConsumer.subscribe(topicName, (err, count) => {
        if (err) {
          console.error(`[BSP EventBus Consumer] Failed to subscribe to ${topicName}`);
        } else {
          console.log(`[BSP EventBus Consumer] Successfully subscribed to topic "${topicName}"`);
        }
      });

      this.redisConsumer.on('message', async (topic, messageStr) => {
        if (topic !== topicName) return;

        let messageWrapper: any;
        let envelope: any;
        try {
          messageWrapper = JSON.parse(messageStr);
          envelope = this.unwrapRawWebhookEnvelope(messageWrapper);
        } catch (err) {
          console.error('[BSP EventBus Consumer] Bad JSON:', err);
          return;
        }

        const maxRetries = 3;
        let attempt = 0;
        let success = false;
        let lastError: any = null;

        while (attempt < maxRetries && !success) {
          try {
            attempt++;
            console.log(`[BSP EventBus Consumer] Ingested raw webhook event. eventId: ${envelope.eventId}, attempt: ${attempt}`);

            if (!envelope.rawPayload) {
              throw new Error('raw webhook envelope is missing rawPayload');
            }

            const rawBody = envelope.rawBody || JSON.stringify(envelope.rawPayload);
            const mockHeaders: Record<string, string> = {
              ...(envelope.headers || {}),
              'x-delivery-id': envelope.eventId,
              'content-type': 'application/json',
            };

            const provider = String(envelope.provider || envelope.rawPayload?.provider || '').toLowerCase();
            const channel = String(envelope.channel || envelope.rawPayload?.channel || '').toLowerCase();
            if (provider === 'instagram' || channel === 'instagram') {
              await this.instagramWebhooksService.receiveInstagram(rawBody, mockHeaders, envelope.rawPayload);
            } else {
              await this.webhooksService.receiveGupshup(rawBody, mockHeaders, envelope.rawPayload, {
                skipSignatureVerification: true,
              });
            }
            console.log(`[BSP EventBus Consumer] Webhook processed successfully inside BSP service. eventId: ${envelope.eventId}`);
            success = true;
          } catch (err: any) {
            lastError = err;
            console.error(`[BSP EventBus Consumer] Attempt ${attempt} failed:`, err.message);
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        if (!success) {
          console.error(`[BSP EventBus Consumer] Webhook processing failed after ${maxRetries} attempts. Publishing to DLQ...`);
          try {
            const dlqTopic = `${topic}-dlq`;
            await this.eventProducer.send(dlqTopic, [{
              key: envelope?.eventId || messageWrapper?.key || '',
              value: messageStr,
              headers: {
                'x-dead-letter-reason': lastError?.message || 'unknown',
                'x-dead-letter-attempts': String(maxRetries),
              }
            }]);
            console.log(`[BSP EventBus Consumer] Successfully published dead letter to ${dlqTopic}`);
          } catch (dlqErr: any) {
            console.error('[BSP EventBus Consumer] Failed to publish dead letter to DLQ:', dlqErr.message);
          }
        }
      });

    } catch (error: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`[BSP EventBus Consumer] Failed to connect to Redis at ${redisUrl}: ${error.message}`);
      }
      this.simulatedMode = true;
      console.warn(`[BSP EventBus Consumer] Failed to connect to Redis: ${error.message}. Running in local fallback mode. Ensure Redis is active for real-time streaming.`);
    }
  }

  async onModuleDestroy() {
    if (this.redisConsumer) {
      try {
        await this.redisConsumer.disconnect();
        console.log('[BSP EventBus Consumer] Disconnected from Redis.');
      } catch (err: any) {
        console.error('[BSP EventBus Consumer] Disconnect error:', err.message);
      }
    }
  }

  private unwrapRawWebhookEnvelope(message: any) {
    if (message?.value) {
      return typeof message.value === 'string' ? JSON.parse(message.value) : message.value;
    }
    return message;
  }
}
