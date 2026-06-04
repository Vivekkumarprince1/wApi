import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { WebhooksService } from '../webhooks/webhooks.service';
import { BspKafkaProducerService } from './kafka-producer.service';
import { config } from '../config';

@Injectable()
export class BspKafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private kafkaConsumer: Consumer | null = null;
  private simulatedMode = false;

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly kafkaProducer: BspKafkaProducerService,
  ) {}

  async onModuleInit() {
    const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
    const topicName = 'raw-webhook-events';

    console.log(`[BSP Kafka Consumer] Initializing connection to Kafka Broker at ${kafkaBroker}...`);

    try {
      const kafka = new Kafka({
        clientId: 'wapi-bsp-consumer',
        brokers: [kafkaBroker],
        connectionTimeout: 3000,
      });

      this.kafkaConsumer = kafka.consumer({ groupId: 'wapi-bsp-webhook-group' });
      await this.kafkaConsumer.connect();
      await this.kafkaConsumer.subscribe({ topic: topicName, fromBeginning: false });

      await this.kafkaConsumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const messageValue = message.value?.toString();
          if (!messageValue) return;

          const maxRetries = 3;
          let attempt = 0;
          let success = false;
          let lastError: any = null;

          while (attempt < maxRetries && !success) {
            try {
              attempt++;
              const envelope = JSON.parse(messageValue);
              console.log(`[BSP Kafka Consumer] Ingested raw webhook event. key: ${message.key?.toString()}, eventId: ${envelope.eventId}, attempt: ${attempt}`);

              const rawBody = JSON.stringify(envelope.rawPayload);
              const mockHeaders: Record<string, string> = {
                'x-delivery-id': envelope.eventId,
                'content-type': 'application/json',
              };

              await this.webhooksService.receiveGupshup(rawBody, mockHeaders, envelope.rawPayload);
              console.log(`[BSP Kafka Consumer] Webhook processed successfully inside BSP service. eventId: ${envelope.eventId}`);
              success = true;
            } catch (err: any) {
              lastError = err;
              console.error(`[BSP Kafka Consumer] Attempt ${attempt} failed:`, err.message);
              if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }

          if (!success) {
            console.error(`[BSP Kafka Consumer] Webhook processing failed after ${maxRetries} attempts. Publishing to DLQ...`);
            try {
              const dlqTopic = `${topic}-dlq`;
              await this.kafkaProducer.send(dlqTopic, [{
                key: message.key?.toString() || '',
                value: messageValue,
                headers: {
                  ...message.headers,
                  'x-dead-letter-reason': lastError?.message || 'unknown',
                  'x-dead-letter-attempts': String(maxRetries),
                }
              }]);
              console.log(`[BSP Kafka Consumer] Successfully published dead letter to ${dlqTopic}`);
            } catch (dlqErr: any) {
              console.error('[BSP Kafka Consumer] Failed to publish dead letter to DLQ:', dlqErr.message);
            }
          }
        },
      });

      console.log(`[BSP Kafka Consumer] Successfully subscribed to topic "${topicName}"`);
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`[BSP Kafka Consumer] Failed to connect to Kafka Broker at ${kafkaBroker}: ${error.message}`);
      }
      this.simulatedMode = true;
      console.warn(`[BSP Kafka Consumer] Failed to connect to Kafka Broker: ${error.message}. Running in local fallback mode. Ensure Kafka is active for real-time streaming.`);
    }
  }

  async onModuleDestroy() {
    if (this.kafkaConsumer) {
      try {
        await this.kafkaConsumer.disconnect();
        console.log('[BSP Kafka Consumer] Disconnected from Kafka Broker.');
      } catch (err: any) {
        console.error('[BSP Kafka Consumer] Disconnect error:', err.message);
      }
    }
  }
}
