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
      await dbConnect();

      try {
        let appId = payload.app || payload.appId || payload.payload?.appId || payload.gs_app_id || payload.entry?.[0]?.id || null;
        let phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || payload.phone_number_id || payload.payload?.phone_number_id;

        let workspace = await Workspace.findOne({
          $or: [{ phoneNumberId }, { gupshupAppId: appId }, { 'gupshupIdentity.partnerAppId': appId }]
        });

        if (!workspace) return;

        const v3Statuses = extractV3Statuses(payload);
        const v3Messages = extractV3Messages(payload);

        if (v3Statuses.length > 0) await processStatuses(v3Statuses, workspace._id);
        if (v3Messages.length > 0) {
          for (const msg of v3Messages) await processInbound(msg, workspace);
        }
        await processTemplateUpdates(payload, workspace);

      } catch (error: any) {
        console.error(`[WebhookProcessor] Error:`, error.message);
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
  const changes = payload?.entry?.[0]?.changes;
  if (changes) {
    for (const change of changes) if (change.value?.statuses) statuses.push(...change.value.statuses);
  }
  return statuses;
}

function extractV3Messages(payload: any) {
  const messages = [];
  if (payload.value?.messages) messages.push(...payload.value.messages);
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

async function processStatuses(statuses: any[], workspaceId: any) {
  for (const status of statuses) {
    const providerId = status.id || status.messageId;
    const nextStatus = status.status || status.type || 'unknown';
    const message = await Message.findOne({
      workspace: workspaceId,
      $or: [{ whatsappMessageId: providerId }, { 'meta.providerEnvelopeId': providerId }]
    });
    if (!message) continue;
    message.status = nextStatus as any;
    await message.save();
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
