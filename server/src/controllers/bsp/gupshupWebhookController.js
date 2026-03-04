const { Contact, Conversation, Message, WebhookLog, Workspace } = require('../../models');
const billingLedgerService = require('../../services/billing/billingLedgerService');
const autoReplyService = require('../../services/automation/autoReplyService');
const instagramQuickflowService = require('../../services/integration/instagramQuickflowService');
const answerBotService = require('../../services/automation/answerbotService');
const bspMessagingService = require('../../services/bsp/bspMessagingService');
const { automationEvents, AUTOMATION_EVENTS } = require('../../services/automation/automationEventEmitter');
const { getIO } = require('../../utils/socket');
const { runPostOnboardingAutomations } = require('../../services/bsp/gupshupProvisioningService');

function verify(req, res) {
  return res.status(200).json({ ok: true, provider: 'gupshup' });
}

async function handler(req, res) {
  const payload = req.body || {};
  const deliveryId = req.headers['x-delivery-id'] || req.headers['x-request-id'] || null;

  res.sendStatus(200);

  try {
    await processWebhookPayload(payload, deliveryId, req.ip);
  } catch (error) {
    console.error('[GupshupWebhook] Processing failed:', error.message);
  }
}

async function processWebhookPayload(payload, deliveryId, sourceIp) {
  const appId = payload.app || payload.appId || payload?.payload?.appId || null;
  // Strictly map by phone_number_id first
  const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  let workspace = null;
  if (phoneNumberId) {
    workspace = await Workspace.findByPhoneNumberId(phoneNumberId);
  }

  if (!workspace && appId) {
    workspace = await Workspace.findByPartnerAppId(appId);
  }

  const log = await WebhookLog.create({
    deliveryId,
    workspace: workspace?._id || null,
    payload,
    verified: true,
    processed: false,
    eventType: payload.type || payload.event || 'gupshup',
    sourceIp
  });

  try {
    console.log(`[GupshupWebhook] Processing webhook for appId: ${appId}, workspace: ${workspace?._id || 'unknown'}`);

    // Handle V3 format: value.messages and value.statuses
    const v3Messages = extractV3Messages(payload);
    const v3Statuses = extractV3Statuses(payload);

    // Handle V2 format: payload.statuses and payload.messages (legacy)
    const v2Statuses = extractStatuses(payload);
    const v2Incoming = extractIncomingMessage(payload);

    // Combine V3 and V2 data
    const allStatuses = [...v3Statuses, ...v2Statuses];
    const allMessages = [...v3Messages, ...(v2Incoming ? [v2Incoming] : [])];

    console.log(`[GupshupWebhook] Found ${allStatuses.length} status updates and ${allMessages.length} messages`);

    // 1. Account / System Events (Onboarding flow completion)
    const isAccountEvent = payload.type === 'account-event' || payload.type === 'app_event' || payload.object === 'whatsapp_business_account' || payload.event === 'ACCOUNT_VERIFIED';
    if (isAccountEvent && workspace) {
      const isVerified = payload.status === 'ACCOUNT_VERIFIED' || payload.event === 'ACCOUNT_VERIFIED' || payload?.entry?.[0]?.changes?.[0]?.value?.event === 'APPROVED';

      if (isVerified) {
        workspace.onboardingStatus = 'LIVE';
        workspace.wabaStatus = 'VERIFIED';
        workspace.whatsappConnected = true;
        workspace.connectedAt = new Date();
        workspace.bspPhoneStatus = 'CONNECTED';

        // Ensure esbFlow is marked complete
        if (workspace.esbFlow) {
          workspace.esbFlow.status = 'completed';
          workspace.esbFlow.completedAt = new Date();
        }

        await workspace.save();

        // Fire and forget post-onboarding sync tasks to prevent webhook timeout
        runPostOnboardingAutomations(workspace).catch(err => {
          console.error('[Webhooks] Post-onboarding automation failed:', err);
        });
      }
    }

    // 2. Process Status Updates (V3 + V2)
    if (allStatuses.length > 0) {
      await processStatuses(allStatuses, workspace?._id || null);
    }

    // 3. Process Inbound Messages (V3 + V2)
    for (const message of allMessages) {
      if (workspace) {
        await processInbound(message, workspace);
      }
    }

    log.processed = true;
    log.processedAt = new Date();
    await log.save();
  } catch (error) {
    log.error = error.message;
    await log.save();
    throw error;
  }
}

function extractIncomingMessage(payload) {
  if (payload.type === 'message' || payload.event === 'message') {
    return payload;
  }

  if (payload.payload?.type === 'message') {
    return payload.payload;
  }

  return null;
}

function extractStatuses(payload) {
  if (Array.isArray(payload.statuses)) {
    return payload.statuses;
  }

  if (payload.type === 'status' || payload.event === 'status') {
    return [payload];
  }

  if (payload.payload?.status) {
    return [payload.payload];
  }

  return [];
}

// V3 Webhook Format Extraction Functions
function extractV3Messages(payload) {
  const messages = [];

  // V3 format: payload.value.messages
  if (payload.value?.messages && Array.isArray(payload.value.messages)) {
    messages.push(...payload.value.messages);
  }

  return messages;
}

function extractV3Statuses(payload) {
  const statuses = [];

  // V3 format: payload.value.statuses
  if (payload.value?.statuses && Array.isArray(payload.value.statuses)) {
    statuses.push(...payload.value.statuses);
  }

  return statuses;
}

async function processInbound(incoming, workspace) {
  console.log(`[GupshupWebhook] Inbound Message Received:`, JSON.stringify(incoming, null, 2));

  let rawFrom = incoming.sender?.phone || incoming.from || incoming.source || incoming.mobile || incoming.contacts?.[0]?.wa_id;
  const messageId = incoming.messageId || incoming.id || incoming.messages?.[0]?.id;
  const timestamp = incoming.timestamp ? new Date(incoming.timestamp * 1000) : new Date();

  if (!rawFrom) {
    console.warn(`[GupshupWebhook] Inbound message missing sender phone:`, incoming);
    return;
  }

  // 1. Strict Normalization (Match sendTemplateV3 logic)
  const from = String(rawFrom).replace(/\D/g, "");

  // 2. Prevent Duplicates (Requirement 8)
  if (messageId) {
    const existingMessage = await Message.findOne({
      workspace: workspace._id,
      $or: [{ whatsappMessageId: messageId }, { 'meta.whatsappId': messageId }]
    });

    if (existingMessage) {
      console.warn(`[GupshupWebhook] Duplicate inbound message ignored: ${messageId}`);
      return;
    }
  }

  // 3. Extract Media & Content (Requirement 6)
  let type = incoming.type || incoming.message?.type || 'text';
  let text = '';
  let mediaOptions = {};

  if (type === 'text') {
    text = incoming.payload?.text || incoming.text?.body || incoming.text || incoming.message?.text || incoming.body || '';
  } else if (['image', 'video', 'audio', 'document'].includes(type)) {
    const mediaNode = incoming[type] || incoming.message?.[type] || incoming.payload?.[type];
    if (mediaNode) {
      mediaOptions.id = mediaNode.id;
      mediaOptions.url = mediaNode.url || mediaNode.link;
      mediaOptions.caption = mediaNode.caption || '';
      text = mediaOptions.caption || `[${type}]`; // Provide fallback text for previews
    }
  } else {
    // Fallback for unknown/interactive types
    text = `[${type}]`;
  }

  const channel = incoming.channel || incoming.payload?.channel || 'whatsapp';

  // Find or create contact
  let contact = await Contact.findOne({ workspace: workspace._id, phone: from });
  if (!contact) {
    contact = await Contact.create({
      workspace: workspace._id,
      phone: from,
      name: incoming.sender?.name || incoming.contacts?.[0]?.profile?.name || 'Unknown',
      metadata: {
        whatsappName: incoming.sender?.name || incoming.contacts?.[0]?.profile?.name
      }
    });
    console.log(`[GupshupWebhook] Created new contact: ${contact._id}`);
  }

  // Find or create conversation with 24h window management
  let conversation = await Conversation.findOne({ workspace: workspace._id, contact: contact._id });
  const isNewConversation = !conversation;

  const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (!conversation) {
    conversation = await Conversation.create({
      workspace: workspace._id,
      contact: contact._id,
      status: 'open',
      channel: 'whatsapp',
      conversationType: 'customer_initiated',
      isOpen: true,
      windowExpiresAt: windowExpiresAt,
      lastInboundAt: timestamp,
      lastActivityAt: timestamp,
      wabaId: workspace.gupshupIdentity?.wabaId || workspace.wabaId
    });
  } else {
    conversation.lastInboundAt = timestamp;
    conversation.lastActivityAt = timestamp;
    conversation.lastMessageAt = timestamp;
    conversation.lastMessagePreview = text.substring(0, 100);
    conversation.lastMessageDirection = 'inbound';
    conversation.lastMessageType = 'text';
    conversation.isOpen = true;
    conversation.windowExpiresAt = windowExpiresAt; // Update 24h session window
    await conversation.save();
  }

  // Create message record
  const message = await Message.create({
    workspace: workspace._id,
    contact: contact._id,
    conversation: conversation._id,
    direction: 'inbound',
    type: type,
    body: text || '[Inbound Message]',
    status: 'received',
    whatsappMessageId: messageId,
    meta: {
      provider: 'gupshup',
      whatsappId: messageId,
      raw: incoming,
      channel: channel,
      timestamp: timestamp,
      media: Object.keys(mediaOptions).length > 0 ? mediaOptions : undefined
    }
  });

  // Emit socket events for real-time inbox updates
  getIO()?.to(`workspace:${workspace._id}`).emit('message:new', {
    message,
    contact,
    conversation
  });

  getIO()?.to(`workspace:${workspace._id}`).emit('conversation:update', {
    conversation,
    contact,
    isNew: isNewConversation
  });

  console.log(`[GupshupWebhook] Inbound processing complete for message: ${messageId}`);

  // Background tasks (non-blocking)
  (async () => {
    try {
      await billingLedgerService.recordMessage({
        workspaceId: workspace._id,
        conversationId: conversation._id,
        contactId: contact._id,
        direction: 'inbound',
        messageId: message._id,
        whatsappMessageId: message.meta.whatsappId
      });

      const autoReplyResult = await autoReplyService.checkAutoReply(text, contact, workspace._id);
      if (autoReplyResult.shouldSend) {
        await autoReplyService.sendAutoReply(autoReplyResult.autoReplyData, contact, workspace._id, message);
      }
    } catch (err) {
      console.error('[GupshupWebhook] Async processing error:', err.message);
    }
  })();
}

async function processStatuses(statuses, workspaceId) {
  for (const status of statuses) {
    const providerMessageId = status.messageId || status.id || status.gsId || status.message?.id;
    let nextStatus = status.status || status.eventType || status.type || 'unknown';
    const timestamp = status.timestamp ? new Date(status.timestamp * 1000) : new Date();

    // V3 specific nested status check
    if (status.payload?.status) {
      nextStatus = status.payload.status;
    }

    if (!providerMessageId) continue;

    console.log(`[GupshupWebhook] Delivery status: ${nextStatus} for message ${providerMessageId}`);

    const query = {
      $or: [
        { 'meta.whatsappId': providerMessageId },
        { whatsappMessageId: providerMessageId }
      ]
    };
    if (workspaceId) query.workspace = workspaceId;

    const message = await Message.findOne(query);
    if (!message) {
      console.warn(`[GupshupWebhook] Message not found: ${providerMessageId}`);
      continue;
    }

    const oldStatus = message.status;

    // Normalize string to match enum
    const statusMap = {
      'enqueued': 'queued',
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed',
      'deleted': 'failed' // WhatsApp sometimes emits deleted for failed sends
    };

    message.status = statusMap[String(nextStatus).toLowerCase()] || String(nextStatus).toLowerCase();

    // Set timestamps based on normalized status
    if (message.status === 'sent') message.sentAt = timestamp;
    else if (message.status === 'delivered') message.deliveredAt = timestamp;
    else if (message.status === 'read') message.readAt = timestamp;
    else if (message.status === 'failed') {
      message.failedAt = timestamp;

      // Extract specific error details (Requirement 5)
      const errorNode = status.errors?.[0] || status.error || status.payload?.error || status.payload?.errors?.[0];
      const errorCode = errorNode?.code || status.code || 'UNKNOWN';
      const errorMessage = errorNode?.title || errorNode?.message || status.reason || 'Unknown error';

      message.failureReason = `${errorCode}: ${errorMessage}`;

      message.meta = message.meta || {};
      message.meta.error = { code: errorCode, message: errorMessage, raw: errorNode || status };

      console.error(`[GupshupWebhook] Delivery failed: ${message.failureReason}`);
    }

    await message.save();

    // Emit socket event (Requirement 4)
    if (workspaceId || message.workspace) {
      getIO()?.to(`workspace:${workspaceId || message.workspace}`).emit('message:status_update', {
        messageId: message._id,
        oldStatus,
        newStatus: message.status,
        timestamp: timestamp
      });
    }
  }
}

module.exports = {
  verify,
  handler,
  processWebhookPayload
};
