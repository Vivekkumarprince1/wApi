/**
 * Campaign event bus — Redis-backed.
 *
 * Outbound: publishes to `billing-events` topic via `billingEventsQueue.add(name, payload)`.
 * Inbound: consumes `campaign-events` topic and dispatches by `message.key`.
 */

import mongoose from 'mongoose';
import { campaignMetrics } from '../metrics';
import Redis from 'ioredis';
import { Campaign, ICampaignModel, CampaignMessage } from '../../models';
import { CampaignBatch, ICampaignBatchModel } from '../../models/CampaignBatch';
import { CampaignQueueService } from '../campaign-queue';
import { Workspace } from '../../models';
import { microserviceWorkerClient } from '../microservice-worker-client';
import { SegmentService } from '../../services/SegmentService';
import { createRedisConnection } from '../redis';

const BILLING_EVENTS_TOPIC = 'billing-events';
const CAMPAIGN_EVENTS_TOPIC = 'campaign-events';

let producerClient: Redis | null = null;
let consumerClient: Redis | null = null;

let producerReady: Promise<void> | null = null;

function ensureProducer(): Promise<void> {
  if (!producerReady) {
    const url = process.env.REDIS_URL;
    if (!url) return Promise.reject(new Error('REDIS_URL is not defined'));

    producerClient = createRedisConnection('campaign-event-bus:producer', { lazyConnect: true });
    producerReady = producerClient.connect().then(() => {
      console.log('[CampaignEventBus] Redis Producer connected.');
    }).catch(err => {
      producerReady = null;
      throw err;
    });
  }
  return producerReady;
}

/**
 * Compat shim mirroring BullMQ `Queue.add(name, data)`.
 * The event name becomes the message `key` so consumers can dispatch by `key`.
 */
function topicAdapter(topic: string) {
  return {
    async add(eventName: string, data: any): Promise<void> {
      await ensureProducer();
      if (producerClient) {
        await producerClient.publish(
          topic,
          JSON.stringify({
            key: eventName,
            value: JSON.stringify({ name: eventName, data, ts: Date.now() }),
          })
        );
      }
    },
  };
}

export const billingEventsQueue = topicAdapter(BILLING_EVENTS_TOPIC);
export const campaignEventsQueue = topicAdapter(CAMPAIGN_EVENTS_TOPIC);

// --- Inbound handlers (Redis consumer on campaign-events) ---

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

    campaign.contacts = normalizedContacts.map((contact: any) => contact._id);
    campaign.totalContacts = normalizedContacts.length;
    campaign.totals = {
      ...(campaign.totals || {}),
      totalRecipients: normalizedContacts.length,
      queued: normalizedContacts.length,
    } as any;
    campaign.batching = {
      ...(campaign.batching || {}),
      totalBatches: batches.length,
      batchSize: 50,
      currentBatchIndex: 0,
    } as any;

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
    const existing = contactObjectId
      ? await CampaignMessage.findOne({ campaign: campaignObjectId, contact: contactObjectId })
      : whatsappMessageId
        ? await CampaignMessage.findOne({ whatsappMessageId })
        : null;
    if (!existing) {
      console.warn(`[CampaignEventBus] ⚠ CampaignMessage not found for ${contactId || whatsappMessageId}`);
      return;
    }

    const { canTransitionMessageState } = await import('../../services/message-state');
    if (!canTransitionMessageState(existing.status, status)) {
      console.log(`[CampaignEventBus] Ignoring duplicate/backwards transition ${existing.status} -> ${status}`);
      return;
    }

    const messageUpdate = await CampaignMessage.findOneAndUpdate(
      { _id: existing._id, status: existing.status },
      { $set: updateData },
      { upsert: false, new: true }
    );

    if (messageUpdate) {
      console.log(`[CampaignEventBus] ✓ Updated CampaignMessage for ${contactId || whatsappMessageId}`);
      await Campaign.incrementTotal(campaignId, field);
      campaignMetrics.increment(`campaign_messages_${field}_total`, `Campaign messages transitioned to ${field}`);
      console.log(`[CampaignEventBus] ✓ Incremented ${field} for campaign ${campaignId}`);
    }
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
  const url = process.env.REDIS_URL;
  if (!url) return;

  await ensureProducer();

  consumerClient = createRedisConnection('campaign-event-bus:consumer');

  consumerClient.subscribe(CAMPAIGN_EVENTS_TOPIC, (err, count) => {
    if (err) {
      console.error('[CampaignEventBus] Failed to subscribe:', err.message);
    } else {
      console.log(`[CampaignEventBus] Redis consumer subscribed to ${count} channels.`);
    }
  });

  consumerClient.on('message', async (channel, messageStr) => {
    if (channel !== CAMPAIGN_EVENTS_TOPIC) return;

    let message;
    try {
      message = JSON.parse(messageStr);
    } catch (err: any) {
      console.error(`[CampaignEventBus] Bad JSON payload: ${err.message}`);
      return;
    }

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
  });
}
