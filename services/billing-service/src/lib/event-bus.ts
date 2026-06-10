import { Kafka, Producer, Partitioners } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'billing-service-events',
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

export async function publishBillingEvent(event: string, workspaceId: string, payload: any) {
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
      topic: 'billing-events',
      messages: [{ key: workspaceId, value: JSON.stringify(message) }],
    });
    return;
  } catch (error: any) {
    console.error(`[Billing Kafka] Failed to publish ${event}:`, error.message);
    throw error;
  }
}
