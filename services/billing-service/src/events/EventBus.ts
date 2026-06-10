/**
 * Billing event bus — Kafka-backed.
 *
 * Outbound: publishes to `campaign-events` topic via `campaignEventsQueue.add(name, payload)`.
 * Inbound:  consumes `billing-events` topic and dispatches to LedgerService.
 *
 * Same exported API as the previous BullMQ version so existing call sites work unchanged.
 */

import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';
import { LedgerService } from '../services/LedgerService';

const BILLING_EVENTS_TOPIC = 'billing-events';
const CAMPAIGN_EVENTS_TOPIC = 'campaign-events';

const kafka = new Kafka({
  clientId: 'billing-service-eventbus',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer: Producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
});
const consumer: Consumer = kafka.consumer({ groupId: 'billing-service-eventbus-group' });

let producerReady: Promise<void> | null = null;
function ensureProducer(): Promise<void> {
  if (!producerReady) producerReady = producer.connect();
  return producerReady;
}

function topicAdapter(topic: string) {
  return {
    async add(eventName: string, data: any): Promise<void> {
      await ensureProducer();
      await producer.send({
        topic,
        messages: [
          {
            key: eventName,
            value: JSON.stringify({ name: eventName, data, ts: Date.now() }),
          },
        ],
      });
    },
  };
}

export const billingEventsQueue = topicAdapter(BILLING_EVENTS_TOPIC);
export const campaignEventsQueue = topicAdapter(CAMPAIGN_EVENTS_TOPIC);

const ledgerService = new LedgerService();

// Handlers

const handleCampaignCreated = async (data: any) => {
  console.log(`[BillingEventBus] Handling CampaignCreated for ${data.campaignId}`);
  try {
    await ledgerService.reserveCampaignBudget(data.workspaceId, data.estimatedCost, data.campaignId);

    await campaignEventsQueue.add('BudgetReservedEvent', {
      campaignId: data.campaignId,
      workspaceId: data.workspaceId,
      totalReservation: data.estimatedCost,
      contacts: data.contacts,
      templateId: data.templateId,
      templateSnapshot: data.templateSnapshot,
      variableMapping: data.variableMapping,
    });
    console.log(`[BillingEventBus] Budget reserved for ${data.campaignId}`);
  } catch (error: any) {
    console.error(`[BillingEventBus] Failed to reserve budget for ${data.campaignId}: ${error.message}`);
    await campaignEventsQueue.add('BudgetReservationFailedEvent', {
      campaignId: data.campaignId,
      workspaceId: data.workspaceId,
      reason: error.message,
    });
  }
};

const handleCampaignCompleted = async (data: any) => {
  console.log(`[BillingEventBus] Handling CampaignCompleted for ${data.campaignId}`);
  try {
    await ledgerService.settleCampaignBudget(
      data.workspaceId,
      data.campaignId,
      data.reservedAmount,
      data.actualSpend
    );
    console.log(`[BillingEventBus] Campaign ${data.campaignId} budget settled`);
  } catch (error: any) {
    console.error(`[BillingEventBus] Failed to settle budget for ${data.campaignId}: ${error.message}`);
    throw error;
  }
};

const dispatchByName: Record<string, (data: any) => Promise<void>> = {
  CampaignCreatedEvent: handleCampaignCreated,
  CampaignCompletedEvent: handleCampaignCompleted,
};

/**
 * Start consuming `billing-events`. Call once at boot (after Mongo is up).
 */
export async function startBillingEventConsumer(): Promise<void> {
  await ensureProducer();
  await consumer.connect();
  await consumer.subscribe({ topic: BILLING_EVENTS_TOPIC, fromBeginning: false });
  await consumer.subscribe({ topic: 'chat-realtime-sync', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      // 1. Process chat-realtime-sync events for UsageTracker
      if (topic === 'chat-realtime-sync') {
        try {
          const value = message.value?.toString();
          if (!value) return;
          const parsed = JSON.parse(value);
          if (parsed.type === 'message_created' && parsed.payload?.isInternalNote !== true) {
            const workspaceId = parsed.workspaceId;
            if (workspaceId) {
              const { UsageTracker } = await import('../services/UsageTracker.js');
              await UsageTracker.increment(workspaceId, 'messages');
              console.log(`[BillingEventBus] Incremented message usage count for workspace ${workspaceId}`);
            }
          }
        } catch (err: any) {
          console.error(`[BillingEventBus] Failed to process chat-realtime-sync event for billing: ${err.message}`);
        }
        return;
      }

      // 2. Existing billing-events logic
      const key = message.key?.toString();
      if (!key) return;

      const handler = dispatchByName[key];
      if (!handler) {
        console.warn(`[BillingEventBus] Unknown event type: ${key}`);
        return;
      }

      let payload: any;
      try {
        const raw = message.value?.toString() ?? '{}';
        const parsed = JSON.parse(raw);
        payload = parsed?.data ?? parsed;
      } catch (err: any) {
        console.error(`[BillingEventBus] Bad JSON for ${key}: ${err.message}`);
        return;
      }

      try {
        await handler(payload);
        console.log(`[BillingEventBus] Handled ${key}`);
      } catch (err: any) {
        console.error(`[BillingEventBus] Handler ${key} failed: ${err.message}`);
      }
    },
  });

  console.log(`[BillingEventBus] Kafka consumer subscribed to "${BILLING_EVENTS_TOPIC}" and "chat-realtime-sync"`);
}
