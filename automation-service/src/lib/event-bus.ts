import { Kafka, Producer, Partitioners } from 'kafkajs';
import { KafkaTopics } from '@wapi/contracts';

const kafka = new Kafka({
  clientId: 'automation-service-events',
  brokers: (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9092').split(','),
});

const producer: Producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
});

let producerReady: Promise<void> | null = null;

async function ensureProducer() {
  if (!producerReady) {
    producerReady = producer.connect().catch((error) => {
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
    await producer.send({
      topic: KafkaTopics.AUTOMATION_EVENTS,
      messages: [{ key: workspaceId, value: JSON.stringify(message) }],
    });
    return;
  } catch (error: any) {
    console.error(`[Automation Kafka] Failed to publish ${event}:`, error.message);
    throw error;
  }
}
