import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { WebhooksService } from '../channels/whatsapp/webhooks/webhooks.service';
import { ProviderKafkaProducerService } from './provider-kafka-producer.service';
import { config } from '../config';

@Injectable()
export class ProviderKafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private redisConsumer: Redis | null = null;
  private simulatedMode = false;

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly kafkaProducer: ProviderKafkaProducerService,
  ) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    const topicName = 'raw-webhook-events';

    if (!redisUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[BSP EventBus Consumer] REDIS_URL is missing in production');
      }
      this.simulatedMode = true;
      console.warn('[BSP EventBus Consumer] REDIS_URL missing. Running in simulated mode.');
      return;
    }

    console.log(`[BSP EventBus Consumer] Initializing connection to Redis at ${redisUrl}...`);

    try {
      this.redisConsumer = new Redis(redisUrl);
      
      this.redisConsumer.subscribe(topicName, (err, count) => {
        if (err) {
          console.error(`[BSP EventBus Consumer] Failed to subscribe to ${topicName}`);
        } else {
          console.log(`[BSP EventBus Consumer] Successfully subscribed to topic "${topicName}"`);
        }
      });

      this.redisConsumer.on('message', async (topic, messageStr) => {
        if (topic !== topicName) return;

        let envelope;
        try {
          envelope = JSON.parse(messageStr);
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

            const rawBody = JSON.stringify(envelope.rawPayload);
            const mockHeaders: Record<string, string> = {
              'x-delivery-id': envelope.eventId,
              'content-type': 'application/json',
            };

            await this.webhooksService.receiveGupshup(rawBody, mockHeaders, envelope.rawPayload);
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
            await this.kafkaProducer.send(dlqTopic, [{
              key: envelope.eventId || '',
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
}
