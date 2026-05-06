import { Worker, Job } from 'bullmq';
import { config } from '../../config';
import IORedis from 'ioredis';
import { Workspace, Message, Contact, Conversation, Template } from '@/models';
import { AutomationClient } from '../automation/automation-client';
import { isWithinBusinessHoursLegacy } from '../automation/automation-utils';
import { UsageTracker } from '../workspace/usage-tracker';
import * as SocketService from '../socket-service';
import dbConnect from '@/db-connect';
import { getConnectionForWorker } from '../../utils/ioredis';
import { normalizePhoneNumber } from '../../utils/phone-utils';

/**
 * Webhook Processor
 */

const connection = getConnectionForWorker('client');
const globalWebhook = global as unknown as { webhookWorkerInstance?: Worker };

export const initWebhookWorker = () => {
  if (globalWebhook.webhookWorkerInstance) return globalWebhook.webhookWorkerInstance;

  globalWebhook.webhookWorkerInstance = new Worker(
    'whatsapp-webhooks',
    async (job: Job) => {
      const { payload, deliveryId } = job.data;
      console.log(`[WebhookProcessor] Processing job ${job.id} (deliveryId: ${deliveryId})`);
      await dbConnect();

      try {
        let appId = payload.app || payload.appId || payload.payload?.appId || payload.gs_app_id || payload.entry?.[0]?.id || null;
        let phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || payload.phone_number_id || payload.payload?.phone_number_id;

        let workspace = await Workspace.findOne({
          $or: [{ phoneNumberId }, { gupshupAppId: appId }, { 'gupshupIdentity.partnerAppId': appId }]
        });

        if (!workspace) {
          console.warn(`[WebhookProcessor][Job ${job.id}] No workspace found for appId: ${appId}, phoneNumberId: ${phoneNumberId}`);
          return;
        }

        const v3Statuses = extractV3Statuses(payload);
        const v3Messages = extractV3Messages(payload);

        if (v3Statuses.length > 0) {
          console.log(`[WebhookProcessor][Job ${job.id}] Processing ${v3Statuses.length} statuses for workspace ${workspace.name}`);
          await processStatuses(v3Statuses, workspace._id, job.id as string);
        }
        if (v3Messages.length > 0) {
          console.log(`[WebhookProcessor][Job ${job.id}] Processing ${v3Messages.length} inbound messages for workspace ${workspace.name}`);
          for (const msg of v3Messages) await processInbound(msg, workspace);
        }
        await processTemplateUpdates(payload, workspace);

        console.log(`[WebhookProcessor] Successfully processed job ${job.id}`);
      } catch (error: any) {
        console.error(`[WebhookProcessor][Job ${job.id}] Error:`, error.message, error.stack);
        throw error;
      }
    },
    { connection }
  );

  return globalWebhook.webhookWorkerInstance;
};

// ... Helper functions (Standard Logic) ...
const V3_STATUS_TYPES = ['status', 'enqueued', 'accepted', 'sent', 'delivered', 'read', 'seen', 'failed'];

function extractV3Statuses(payload: any) {
  const statuses = [];
  if (payload.value?.statuses) statuses.push(...payload.value.statuses);
  if (Array.isArray(payload?.statuses)) statuses.push(...payload.statuses);
  
  // Gupshup format: { type: 'message-event', payload: { status: 'delivered', ... } }
  if (payload.type === 'message-event' && payload.payload) {
    statuses.push(payload.payload);
  }
  // Alternate Gupshup format: { payload: { type: 'delivered', status: 'delivered', ... } }
  if (payload.payload?.status && !payload.type) {
     statuses.push(payload.payload);
  }

  const changes = payload?.entry?.[0]?.changes;
  if (changes) {
    for (const change of changes) if (change.value?.statuses) statuses.push(...change.value.statuses);
  }
  return statuses;
}

function extractV3Messages(payload: any) {
  const messages = [];
  if (payload.value?.messages) messages.push(...payload.value.messages);
  
  // Gupshup format: { type: 'message', payload: { id: '...', ... } }
  if (payload.type === 'message' && payload.payload) {
    messages.push(payload.payload);
  }

  const changes = payload?.entry?.[0]?.changes;
  if (changes) {
    for (const change of changes) if (change.value?.messages) messages.push(...change.value.messages);
  }
  return messages;
}

function normalizeWebhookTimestamp(rawTs: any): Date {
  const numeric = Number(rawTs);
  const ms = numeric > 1e12 ? numeric : numeric * 1000;
  return new Date(ms || Date.now());
}

function mapMessageStatus(rawStatus: string): any {
  const s = String(rawStatus || '').toLowerCase().trim();
  switch (s) {
    case 'enqueued':
    case 'accepted':
      return 'sent';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
    case 'seen':
      return 'read';
    case 'failed':
      return 'failed';
    case 'deleted':
      return 'failed';
    default:
      return s;
  }
}

async function processStatuses(statuses: any[], workspaceId: any, jobId: string) {
  for (const status of statuses) {
    // Gupshup System Events (non-message related) should be ignored gracefully
    if (['set-callback', 'billing-event', 'account-event', 'template-event'].includes(status.type)) {
      console.log(`[WebhookProcessor][Job ${jobId}] Ignoring Gupshup system event: ${status.type}`);
      continue;
    }

    const providerId =
      status.messageId ||
      status.gsId ||
      status.gs_id ||
      status.id ||
      (status as any).id ||
      (status as any).externalId;

    if (!providerId) {
      // If it's not a known system event but still has no ID, log a warning
      console.warn(`[WebhookProcessor][Job ${jobId}] No provider ID found in status:`, JSON.stringify(status));
      continue;
    }

    // --- DEEP DIVE LOGGING ---
    console.log(`[WebhookProcessor][Job ${jobId}] Searching for message:`, {
      providerId,
      workspaceId: workspaceId.toString(),
      status: status.status
    });

    // 1. Primary search: By Provider ID within the resolved workspace
    let message = await Message.findOne({
      workspace: workspaceId,
      $or: [
        { whatsappMessageId: providerId }, 
        { 'meta.providerEnvelopeId': providerId },
        { 'meta.gs_id': providerId },
        { 'meta.providerResponse.messageId': providerId } // Added common Gupshup location
      ]
    });

    // 2. Fallback search: If not found, try searching GLOBALLY by ID
    // (This helps catch cases where the workspace resolution might be slightly off or mismatched)
    if (!message) {
      console.warn(`[WebhookProcessor][Job ${jobId}] Message not found in workspace ${workspaceId}. Attempting global fallback...`);
      message = await Message.findOne({
        $or: [
          { whatsappMessageId: providerId },
          { 'meta.providerEnvelopeId': providerId },
          { 'meta.gs_id': providerId }
        ]
      });

      if (message) {
        console.log(`[WebhookProcessor][Job ${jobId}] ✓ Found message via global fallback. Message Workspace: ${message.workspace}, Webhook Workspace: ${workspaceId}`);
        // Optional: If we found it in a different workspace, we should probably update it anyway 
        // if we trust the provider ID is unique enough.
      }
    }

    if (!message) {
      console.warn(`[WebhookProcessor] Message not found for providerId: ${providerId} in workspace ${workspaceId}`);
      // Log latest messages in this workspace to see what IDs we HAVE
      const latestMsgs = await Message.find({ workspace: workspaceId }).sort({ createdAt: -1 }).limit(3).select('whatsappMessageId direction body createdAt');
      console.log(`[WebhookProcessor] Latest 3 messages in workspace ${workspaceId}:`, JSON.stringify(latestMsgs, null, 2));
      continue;
    }

    const rawStatus = status.status || status.type || 'unknown';
    const nextStatus = mapMessageStatus(rawStatus);
    
    // Ignore system-level statuses that are not part of the MessageStatus enum
    if (nextStatus === 'set-callback' || nextStatus === 'unknown') {
      console.log(`[WebhookProcessor] Ignoring system/verification status: ${nextStatus} (raw: ${rawStatus})`);
      continue;
    }

    const timestampRaw = status.timestamp || status.ts || status.gs_timestamp;
    let timestampMs = timestampRaw ? Number(timestampRaw) : Date.now();
    
    // Normalize: if it's in seconds (10 digits), convert to ms for our internal Date objects
    if (timestampMs < 10000000000) {
      timestampMs *= 1000;
    }

    const timestampSeconds = Math.floor(timestampMs / 1000);
    const prevStatus = message.status;
    const statusDate = timestampSeconds ? new Date(timestampSeconds * 1000) : new Date();

    // 4. Update internal message state
    console.log(`[WebhookProcessor][Job ${jobId}] Updating message ${message._id} status: ${prevStatus} -> ${nextStatus}`);
    await message.updateStatus(nextStatus, timestampSeconds);
    
    // Refresh message instance to ensure we have the updated status for comparison
    const updatedMessage = await Message.findById(message._id);
    const statusChanged = updatedMessage ? updatedMessage.status !== prevStatus : true;

    // Broadcast status update via socket service
    await SocketService.emitStatusUpdate(
      workspaceId.toString(),
      message.conversation?.toString() || '',
      message._id.toString(),
      nextStatus,
      statusDate
    );

    // If message is part of a campaign, notify the campaign-service
    if (message.campaign?.id) {
      console.log(`[WebhookProcessor][Job ${jobId}] Message belongs to campaign: ${message.campaign.id}`);
      
      // Real-time Socket Update for Frontend
      await SocketService.emitCampaignStatusUpdate(workspaceId.toString(), {
        campaignId: message.campaign.id.toString(),
        messageId: message._id.toString(),
        status: nextStatus,
        updatedAt: statusDate
      });

      // Persistent Metric Update via Campaign Service Queue
      if (statusChanged || nextStatus === 'failed') {
        try {
          const { Queue } = await import('bullmq');
          const { getSharedConnection } = await import('../../utils/ioredis');
          
          // Initialize queue once (BullMQ handles connection reuse internally if using the same connection object)
          const campaignEventsQueue = new Queue('CampaignEventsQueue', { 
            connection: getSharedConnection(),
            defaultJobOptions: { removeOnComplete: true }
          });
          
          const campaignIdStr = message.campaign.id.toString();
          const contactIdStr = (message.contact as any)?._id?.toString() || message.contact?.toString();

          await campaignEventsQueue.add('MessageStatusUpdateEvent', {
            campaignId: campaignIdStr,
            messageId: message._id.toString(),
            contactId: contactIdStr,
            whatsappMessageId: message.whatsappMessageId,
            status: nextStatus,
            prevStatus,
            timestamp: statusDate
          });
          console.log(`[WebhookProcessor][Job ${jobId}] ✓ Queued CampaignEvent: ${nextStatus} for ${campaignIdStr}`);
          
          console.log(`[WebhookProcessor][Job ${jobId}] ✓ Enqueued Campaign Service update for ${nextStatus}`);
        } catch (queueErr: any) {
          console.error(`[WebhookProcessor][Job ${jobId}] ❌ Failed to notify campaign service:`, queueErr.message);
        }
      } else {
        console.log(`[WebhookProcessor][Job ${jobId}] Skipping campaign queue (Status unchanged or already processed)`);
      }
    }
  }
}

async function processInbound(incoming: any, workspace: any) {
  const from = normalizePhoneNumber(incoming.from);
  const messageId = incoming.id;
  const timestamp = normalizeWebhookTimestamp(incoming.timestamp);
  const type = incoming.type || 'text';
  const body = incoming.text?.body || incoming.body || '';

  if (!from || !messageId) return;

  const existing = await Message.findOne({ workspace: workspace._id, whatsappMessageId: messageId });
  if (existing) return;

  const contact = await Contact.findOneAndUpdate(
    { workspace: workspace._id, phone: from },
    {
      $set: { lastInboundAt: timestamp },
      $setOnInsert: { workspace: workspace._id, phone: from, name: incoming.contacts?.[0]?.profile?.name || 'Unknown' }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const conversation = await Conversation.findOneAndUpdate(
    { workspace: workspace._id, contact: contact._id },
    {
      $set: { 
        lastInboundAt: timestamp, 
        lastActivityAt: timestamp,
        lastMessageAt: timestamp,
        lastMessagePreview: body.substring(0, 100),
        lastMessageDirection: 'inbound',
        lastMessageType: type,
        isOpen: true, 
        status: 'open' 
      },
      $setOnInsert: { workspace: workspace._id, contact: contact._id }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const newMessage = await Message.create({
    workspace: workspace._id,
    contact: contact._id,
    conversation: conversation._id,
    direction: 'inbound',
    body,
    whatsappMessageId: messageId,
    sentAt: timestamp,
    meta: { rawIncoming: incoming }
  });

  await UsageTracker.increment(workspace._id, 'messages');
  await SocketService.emitNewInboundMessage(workspace._id.toString(), conversation, newMessage, contact);

  // 4. Auto-Assignment
  if (!conversation.assignedTo && workspace.inboxSettings?.autoAssignmentEnabled) {
    const { AutoAssignService } = await import("./auto-assign-service");
    await AutoAssignService.assign(workspace._id, conversation._id).catch(() => { });
  }

  // 5. Automation Microservice Hand-off
  try {
    const handled = await AutomationClient.handleInbound({
      workspaceId: workspace._id.toString(),
      contact: contact,
      conversationId: conversation._id.toString(),
      messageId: newMessage._id.toString(),
      body,
      metadata: newMessage.meta,
      isOutsideBusinessHours: !isWithinBusinessHoursLegacy(workspace.settings)
    });
    if (handled) return;
  } catch (err) {
    console.error("[WebhookProcessor] Automation hand-off error:", err);
  }
}

async function processTemplateUpdates(payload: any, workspace: any) {
  const changes = payload?.entry?.[0]?.changes;
  if (!changes) return;
  for (const change of changes) {
    if (change.field === 'message_template_status_update') {
      const { message_template_name, event } = change.value;
      await Template.updateOne({ workspace: workspace._id, name: message_template_name }, { $set: { status: event } });
    }
  }
}
