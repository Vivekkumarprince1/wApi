/**
 * Campaign event bus — Kafka-backed.
 *
 * Outbound: publishes to `billing-events` topic via `billingEventsQueue.add(name, payload)`.
 *   - `.add(eventName, payload)` is a thin shim over `producer.send` so existing call sites
 *     in `workers/CampaignWorker.ts` keep working unchanged.
 *
 * Inbound: consumes `campaign-events` topic and dispatches by `message.key` to the same
 *   handlers we used under BullMQ (BudgetReservedEvent, BudgetReservationFailedEvent,
 *   MessageStatusUpdateEvent).
 *
 * Topics are created upfront by ops; if a topic is missing the producer/consumer will
 * surface a kafkajs error on first publish/subscribe.
 */

import mongoose from 'mongoose';
import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';
import { Campaign, ICampaignModel, CampaignMessage } from '../../models';
import { CampaignBatch, ICampaignBatchModel } from '../../models/CampaignBatch';
import { CampaignQueueService } from '../campaign-queue';
import { Workspace } from '../../models';
import { microserviceWorkerClient } from '../microservice-worker-client';
import { SegmentService } from '../../services/SegmentService';

const BILLING_EVENTS_TOPIC = 'billing-events';
const CAMPAIGN_EVENTS_TOPIC = 'campaign-events';

const kafka = new Kafka({
  clientId: 'campaign-service-eventbus',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer: Producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
});
const consumer: Consumer = kafka.consumer({ groupId: 'campaign-service-eventbus-group' });

let producerReady: Promise<void> | null = null;
function ensureProducer(): Promise<void> {
  if (!producerReady) producerReady = producer.connect();
  return producerReady;
}

/**
 * Compat shim mirroring BullMQ `Queue.add(name, data)`.
 * The event name becomes the Kafka message `key` so consumers can dispatch by `key`.
 */
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

// --- Inbound handlers (Kafka consumer on campaign-events) ---

const handleBudgetReserved = async (data: any) => {
  const { campaignId, workspaceId } = data;
  console.log(`[CampaignEventBus] Budget reserved for campaign ${campaignId}. Creating batches...`);

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return;

  try {
    let contacts = data.contacts || campaign.contacts || [];
    if ((!contacts || contacts.length === 0) && campaign.recipientFilter?.type === 'segment' && campaign.recipientFilter.segmentId) {
      contacts = await SegmentService.resolveSegmentContacts(workspaceId, campaign.recipientFilter.segmentId);
      campaign.contacts = contacts;
    }

    if (!contacts || contacts.length === 0) {
      throw new Error('NO_RECIPIENTS_FOR_BATCHING');
    }

    const templateId = data.templateId || campaign.template;
    const templateSnapshot = data.templateSnapshot || campaign.templateSnapshot;
    const variableMapping = data.variableMapping ?? campaign.variableMapping;
    const normalizedContacts = contacts.map((contact: any) => (
      contact && typeof contact === 'object' && contact._id ? contact : { _id: contact }
    ));

    const existingBatchCount = await CampaignBatch.countDocuments({ campaign: campaignId });
    if (existingBatchCount > 0) {
      console.log(`[CampaignEventBus] Campaign ${campaignId} already has ${existingBatchCount} batch(es). Skipping duplicate batch creation.`);
      return;
    }

    const batches = await (CampaignBatch as ICampaignBatchModel).createBatches(
        campaignId,
        workspaceId,
        normalizedContacts,
        templateId,
        templateSnapshot?.name || 'template',
        variableMapping,
        50
    );

    const workspace = await Workspace.findById(workspaceId).lean() as any;
    const mps = workspace?.inboxSettings?.agentMessagesPerMinute ? workspace.inboxSettings.agentMessagesPerMinute / 60 : 10;
    const delayPerBatch = Math.ceil((50 / mps) * 1000);

    for (let i = 0; i < batches.length; i++) {
        await CampaignQueueService.enqueueBatch(
            batches[i]._id,
            campaignId,
            workspaceId,
            i,
            i * delayPerBatch
        );
    }

    campaign.status = 'RUNNING';
    campaign.startedAt = new Date();
    await campaign.save();

    await microserviceWorkerClient.socketBroadcast(workspaceId, "campaign:status_update", {
        campaignId,
        status: 'RUNNING',
        totalBatches: batches.length,
        updatedAt: campaign.updatedAt,
        startedAt: campaign.startedAt
    });
  } catch (error) {
    console.error(`[CampaignEventBus] Error creating batches:`, error);
    throw error;
  }
};

const handleMessageStatusUpdate = async (data: any) => {
  const { campaignId, status, contactId, whatsappMessageId, timestamp } = data;
  if (!campaignId || !status) return;

  const campaignObjectId = new mongoose.Types.ObjectId(campaignId as string);
  const contactObjectId = contactId ? new mongoose.Types.ObjectId(contactId as string) : null;

  let field = '';
  const updateData: any = {
    status,
    updatedAt: new Date()
  };

  switch (status) {
    case 'delivered':
      field = 'delivered';
      updateData.deliveredAt = timestamp || new Date();
      break;
    case 'read':
      field = 'read';
      updateData.readAt = timestamp || new Date();
      break;
    case 'failed':
      field = 'failed';
      updateData.failedAt = timestamp || new Date();
      break;
    case 'sent':
      field = 'sent';
      updateData.sentAt = timestamp || new Date();
      break;
    default: return;
  }

  console.log(`[CampaignEventBus] Processing ${field} for campaign ${campaignId} (Contact: ${contactId || 'unknown'})`);

  try {
    let messageUpdate;
    if (contactObjectId) {
      messageUpdate = await CampaignMessage.findOneAndUpdate(
        { campaign: campaignObjectId, contact: contactObjectId },
        { $set: updateData },
        { upsert: false, new: true }
      );
    } else if (whatsappMessageId) {
      messageUpdate = await CampaignMessage.findOneAndUpdate(
        { whatsappMessageId },
        { $set: updateData },
        { upsert: false, new: true }
      );
    }

    if (messageUpdate) {
      console.log(`[CampaignEventBus] ✓ Updated CampaignMessage for ${contactId || whatsappMessageId}`);
    } else {
      console.warn(`[CampaignEventBus] ⚠ CampaignMessage not found for ${contactId || whatsappMessageId}`);
    }

    await Campaign.incrementTotal(campaignId, field);
    console.log(`[CampaignEventBus] ✓ Incremented ${field} for campaign ${campaignId}`);
  } catch (err: any) {
    console.error(`[CampaignEventBus] ❌ Error updating metrics:`, err.message);
  }
};

const handleBudgetReservationFailed = async (data: any) => {
  const { campaignId, workspaceId, reason } = data;
  console.log(`[CampaignEventBus] Budget reservation failed for ${campaignId}: ${reason}`);

  const campaign = await Campaign.findById(campaignId);
  if (campaign) {
    campaign.status = 'PAUSED';
    await (Campaign as ICampaignModel).addAuditEntry(campaignId, 'SYSTEM_PAUSED', {
        reason: `Budget failed: ${reason}`,
        systemInitiated: true
    });
    await campaign.save();

    await microserviceWorkerClient.socketBroadcast(workspaceId, 'campaign:status_update', {
      campaignId,
      status: 'PAUSED',
      reason,
      updatedAt: campaign.updatedAt,
    });
  }
};

const dispatchByName: Record<string, (data: any) => Promise<void>> = {
  BudgetReservedEvent: handleBudgetReserved,
  BudgetReservationFailedEvent: handleBudgetReservationFailed,
  MessageStatusUpdateEvent: handleMessageStatusUpdate,
};

/**
 * Start consuming `campaign-events`. Call once at boot (after Mongo is up).
 */
export async function startCampaignEventConsumer(): Promise<void> {
  await ensureProducer();
  await consumer.connect();
  await consumer.subscribe({ topic: CAMPAIGN_EVENTS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const key = message.key?.toString();
      if (!key) return;

      const handler = dispatchByName[key];
      if (!handler) {
        console.warn(`[CampaignEventBus] Unknown event type: ${key}`);
        return;
      }

      let payload: any;
      try {
        const raw = message.value?.toString() ?? '{}';
        const parsed = JSON.parse(raw);
        payload = parsed?.data ?? parsed;
      } catch (err: any) {
        console.error(`[CampaignEventBus] Bad JSON for ${key}: ${err.message}`);
        return;
      }

      try {
        await handler(payload);
        console.log(`[CampaignEventBus] Handled ${key}`);
      } catch (err: any) {
        console.error(`[CampaignEventBus] Handler ${key} failed: ${err.message}`);
      }
    },
  });

  console.log(`[CampaignEventBus] Kafka consumer subscribed to "${CAMPAIGN_EVENTS_TOPIC}"`);
}
