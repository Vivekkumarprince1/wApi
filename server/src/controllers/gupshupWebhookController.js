const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const WebhookLog = require('../models/WebhookLog');
const Workspace = require('../models/Workspace');
const billingLedgerService = require('../services/billingLedgerService');
const autoReplyService = require('../services/autoReplyService');
const instagramQuickflowService = require('../services/instagramQuickflowService');
const answerBotService = require('../services/answerbotService');
const bspMessagingService = require('../services/bspMessagingService');
const { automationEvents, AUTOMATION_EVENTS } = require('../services/automationEventEmitter');
const { getIO } = require('../utils/socket');

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
  const workspace = appId ? await Workspace.findByPartnerAppId(appId) : null;

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
    const statuses = extractStatuses(payload);
    if (statuses.length > 0) {
      await processStatuses(statuses, workspace?._id || null);
    }

    const incoming = extractIncomingMessage(payload);
    if (incoming && workspace) {
      await processInbound(incoming, workspace);
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

async function processInbound(incoming, workspace) {
  const from = incoming.sender?.phone || incoming.from || incoming.source || incoming.mobile;
  const text = incoming.payload?.text || incoming.text || incoming.message?.text || incoming.body || '';
  const channel = incoming.channel || incoming.payload?.channel || 'whatsapp';

  if (!from) {
    return;
  }

  // Handle Instagram Quickflows if channel is instagram
  if (channel === 'instagram') {
    try {
      const igUsername = incoming.sender?.name || 'Instagram User';
      let triggerType = 'dm';
      
      if (incoming.type === 'comment') {
        triggerType = 'comment';
      } else if (incoming.payload?.reply_to?.story || incoming.reply_to?.story) {
        triggerType = 'story_reply';
      } else if (incoming.type === 'mention') {
        triggerType = 'mention';
      }
      
      const qfResult = await instagramQuickflowService.checkInstagramQuickflow(
        from,
        igUsername,
        triggerType,
        text,
        workspace._id
      );

      if (qfResult.shouldSend) {
        // Get Meta access token from workspace settings
        const metaAccessToken = workspace.instagramConfig?.accessToken;
        if (metaAccessToken) {
          await instagramQuickflowService.sendInstagramQuickflowResponse(
            qfResult.quickflowData,
            from,
            igUsername,
            triggerType,
            text,
            workspace,
            metaAccessToken
          );
        }
      }
    } catch (qfError) {
      console.error('[GupshupWebhook] Instagram Quickflow processing failed:', qfError.message);
    }
  }

  let contact = await Contact.findOne({ workspace: workspace._id, phone: from });
  if (!contact) {
    contact = await Contact.create({
      workspace: workspace._id,
      phone: from,
      name: incoming.sender?.name || 'Unknown'
    });
  }

  let conversation = await Conversation.findOne({ workspace: workspace._id, contact: contact._id });
  if (!conversation) {
    conversation = await Conversation.create({
      workspace: workspace._id,
      contact: contact._id,
      status: 'open',
      lastActivityAt: new Date()
    });
  }

  const message = await Message.create({
    workspace: workspace._id,
    contact: contact._id,
    conversation: conversation._id,
    direction: 'inbound',
    type: 'text',
    body: text || '[Inbound]',
    status: 'received',
    meta: {
      provider: 'gupshup',
      whatsappId: incoming.messageId || incoming.id || null,
      raw: incoming
    }
  });

  try {
    await billingLedgerService.recordMessage({
      workspaceId: workspace._id,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      messageId: message._id,
      whatsappMessageId: message.meta.whatsappId
    });
  } catch (error) {
    console.error('[GupshupWebhook] billing update failed:', error.message);
  }

  // 1. Auto-Replies (evaluated before workflows)
  let HandledByAutoReply = false;
  try {
    const autoReplyResult = await autoReplyService.checkAutoReply(text, contact, workspace._id);
    if (autoReplyResult.shouldSend) {
      await autoReplyService.sendAutoReply(autoReplyResult.autoReplyData, contact, workspace._id, message);
      HandledByAutoReply = true;
    }
  } catch (error) {
    console.error('[GupshupWebhook] auto-reply check failed:', error.message);
  }

  // 1.5. AnswerBot (evaluated if auto-reply didn't trigger)
  let HandledByAnswerBot = false;
  if (!HandledByAutoReply && text) {
    try {
      const match = await answerBotService.matchFAQ(text, workspace._id);
      if (match) {
        await bspMessagingService.sendTextMessage(workspace._id, contact.phone, match.answer);
        HandledByAnswerBot = true;
      }
    } catch (error) {
      console.error('[GupshupWebhook] answerbot match failed:', error.message);
    }
  }

  // 2. Workflows & Automation Rules
  try {
    automationEvents.customerMessageReceived({
      workspaceId: workspace._id,
      contactId: contact._id,
      conversationId: conversation._id,
      messageId: message._id,
      metadata: {
        message: {
          type: message.type,
          text: message.body,
          direction: 'inbound'
        },
        channel: 'whatsapp',
        source: 'organic'
      }
    });
  } catch (error) {
    console.error('[GupshupWebhook] automation trigger failed:', error.message);
  }

  getIO()?.to(`workspace:${workspace._id}`).emit('message.received', {
    message,
    contact,
    conversation
  });
}

async function processStatuses(statuses, workspaceId) {
  for (const status of statuses) {
    const providerMessageId = status.messageId || status.id || status.gsId;
    const nextStatus = status.status || status.eventType || 'unknown';

    if (!providerMessageId) {
      continue;
    }

    const query = {
      $or: [
        { 'meta.whatsappId': providerMessageId },
        { whatsappMessageId: providerMessageId }
      ]
    };

    if (workspaceId) {
      query.workspace = workspaceId;
    }

    const message = await Message.findOne(query);
    if (!message) {
      continue;
    }

    message.status = nextStatus;
    message.meta = message.meta || {};
    message.meta.statusUpdates = message.meta.statusUpdates || [];
    message.meta.statusUpdates.push({
      status: nextStatus,
      timestamp: Date.now(),
      provider: 'gupshup',
      raw: status
    });
    await message.save();

    if (workspaceId) {
      getIO()?.to(`workspace:${workspaceId}`).emit('message.status', {
        messageId: message._id,
        status: nextStatus
      });
    }
  }
}

module.exports = {
  verify,
  handler,
  processWebhookPayload
};
