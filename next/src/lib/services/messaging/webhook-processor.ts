import { Worker, Job } from 'bullmq';
import { config } from '../../config';
import IORedis from 'ioredis';
import { Workspace } from '../../models/workspace/Workspace';
import { Message } from '../../models/messaging/Message';
import { Contact } from '../../models/messaging/Contact';
import { Conversation } from '../../models/messaging/Conversation';
import { Template } from '../../models/template/Template';
import { Campaign } from '../../models/campaign/Campaign';
import { CampaignMessage } from '../../models/campaign/CampaignMessage';
import { GupshupService } from './gupshup-service';
import { AutomationService } from '../automation/automation-service';
import { InstagramQuickflowService } from '../marketing/instagram-quickflow';
import { UsageTracker } from '../billing/usage-tracker';
import * as SocketService from '../socket-service';
import dbConnect from '@/lib/db-connect';
import { getConnectionForWorker } from '../../ioredis';
import { normalizePhoneNumber } from '../../phone-utils';

/**
 * Webhook Processor
 * 
 * BullMQ Worker that processes WhatsApp webhook payloads asynchronously.
 * Achieves 1:1 functional parity with legacy gupshupWebhookController logic.
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
      console.log(`[WebhookProcessor] Processing job ${job.id} (deliveryId: ${deliveryId})`);

    try {
      // 1. Resolve Workspace
      let appId = payload.app || payload.appId || payload.payload?.appId || payload.gs_app_id || payload.entry?.[0]?.id || null;
      let phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || payload.phone_number_id || payload.payload?.phone_number_id;

      // Handle Partner V3 specific payload nesting (Gupshup Direct)
      if (!appId && payload.app && typeof payload.app === 'string') appId = payload.app;

      let workspace = null;
      if (phoneNumberId) {
        workspace = await Workspace.findOne({ phoneNumberId });
      }
      if (!workspace && appId) {
        workspace = await Workspace.findOne({
          $or: [{ gupshupAppId: appId }, { 'gupshupIdentity.partnerAppId': appId }]
        });
      }

      if (!workspace) {
        console.warn(`[WebhookProcessor] Could not resolve workspace for payload (appId: ${appId}, phoneId: ${phoneNumberId})`);
        return;
      }

      // Self-healing Identity Backfill: Capture numeric Phone Number ID if missing
      if (phoneNumberId && !workspace.whatsappPhoneNumberId) {
        console.log(`[WebhookProcessor] Identity backfill triggered for workspace ${workspace._id}. ID: ${phoneNumberId}`);
        await Workspace.updateOne(
          { _id: workspace._id },
          { 
            $set: { 
              whatsappPhoneNumberId: phoneNumberId,
              bspPhoneNumberId: phoneNumberId,
              phoneNumberId: phoneNumberId
            } 
          }
        );
        // Update local object for the current process
        workspace.whatsappPhoneNumberId = phoneNumberId;
      }

      // 2. Extract Data
      const v3Statuses = extractV3Statuses(payload);
      const v3Messages = extractV3Messages(payload);

      // TRACE: Exhaustive logging for V3 payloads to debug status extraction
      if (v3Statuses.length > 0 || v3Messages.length > 0) {
        console.log(`[WebhookProcessor:Trace] V3 Payload detected. Statuses: ${v3Statuses.length}, Messages: ${v3Messages.length}`);
        if (v3Statuses.length > 0) {
           console.log(`[WebhookProcessor:Trace] Raw Payload:`);
           console.dir(payload, { depth: null });
        }
      }

      // 3. Process Status Updates
      if (v3Statuses.length > 0) {
        await processStatuses(v3Statuses, workspace._id);
      }

      // 4. Process Inbound Messages
      if (v3Messages.length > 0) {
        for (const msg of v3Messages) {
          await processInbound(msg, workspace);
        }
      }

      // 5. Process Template Updates
      await processTemplateUpdates(payload, workspace);

      // 6. Process Instagram Webhooks (Phase 22 Omnichannel)
      if (payload.object === 'instagram' && payload.entry) {
        for (const entry of payload.entry) {
          if (entry.messaging) {
            for (const messagingEvent of entry.messaging) {
               await processInstagramInbound(messagingEvent, workspace);
            }
          }
        }
      }

    } catch (error: any) {
      console.error(`[WebhookProcessor] Error processing job ${job.id}:`, error.message);
      throw error; // Re-queue on failure
    }
  },
  { connection }
);

  return globalWebhook.webhookWorkerInstance;
};

// Helper functions (1:1 with legacy logic)

const V3_STATUS_TYPES = ['status', 'enqueued', 'accepted', 'sent', 'delivered', 'read', 'seen', 'failed'];

function extractV3Statuses(payload: any) {
  const statuses = [];
  // Standard Meta/Cloud API
  if (payload.value?.statuses) statuses.push(...payload.value.statuses);
  if (Array.isArray(payload?.statuses)) statuses.push(...payload.statuses);
  if (Array.isArray(payload?.payload?.statuses)) statuses.push(...payload.payload.statuses);
  const changes = payload?.entry?.[0]?.changes;
  if (changes) {
    for (const change of changes) {
      if (change.value?.statuses) statuses.push(...change.value.statuses);
    }
  }
  // Gupshup Partner V3 (Direct webhook)
  const directPayload = payload?.payload && typeof payload.payload === 'object' ? { ...payload.payload } : null;
  const directType = String(directPayload?.type || payload?.type || '').toLowerCase();
  const directStatus = String(directPayload?.status || '').toLowerCase();

  if (directPayload && (V3_STATUS_TYPES.includes(directType) || V3_STATUS_TYPES.includes(directStatus))) {
    const s = directPayload;
    // For direct types like 'delivered', normalize the 'status' field if it is missing
    if (!s.type && directType) s.type = directType;
    if (s.type !== 'status' && !s.status) {
      s.status = s.type;
    }
    if (!s.status && directStatus) {
      s.status = directStatus;
    }
    // Trace log for Direct V3 status updates
    console.log(`[WebhookProcessor:Trace] Direct V3 Status identified: ${s.status || s.type} (type: ${s.type}) for ID: ${s.id || s.gsId}`);

    // Ensure we have a primary ID for matching
    if (s.gsId && !s.id) s.id = s.gsId;
    if (s.messageId && !s.id) s.id = s.messageId;
    statuses.push(s);
  }
  return statuses;
}

function extractV3Messages(payload: any) {
  const messages = [];
  // Standard Meta/Cloud API
  if (payload.value?.messages) messages.push(...payload.value.messages);
  const changes = payload?.entry?.[0]?.changes;
  if (changes) {
    for (const change of changes) {
      if (change.value?.messages) messages.push(...change.value.messages);
    }
  }
  // Gupshup Partner V3 (Direct webhook)
  // Ensure we don't catch status updates as messages
  const directType = String(payload?.payload?.type || '').toLowerCase();
  const directStatus = String(payload?.payload?.status || '').toLowerCase();
  if (
    payload.type === 'message' &&
    payload.payload?.id &&
    !V3_STATUS_TYPES.includes(directType) &&
    !V3_STATUS_TYPES.includes(directStatus)
  ) {
    // Normalization: Ensure Partner V3 payload looks like Cloud API enough for processInbound
    const p = payload.payload;
    if (!p.from && p.source) p.from = p.source;
    if (!p.text && p.payload?.text) p.text = { body: p.payload.text };
    messages.push(p);
  }
  return messages;
}

function normalizeWebhookTimestamp(rawTs: any): Date {
  if (rawTs == null || rawTs === '') return new Date();

  if (rawTs instanceof Date) {
    return Number.isNaN(rawTs.getTime()) ? new Date() : rawTs;
  }

  const numeric = Number(rawTs);
  if (Number.isFinite(numeric)) {
    // Normalize seconds vs milliseconds for provider payload parity.
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const parsed = new Date(rawTs);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeStatusIdentifier(value: any): string | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'object') {
    const nestedId =
      (value as any)?.id ||
      (value as any)?._id ||
      (value as any)?.messageId ||
      (value as any)?.gs_id ||
      (value as any)?.gsId;
    if (nestedId != null) return normalizeStatusIdentifier(nestedId);

    if (typeof (value as any)?.toString === 'function') {
      const asString = (value as any).toString();
      if (asString && asString !== '[object Object]') return asString;
    }
  }

  return null;
}

function collectStatusIdentifiers(status: any): string[] {
  const ids = [
    normalizeStatusIdentifier(status?.id),
    normalizeStatusIdentifier(status?.messageId),
    normalizeStatusIdentifier(status?.gs_id),
    normalizeStatusIdentifier(status?.gsId),
    normalizeStatusIdentifier(status?.meta_msg_id),
    normalizeStatusIdentifier(status?.metaMsgId),
    normalizeStatusIdentifier(status?.whatsappMessageId),
    normalizeStatusIdentifier(status?.externalId),
    normalizeStatusIdentifier(status?.providerEnvelopeId),
    normalizeStatusIdentifier(status?.payload?.id),
  ].filter(Boolean) as string[];

  return Array.from(new Set(ids));
}

type NormalizedMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';

function normalizeProviderStatus(rawStatus: any): NormalizedMessageStatus {
  const normalized = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (!normalized) return 'unknown';

  const strictMap: Record<string, NormalizedMessageStatus> = {
    enqueued: 'queued',
    accepted: 'queued',
    queued: 'queued',
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    seen: 'read',
    failed: 'failed',
  };

  if (strictMap[normalized]) return strictMap[normalized];

  if (normalized.includes('read') || normalized.includes('seen')) return 'read';
  if (normalized.includes('deliver')) return 'delivered';
  if (normalized.includes('sent') || normalized.includes('submit')) return 'sent';
  if (normalized.includes('queue') || normalized.includes('accept')) return 'queued';
  if (normalized.includes('fail') || normalized.includes('reject') || normalized.includes('error') || normalized.includes('undeliver')) return 'failed';

  return 'unknown';
}

async function processStatuses(statuses: any[], workspaceId: any) {
  const updatesToEmit: any[] = [];
  const campaignUpdatesToEmit: Array<{ campaignId: string; messageId: string; status: string; timestamp: Date }> = [];

  for (const status of statuses) {
    // ... ids resolution ...
    const providerId = normalizeStatusIdentifier(status.id || status.messageId || status.gs_id || status.gsId || status.externalId);
    const metaMsgId = normalizeStatusIdentifier(status.meta_msg_id || status.metaMsgId || status.whatsappMessageId);
    const allIds = collectStatusIdentifiers(status);

    const rawProviderStatus = status.status || status.type || status.event || status.state || 'unknown';
    const nextStatus = normalizeProviderStatus(rawProviderStatus);
    const timestamp = normalizeWebhookTimestamp(status.timestamp || status.eventTimestamp || status.ts);

    if (allIds.length === 0) {
      console.warn('[WebhookProcessor] Status skipped due to missing identifiers:', {
        workspaceId: workspaceId?.toString?.() || workspaceId,
        rawStatus: rawProviderStatus,
      });
      continue;
    }

    const message = await Message.findOne({
      workspace: workspaceId,
      $or: [
        { whatsappMessageId: { $in: allIds } },
        { 'meta.providerEnvelopeId': { $in: allIds } },
        { 'meta.gs_id': { $in: allIds } },
        { 'meta.whatsappMessageId': { $in: allIds } }
      ]
    });

    if (!message) {
      if (statuses.length > 0) {
        console.warn(`[WebhookProcessor] Message NOT FOUND for status update. Tested IDs: ${allIds.join(', ')}, workspace: ${workspaceId}`);
      }
      continue;
    }

    let messageMetaUpdated = false;
    const statusGsId = normalizeStatusIdentifier(status.gs_id || status.gsId);

    if (metaMsgId && metaMsgId !== message.whatsappMessageId) {
       message.whatsappMessageId = metaMsgId;
       messageMetaUpdated = true;
    }

    if (!message.meta) message.meta = {};

    if (providerId && !message.meta.providerEnvelopeId) {
      message.meta.providerEnvelopeId = providerId;
      messageMetaUpdated = true;
    }

    if (metaMsgId && !message.meta.whatsappMessageId) {
      message.meta.whatsappMessageId = metaMsgId;
      messageMetaUpdated = true;
    }

    if (statusGsId && !message.meta.gs_id) {
      message.meta.gs_id = statusGsId;
      messageMetaUpdated = true;
    }

    if (messageMetaUpdated) {
      message.markModified('meta');
    }

    const prevStatus = message.status;
    const resolvedStatus = nextStatus === 'unknown' ? prevStatus || 'unknown' : nextStatus;
    message.status = resolvedStatus as any;
    
    if (message.status === 'sent') message.sentAt = timestamp;
    else if (message.status === 'delivered') message.deliveredAt = timestamp;
    else if (message.status === 'read') message.readAt = timestamp;
    else if (message.status === 'failed') {
      message.failedAt = timestamp;
      const error = status.errors?.[0] || status.error;
      message.failureReason = error ? `${error.code}: ${error.message || error.title}` : 'Unknown error';
    }

    if (nextStatus === 'unknown') {
      console.warn(`[WebhookProcessor] Unmapped provider status '${rawProviderStatus}' for message ${message._id}. Keeping status as '${message.status}'.`);
    }

    await message.save();

    if (prevStatus !== message.status) {
      console.log(`[WebhookProcessor] Status transition ${prevStatus} -> ${message.status} for message ${message._id} (lookupIds: ${allIds.join(', ')})`);
    }

    const campaignLookupIds = Array.from(new Set([
      allIds,
      providerId,
      metaMsgId,
      statusGsId,
    ].flat().filter(Boolean) as string[]));

    const campaignMessage = campaignLookupIds.length
      ? await CampaignMessage.findOne({ whatsappMessageId: { $in: campaignLookupIds } })
      : null;

    if (campaignMessage) {
        // Track the transition to avoid double-counting in specific funnel stages
        campaignMessage.status = message.status as any;
        if (message.status === 'delivered') campaignMessage.deliveredAt = timestamp;
        else if (message.status === 'read') campaignMessage.readAt = timestamp;
        await campaignMessage.save();

        if (prevStatus !== message.status) {
           const incOps: any = { 
             [`totals.${message.status}`]: 1, 
             [`${message.status}Count`]: 1 
           };

           await Campaign.findByIdAndUpdate(campaignMessage.campaign, {
             $inc: incOps
           });

           campaignUpdatesToEmit.push({
             campaignId: campaignMessage.campaign.toString(),
             messageId: message._id.toString(),
             status: message.status,
             timestamp,
           });
        }
    }

    // Buffer for batch emission
    if (prevStatus !== message.status) {
      const conversationId = message.conversation?.toString();
      if (conversationId) {
        updatesToEmit.push({
          workspaceId: workspaceId.toString(),
          conversationId,
          messageId: message._id.toString(),
          status: message.status,
          timestamp
        });
      }
    }
  }

  // Optimized batch emission
  if (updatesToEmit.length > 0) {
    await SocketService.emitStatusBatch(workspaceId.toString(), updatesToEmit);
  }

  if (campaignUpdatesToEmit.length > 0) {
    await SocketService.emitCampaignStatusBatch(workspaceId.toString(), campaignUpdatesToEmit);
  }
}

async function processInbound(incoming: any, workspace: any) {
  const from = normalizePhoneNumber(incoming.from || incoming.sender?.phone);
  const messageId = incoming.id || incoming.messageId;
  const timestamp = normalizeWebhookTimestamp(incoming.timestamp);
  const type = incoming.type || 'text';
  const isReaction = type === 'reaction';

  if (!from || !messageId) return;

  // Duplicate Check
  const existing = await Message.findOne({ workspace: workspace._id, whatsappMessageId: messageId });
  if (existing) return;

  // Contact Sync (Atomic Upsert to prevent race conditions)
  const contact = await Contact.findOneAndUpdate(
    { workspace: workspace._id, phone: from },
    { 
      $setOnInsert: { 
        workspace: workspace._id,
        phone: from,
        name: incoming.contacts?.[0]?.profile?.name || 'Unknown',
        tags: [],
        leadStatus: 'new',
        isColdContact: false
      },
      $set: { lastInboundAt: timestamp }
    },
    { upsert: true, returnDocument: 'after', lean: true }
  );

  // Increment usage only on new contact creation (approximated by checking if created recently)
  if (contact && contact.createdAt && (timestamp.getTime() - contact.createdAt.getTime() < 1000)) {
     await UsageTracker.increment(workspace._id, 'contacts');
  }

  if (!contact) {
    console.error(`[WebhookProcessor] Contact could not be resolved or created for ${from}`);
    return;
  }

  // Conversation Sync (Atomic Upsert)
  const windowExpiresAt = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
  const conversation = await Conversation.findOneAndUpdate(
    { workspace: workspace._id, contact: contact._id },
    {
      $setOnInsert: {
        workspace: workspace._id,
        contact: contact._id
      },
      $set: {
        lastInboundAt: timestamp,
        lastActivityAt: timestamp,
        isOpen: true,
        windowExpiresAt,
        status: 'open'
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 3. Create Message
  let body = incoming.text?.body || incoming.body || '';
  const messageData: any = {
    workspace: workspace._id,
    contact: contact._id,
    conversation: conversation?._id,
    direction: 'inbound',
    type,
    status: 'received',
    whatsappMessageId: messageId,
    recipientPhone: from,
    sentAt: timestamp,
    meta: { rawIncoming: incoming }
  };

  // Type-specific extraction (Legacy parity & rich rendering)
  if (type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'sticker') {
    const media = incoming[type];
    messageData.media = {
      id: media.id,
      url: media.url, // Cloud API sometimes provides URL directly or requires download
      mimeType: media.mime_type,
      filename: media.filename,
      sha256: media.sha256,
      caption: media.caption
    };
    if (media.caption) body = media.caption;
    else if (!body) body = `[${type.toUpperCase()}]`;
    } else if (type === 'location') {
    const loc = incoming.location;
    messageData.meta.location = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      name: loc.name,
      address: loc.address
    };
    body = `📍 Location: ${loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`}`;
  } else if (type === 'contacts') {
    const contacts = incoming.contacts;
    messageData.meta.contacts = contacts;
    body = `👤 Contact: ${contacts[0]?.name?.formatted_name || 'Business Card'}`;
  } else if (type === 'interactive') {
    const interactive = incoming.interactive;
    if (interactive.type === 'button_reply') {
      body = interactive.button_reply.title;
      messageData.meta.interactiveReply = {
        type: 'button_reply',
        ...interactive.button_reply
      };
    } else if (interactive.type === 'list_reply') {
      body = interactive.list_reply.title;
      messageData.meta.interactiveReply = {
        type: 'list_reply',
        ...interactive.list_reply
      };
    } else if (interactive.type === 'nfm_reply') {
      const nfmReply = interactive.nfm_reply || {};
      const rawData = nfmReply.data || nfmReply.response_json || {};
      
      let parsedData = rawData;
      if (typeof rawData === 'string') {
        try {
          parsedData = JSON.parse(rawData);
        } catch (e) {
          console.warn('[WebhookProcessor] Failed to parse nfm_reply JSON data');
          parsedData = { raw: rawData };
        }
      }

      body = nfmReply.body || '[Form submitted]';
      messageData.meta.interactiveReply = {
        type: 'nfm_reply',
        flowId: nfmReply.flowId || nfmReply.flow_id || nfmReply.name || nfmReply.response_json?.flow_id || parsedData?.flow_id,
        flowToken: nfmReply.flowToken || nfmReply.flow_token || nfmReply.response_json?.flow_token || parsedData?.flow_token,
        data: parsedData
      };
    }
  } else if (type === 'reaction') {
    const reaction = incoming.reaction;
    if (reaction) {
       body = reaction.emoji;
       messageData.meta.reaction = reaction;
       
       // Link to original message for UI overlay
       try {
         const target = await Message.findOne({ whatsappMessageId: reaction.message_id });
         if (target) {
            if (!target.meta) target.meta = {};
            if (!target.meta.reactions) target.meta.reactions = {};
            target.meta.reactions[from] = {
               emoji: reaction.emoji,
               timestamp: timestamp
            };
            target.markModified('meta');
            await target.save();
         }
       } catch (e) {
         console.warn('[WebhookProcessor] Failed to link reaction:', e);
       }
    }
  } else if (type === 'payment' || type === 'order') {
     const payment = incoming[type];
     messageData.meta.payment = payment;
     if (payment.amount) {
        body = `💳 Payment: ${payment.amount.value / 100} ${payment.amount.currency}`;
     } else {
        body = `💳 ${type.toUpperCase()}: ${payment.id || '[Details]'}`;
     }
  } else if (type === 'button') {
    body = incoming.button.text;
  } else if (!body) {
    body = `[${type}]`;
  }

  messageData.body = body;
  const newMessage = await Message.create(messageData);

  // Increment message usage
  await UsageTracker.increment(workspace._id, 'messages');

  // Reactions should attach to the original message, not behave like a new visible chat item.
  if (type !== 'reaction') {
    (conversation as any).incrementUnreadForAllAgents();
    conversation.lastMessagePreview = body.substring(0, 100);
  }
  await conversation.save();

  // Emit Real-time New Message
  await SocketService.emitNewInboundMessage(
    workspace._id.toString(),
    conversation,
    newMessage,
    contact
  );

  // 4. Auto-Assignment Trigger
  // Only trigger if conversation is newly active and unassigned
  if (!conversation.assignedTo && workspace.inboxSettings?.autoAssignmentEnabled) {
    try {
      const { AutoAssignService } = await import("./auto-assign-service");
      await AutoAssignService.assign(workspace._id, conversation._id);
    } catch (assignErr: any) {
      console.error(`[WebhookProcessor] Auto-assignment failed:`, assignErr.message);
    }
  }

  console.log(`[WebhookProcessor] Broadcasted new message from ${from} to UI`);

  // 5. Automation & Bot Pipeline
  try {
    const handledByAutomation = await AutomationService.handleInboundMessage({
      workspaceId: workspace._id.toString(),
      type: 'message_received',
      contactId: contact._id.toString(),
      conversationId: conversation?._id?.toString() || "",
      messageId: newMessage._id.toString(),
      metadata: messageData.meta,
      body
    });

    if (handledByAutomation) {
      console.log(`[WebhookProcessor] Automation pipeline handled inbound for ${from}`);
      return;
    }

  } catch (automationErr: any) {
    console.error(`[WebhookProcessor] Automation pipeline error:`, automationErr.message);
    // Continue - don't crash the whole worker if one bot fails
  }

  console.log(`[WebhookProcessor] Processed inbound from ${from}: ${body.substring(0, 20)}...`);
}


async function processTemplateUpdates(payload: any, workspace: any) {
  // 1:1 legacy logic for template status updates
  const changes = payload?.entry?.[0]?.changes;
  if (!changes) return;

  for (const change of changes) {
    if (change.field === 'message_template_status_update' && change.value) {
      const { message_template_name, event, reason } = change.value;
      
      const template = await Template.findOne({
        workspace: workspace._id,
        $or: [{ name: message_template_name }, { metaTemplateName: message_template_name }]
      });

      if (template) {
        template.status = event;
        if (reason) template.rejectionReason = reason;
        
        template.approvalHistory.push({
          status: event as any,
          timestamp: new Date(),
          reason
        });

        await template.save();
        console.log(`[WebhookProcessor] Template ${message_template_name} updated to ${event}`);
      }
    }
  }
}

async function processInstagramInbound(messagingEvent: any, workspace: any) {
  const senderId = messagingEvent.sender?.id;
  const message = messagingEvent.message;
  
  if (!senderId || !message || !message.text) return;
  
  // Extract the page access token (pseudo-code: this should come from workspace integration tokens)
  const pageAccessToken = workspace.integrations?.instagram?.accessToken;
  if (!pageAccessToken) return;

  console.log(`[WebhookProcessor] Processing Instagram inbound from ${senderId}`);

  // Forward to Quickflows
  const handled = await InstagramQuickflowService.processKeywordTrigger(
    workspace._id,
    senderId,
    message.text,
    pageAccessToken
  );

  if (handled) {
    console.log(`[WebhookProcessor] Instagram Quickflow triggered for ${senderId}`);
  }
}
