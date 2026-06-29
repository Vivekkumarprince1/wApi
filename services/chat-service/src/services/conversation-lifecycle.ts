import { Conversation, Message } from '../models/index.js';

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 24-hour customer-service-window enforcement, ported from the monolith's
 * WabaService.canSendSessionMessage. A free-form (non-template) message may
 * only be sent while the window opened by the customer's last inbound message
 * is still active. If conversation metadata is stale, self-heal it from the
 * most recent inbound message before refusing.
 */
export async function isSessionWindowOpen(conversation: any): Promise<boolean> {
  const now = new Date();

  // Window is open if isOpen is true AND it hasn't expired. Conversations
  // without a recorded expiry are treated as open (monolith behaviour for
  // docs that predate window tracking).
  const isOpen =
    conversation.isOpen &&
    (!conversation.windowExpiresAt || new Date(conversation.windowExpiresAt) > now);
  if (isOpen) {
    return true;
  }

  const lastInboundMessage: any = await Message.findOne({
    workspace: conversation.workspace,
    conversation: conversation._id,
    direction: 'inbound',
  })
    .sort({ sentAt: -1, createdAt: -1 })
    .select('sentAt createdAt')
    .lean();

  if (!lastInboundMessage) return false;

  const lastInboundAt = lastInboundMessage.sentAt || lastInboundMessage.createdAt;
  if (!lastInboundAt) return false;

  const lastInboundDate = new Date(lastInboundAt);
  if (Number.isNaN(lastInboundDate.getTime())) return false;

  const recoveredWindowExpiry = new Date(lastInboundDate.getTime() + SESSION_WINDOW_MS);
  if (recoveredWindowExpiry <= now) return false;

  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        isOpen: true,
        windowExpiresAt: recoveredWindowExpiry,
        lastInboundAt: lastInboundDate,
        status: conversation.status === 'closed' ? 'open' : conversation.status,
        lastActivityAt: now,
      },
    }
  );

  return true;
}

/**
 * Conversation metadata updates after an outbound message, ported from the
 * monolith's ConversationService.linkMessageToConversation (outbound branch):
 * inbox-list preview fields, counters and agent-reply tracking.
 */
export async function applyOutboundConversationUpdate(
  conversation: any,
  message: any,
  sentByUserId?: string
) {
  const now = new Date();
  const templateBody =
    message.template?.bodyText ||
    message.template?.body?.text ||
    (Array.isArray(message.template?.components)
      ? message.template.components.find((component: any) => String(component?.type || '').toUpperCase() === 'BODY')?.text
      : '');
  const preview =
    message.type === 'text'
      ? String(message.text || '').substring(0, 100)
      : message.type === 'template' && templateBody
        ? String(templateBody).substring(0, 100)
      : `[${message.type}]`;

  const update: any = {
    $set: {
      lastActivityAt: now,
      lastMessageAt: now,
      lastOutboundAt: now,
      lastMessagePreview: preview,
      lastMessageDirection: 'outbound',
      lastMessageType: message.type,
    },
    $inc: { messageCount: 1 },
  };

  if (message.type === 'template') {
    update.$inc.templateMessageCount = 1;
  }

  if (sentByUserId) {
    update.$set.lastRepliedBy = sentByUserId;
    update.$set.lastAgentReplyAt = now;
    if (!conversation.firstResponseAt) {
      update.$set.firstResponseAt = now;
      update.$set.firstResponseBy = sentByUserId;
    }
  }

  await Conversation.findByIdAndUpdate(conversation._id, update);
}
