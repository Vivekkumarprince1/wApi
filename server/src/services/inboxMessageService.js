/**
 * Inbox Message Service - Stage 4 + Hardening
 * Handles agent message sending with permission validation
 * 
 * Features:
 * - Permission validation before sending
 * - 24-hour window checking for free messages
 * - Real-time socket updates
 * - Conversation state updates
 * 
 * Stage 4 Hardening additions:
 * - Per-agent rate limiting
 * - Soft lock release on send
 * - SLA tracking (clear deadline on first response)
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const Permission = require('../models/Permission');
const metaService = require('./metaService');
const { getIO } = require('../utils/socket');

// Hardening services
const agentRateLimitService = require('./agentRateLimitService');
const slaService = require('./slaService');
const softLockService = require('./softLockService');

// 24-hour window in milliseconds
const WINDOW_24H = 24 * 60 * 60 * 1000;

/**
 * Check if agent can send message to a conversation
 */
async function canAgentSendMessage(agentId, workspaceId, conversationId) {
  // Get permission
  const permission = await Permission.findOne({
    workspace: workspaceId,
    user: agentId,
    isActive: true
  }).lean();

  if (!permission) {
    return { allowed: false, reason: 'No active permissions' };
  }

  // Owner and manager can send to any conversation
  if (permission.role === 'owner' || permission.role === 'manager') {
    return { allowed: true };
  }

  // Agents need sendMessages permission
  if (!permission.permissions?.sendMessages) {
    return { allowed: false, reason: 'No sendMessages permission' };
  }

  // Get conversation
  const conversation = await Conversation.findOne({
    _id: conversationId,
    workspace: workspaceId
  }).select('assignedTo status').lean();

  if (!conversation) {
    return { allowed: false, reason: 'Conversation not found' };
  }

  // Agents can only send to their assigned conversations
  if (!conversation.assignedTo || 
      conversation.assignedTo.toString() !== agentId.toString()) {
    return { allowed: false, reason: 'Conversation not assigned to you' };
  }

  // Check if conversation is closed
  if (conversation.status === 'closed') {
    return { allowed: false, reason: 'Conversation is closed' };
  }

  return { allowed: true };
}

/**
 * Check if we're within the 24-hour free messaging window
 */
async function isWithin24HourWindow(conversationId) {
  const conversation = await Conversation.findById(conversationId)
    .select('lastCustomerMessageAt')
    .lean();

  if (!conversation?.lastCustomerMessageAt) {
    return false;
  }

  const timeSinceLastCustomerMessage = Date.now() - new Date(conversation.lastCustomerMessageAt).getTime();
  return timeSinceLastCustomerMessage < WINDOW_24H;
}

/**
 * Send a text message from inbox
 * This is the main entry point for agents sending messages
 */
async function sendTextMessage(options) {
  const {
    workspaceId,
    conversationId,
    agentId,
    text,
    skipPermissionCheck = false
  } = options;

  // 1. Permission check (unless skipped for system messages)
  if (!skipPermissionCheck) {
    const permissionCheck = await canAgentSendMessage(agentId, workspaceId, conversationId);
    if (!permissionCheck.allowed) {
      throw new Error(`PERMISSION_DENIED: ${permissionCheck.reason}`);
    }
  }

  // 1.5 HARDENING: Per-agent rate limiting
  const rateLimitCheck = await agentRateLimitService.checkAgentRateLimit(agentId, workspaceId);
  if (!rateLimitCheck.allowed) {
    throw new Error(`RATE_LIMITED: ${rateLimitCheck.message}`);
  }

  // 2. Get workspace credentials
  const workspace = await Workspace.findById(workspaceId)
    .select('accessToken phoneNumberId')
    .lean();

  if (!workspace?.accessToken || !workspace?.phoneNumberId) {
    throw new Error('Workspace not configured for WhatsApp');
  }

  // 3. Get conversation and contact
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const contact = await Contact.findById(conversation.contact)
    .select('phone name')
    .lean();

  if (!contact?.phone) {
    throw new Error('Contact phone not found');
  }

  // 4. Check 24-hour window
  const isInWindow = await isWithin24HourWindow(conversationId);
  
  // 5. Send via Meta API
  const result = await metaService.sendTextMessage(
    workspace.accessToken,
    workspace.phoneNumberId,
    contact.phone,
    text
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to send message');
  }

  // 6. Save message to database
  const message = await Message.create({
    workspace: workspaceId,
    conversation: conversationId,
    contact: contact._id,
    direction: 'outbound',
    type: 'text',
    text: { body: text },
    whatsappMessageId: result.messageId,
    status: 'sent',
    sentBy: agentId,
    sentAt: new Date()
  });

  // 7. Update conversation
  const now = new Date();
  conversation.lastMessageAt = now;
  conversation.lastActivityAt = now;
  conversation.lastMessagePreview = text.substring(0, 100);
  conversation.lastMessageDirection = 'outbound';
  conversation.lastMessageType = 'text';
  conversation.lastRepliedBy = agentId;
  conversation.lastAgentReplyAt = now;
  conversation.messageCount = (conversation.messageCount || 0) + 1;

  // Track first response for SLA
  if (!conversation.firstResponseAt) {
    conversation.firstResponseAt = now;
    conversation.firstResponseBy = agentId;
    
    // HARDENING: Clear SLA deadline on first response
    await slaService.clearSlaDeadline(conversationId, 'first_response');
  }

  // Update billing counters
  if (isInWindow) {
    conversation.freeMessageCount = (conversation.freeMessageCount || 0) + 1;
  }

  // Mark as read for this agent (they just replied)
  conversation.markReadForAgent(agentId);

  // Reopen if pending or snoozed
  if (conversation.status === 'pending' || conversation.status === 'snoozed') {
    conversation.updateStatus('open', agentId);
  }

  await conversation.save();

  // HARDENING: Release soft lock after sending
  await softLockService.releaseSoftLock(conversationId, agentId, workspaceId);

  // 8. Emit socket event for real-time update
  const io = getIO();
  if (io) {
    const messageData = message.toObject();
    messageData.sentByUser = { _id: agentId }; // Will be populated on client if needed

    // Broadcast to workspace
    io.to(`workspace:${workspaceId}`).emit('message:sent', {
      conversationId,
      message: messageData
    });

    // Update conversation preview
    io.to(`workspace:${workspaceId}`).emit('conversation:updated', {
      conversationId,
      updates: {
        lastMessageAt: now,
        lastMessagePreview: text.substring(0, 100),
        lastMessageDirection: 'outbound',
        lastRepliedBy: agentId
      }
    });
  }

  console.log(`[INBOX] Message sent by agent ${agentId} in conversation ${conversationId}`);

  return {
    success: true,
    message,
    whatsappMessageId: result.messageId,
    isWithin24HourWindow: isInWindow
  };
}

/**
 * Send a template message from inbox
 */
async function sendTemplateMessage(options) {
  const {
    workspaceId,
    conversationId,
    agentId,
    templateName,
    templateLanguage = 'en',
    components = [],
    skipPermissionCheck = false
  } = options;

  // 1. Permission check
  if (!skipPermissionCheck) {
    const permissionCheck = await canAgentSendMessage(agentId, workspaceId, conversationId);
    if (!permissionCheck.allowed) {
      throw new Error(`PERMISSION_DENIED: ${permissionCheck.reason}`);
    }
  }

  // 1.5 HARDENING: Per-agent rate limiting
  const rateLimitCheck = await agentRateLimitService.checkAgentRateLimit(agentId, workspaceId);
  if (!rateLimitCheck.allowed) {
    throw new Error(`RATE_LIMITED: ${rateLimitCheck.message}`);
  }

  // 2. Get workspace credentials
  const workspace = await Workspace.findById(workspaceId)
    .select('accessToken phoneNumberId')
    .lean();

  if (!workspace?.accessToken || !workspace?.phoneNumberId) {
    throw new Error('Workspace not configured for WhatsApp');
  }

  // 3. Get conversation and contact
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const contact = await Contact.findById(conversation.contact)
    .select('phone name')
    .lean();

  if (!contact?.phone) {
    throw new Error('Contact phone not found');
  }

  // 4. Send via Meta API
  const result = await metaService.sendTemplateMessage(
    workspace.accessToken,
    workspace.phoneNumberId,
    contact.phone,
    templateName,
    templateLanguage,
    components
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to send template message');
  }

  // 5. Save message to database
  const message = await Message.create({
    workspace: workspaceId,
    conversation: conversationId,
    contact: contact._id,
    direction: 'outbound',
    type: 'template',
    template: {
      name: templateName,
      language: templateLanguage,
      components
    },
    whatsappMessageId: result.messageId,
    status: 'sent',
    sentBy: agentId,
    sentAt: new Date()
  });

  // 6. Update conversation
  const now = new Date();
  conversation.lastMessageAt = now;
  conversation.lastActivityAt = now;
  conversation.lastMessagePreview = `[Template: ${templateName}]`;
  conversation.lastMessageDirection = 'outbound';
  conversation.lastMessageType = 'template';
  conversation.lastRepliedBy = agentId;
  conversation.lastAgentReplyAt = now;
  conversation.messageCount = (conversation.messageCount || 0) + 1;
  conversation.templateMessageCount = (conversation.templateMessageCount || 0) + 1;

  // Track first response for SLA
  if (!conversation.firstResponseAt) {
    conversation.firstResponseAt = now;
    conversation.firstResponseBy = agentId;
    
    // HARDENING: Clear SLA deadline on first response
    await slaService.clearSlaDeadline(conversationId, 'first_response');
  }

  // Mark as read for this agent
  conversation.markReadForAgent(agentId);

  // Open conversation if it was closed (template starts new window)
  if (conversation.status === 'closed') {
    conversation.updateStatus('open', agentId);
    conversation.conversationType = 'business_initiated';
    conversation.conversationStartedAt = now;
  }

  await conversation.save();

  // HARDENING: Release soft lock after sending
  await softLockService.releaseSoftLock(conversationId, agentId, workspaceId);

  // 7. Emit socket event
  const io = getIO();
  if (io) {
    const messageData = message.toObject();

    io.to(`workspace:${workspaceId}`).emit('message:sent', {
      conversationId,
      message: messageData
    });

    io.to(`workspace:${workspaceId}`).emit('conversation:updated', {
      conversationId,
      updates: {
        lastMessageAt: now,
        lastMessagePreview: `[Template: ${templateName}]`,
        lastMessageDirection: 'outbound'
      }
    });
  }

  console.log(`[INBOX] Template ${templateName} sent by agent ${agentId} in conversation ${conversationId}`);

  return {
    success: true,
    message,
    whatsappMessageId: result.messageId
  };
}

/**
 * Send a media message (image, document, video, audio)
 */
async function sendMediaMessage(options) {
  const {
    workspaceId,
    conversationId,
    agentId,
    mediaType, // 'image', 'document', 'video', 'audio'
    mediaUrl,
    caption,
    filename,
    skipPermissionCheck = false
  } = options;

  // 1. Permission check
  if (!skipPermissionCheck) {
    const permissionCheck = await canAgentSendMessage(agentId, workspaceId, conversationId);
    if (!permissionCheck.allowed) {
      throw new Error(`PERMISSION_DENIED: ${permissionCheck.reason}`);
    }
  }

  // 1.5 HARDENING: Per-agent rate limiting
  const rateLimitCheck = await agentRateLimitService.checkAgentRateLimit(agentId, workspaceId);
  if (!rateLimitCheck.allowed) {
    throw new Error(`RATE_LIMITED: ${rateLimitCheck.message}`);
  }

  // 2. Get workspace credentials
  const workspace = await Workspace.findById(workspaceId)
    .select('accessToken phoneNumberId')
    .lean();

  if (!workspace?.accessToken || !workspace?.phoneNumberId) {
    throw new Error('Workspace not configured for WhatsApp');
  }

  // 3. Get conversation and contact
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const contact = await Contact.findById(conversation.contact)
    .select('phone name')
    .lean();

  if (!contact?.phone) {
    throw new Error('Contact phone not found');
  }

  // 4. Check 24-hour window
  const isInWindow = await isWithin24HourWindow(conversationId);
  if (!isInWindow) {
    throw new Error('24-hour window expired. Please use a template message.');
  }

  // 5. Send via Meta API
  const result = await metaService.sendMediaMessage(
    workspace.accessToken,
    workspace.phoneNumberId,
    contact.phone,
    mediaType,
    mediaUrl,
    caption,
    filename
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to send media message');
  }

  // 6. Save message to database
  const message = await Message.create({
    workspace: workspaceId,
    conversation: conversationId,
    contact: contact._id,
    direction: 'outbound',
    type: mediaType,
    [mediaType]: {
      link: mediaUrl,
      caption,
      filename
    },
    whatsappMessageId: result.messageId,
    status: 'sent',
    sentBy: agentId,
    sentAt: new Date()
  });

  // 7. Update conversation
  const now = new Date();
  const preview = caption || `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}]`;
  
  conversation.lastMessageAt = now;
  conversation.lastActivityAt = now;
  conversation.lastMessagePreview = preview.substring(0, 100);
  conversation.lastMessageDirection = 'outbound';
  conversation.lastMessageType = mediaType;
  conversation.lastRepliedBy = agentId;
  conversation.lastAgentReplyAt = now;
  conversation.messageCount = (conversation.messageCount || 0) + 1;
  conversation.freeMessageCount = (conversation.freeMessageCount || 0) + 1;

  if (!conversation.firstResponseAt) {
    conversation.firstResponseAt = now;
    conversation.firstResponseBy = agentId;
    
    // HARDENING: Clear SLA deadline on first response
    await slaService.clearSlaDeadline(conversationId, 'first_response');
  }

  conversation.markReadForAgent(agentId);
  await conversation.save();

  // HARDENING: Release soft lock after sending
  await softLockService.releaseSoftLock(conversationId, agentId, workspaceId);

  // 8. Socket event
  const io = getIO();
  if (io) {
    io.to(`workspace:${workspaceId}`).emit('message:sent', {
      conversationId,
      message: message.toObject()
    });
  }

  console.log(`[INBOX] ${mediaType} sent by agent ${agentId} in conversation ${conversationId}`);

  return {
    success: true,
    message,
    whatsappMessageId: result.messageId
  };
}

/**
 * Get messages for a conversation (with permission check)
 */
async function getConversationMessages(options) {
  const {
    workspaceId,
    conversationId,
    agentId,
    page = 1,
    limit = 50,
    before // Optional: get messages before this timestamp
  } = options;

  // Permission check
  const permissionCheck = await canAgentSendMessage(agentId, workspaceId, conversationId);
  if (!permissionCheck.allowed) {
    throw new Error(`PERMISSION_DENIED: ${permissionCheck.reason}`);
  }

  const query = {
    workspace: workspaceId,
    conversation: conversationId
  };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const [messages, total] = await Promise.all([
    Message.find(query)
      .populate('sentBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Message.countDocuments(query)
  ]);

  // Reverse to get chronological order
  messages.reverse();

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    }
  };
}

module.exports = {
  canAgentSendMessage,
  isWithin24HourWindow,
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  getConversationMessages
};
