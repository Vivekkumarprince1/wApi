import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class ProviderKafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private kafkaProducer: Producer | null = null;
  private simulatedMode = false;

  async onModuleInit() {
    const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
    console.log(`[BSP Kafka Producer] Initializing connection to Kafka Broker at ${kafkaBroker}...`);

    try {
      const kafka = new Kafka({
        clientId: 'wapi-bsp-producer',
        brokers: [kafkaBroker],
        connectionTimeout: 3000,
      });

      this.kafkaProducer = kafka.producer();
      await this.kafkaProducer.connect();
      console.log(`[BSP Kafka Producer] Connected to Kafka Broker at ${kafkaBroker}`);
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`[BSP Kafka Producer] Failed to connect to Kafka Broker at ${kafkaBroker}: ${error.message}`);
      }
      this.simulatedMode = true;
      console.warn(`[BSP Kafka Producer] Failed to connect to Kafka Broker: ${error.message}. Running in local fallback mode.`);
    }
  }

  async send(topic: string, messages: Array<{ key?: string; value: string; headers?: Record<string, any> }>) {
    if (this.simulatedMode || !this.kafkaProducer) {
      console.log(`[SIMULATED BSP PRODUCER] Publish topic: ${topic}, messages:`, JSON.stringify(messages));
      return;
    }
    try {
      await this.kafkaProducer.send({
        topic,
        messages,
      });
    } catch (err: any) {
      console.error(`[BSP Kafka Producer] Failed to send message to topic "${topic}":`, err.message);
    }
  }

  async onModuleDestroy() {
    if (this.kafkaProducer) {
      try {
        await this.kafkaProducer.disconnect();
        console.log('[BSP Kafka Producer] Disconnected from Kafka Broker.');
      } catch (err: any) {
        console.error('[BSP Kafka Producer] Disconnect error:', err.message);
      }
    }
  }
}
