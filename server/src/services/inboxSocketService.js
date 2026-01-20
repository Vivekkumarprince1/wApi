/**
 * Inbox Socket Service - Stage 4
 * Handles real-time updates for Shared Inbox
 * 
 * Events emitted:
 * - inbox:new-message      - New inbound message received
 * - inbox:message-sent     - Outbound message sent by agent
 * - inbox:assignment       - Conversation assigned/unassigned
 * - inbox:status-change    - Conversation status changed
 * - inbox:new-conversation - New conversation started
 * - inbox:typing           - Agent typing indicator
 */

const { getIO } = require('../utils/socket');
const Permission = require('../models/Permission');

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET ROOM MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get socket room name for a workspace
 */
function getWorkspaceRoom(workspaceId) {
  return `workspace:${workspaceId}`;
}

/**
 * Get socket room name for a specific user
 */
function getUserRoom(userId) {
  return `user:${userId}`;
}

/**
 * Get socket room name for a specific conversation
 */
function getConversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// INBOUND MESSAGE EVENTS (from webhook)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit new inbound message event
 * Called when a customer sends a message (from webhook handler)
 */
async function emitNewMessage(workspaceId, conversation, message, contact) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId: conversation._id,
      message: {
        _id: message._id,
        type: message.type,
        text: message.text,
        direction: 'inbound',
        createdAt: message.createdAt,
        whatsappMessageId: message.whatsappMessageId
      },
      contact: {
        _id: contact._id,
        name: contact.name,
        phone: contact.phone,
        profilePicture: contact.profilePicture
      },
      conversation: {
        _id: conversation._id,
        status: conversation.status,
        assignedTo: conversation.assignedTo,
        unreadCount: conversation.unreadCount,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview
      }
    };

    // Emit to workspace room (all agents see it)
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:new-message', payload);

    // If assigned, emit specifically to the assigned agent
    if (conversation.assignedTo) {
      io.to(getUserRoom(conversation.assignedTo)).emit('inbox:my-message', payload);
    }

    // Emit to anyone viewing this conversation
    io.to(getConversationRoom(conversation._id)).emit('conversation:message', payload);

    console.log(`[SOCKET] Emitted inbox:new-message for conversation ${conversation._id}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting new message:', err.message);
  }
}

/**
 * Emit message sent event
 * Called when an agent sends a message
 */
async function emitMessageSent(workspaceId, conversationId, message, sentBy) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      message: {
        _id: message._id,
        type: message.type,
        text: message.text,
        template: message.template,
        direction: 'outbound',
        status: message.status,
        createdAt: message.createdAt,
        whatsappMessageId: message.whatsappMessageId,
        sentBy: {
          _id: sentBy._id,
          name: sentBy.name
        }
      }
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:message-sent', payload);

    // Emit to conversation viewers
    io.to(getConversationRoom(conversationId)).emit('conversation:message', payload);

    console.log(`[SOCKET] Emitted inbox:message-sent for conversation ${conversationId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting message sent:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGNMENT EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit conversation assigned event
 */
async function emitAssignment(workspaceId, conversationId, assignedTo, assignedBy, previousAssignee = null) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      assignedTo: assignedTo ? {
        _id: assignedTo._id,
        name: assignedTo.name,
        email: assignedTo.email
      } : null,
      assignedBy: {
        _id: assignedBy._id,
        name: assignedBy.name
      },
      previousAssignee: previousAssignee?.toString() || null,
      timestamp: new Date()
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:assignment', payload);

    // Notify the new assignee
    if (assignedTo) {
      io.to(getUserRoom(assignedTo._id)).emit('inbox:assigned-to-me', {
        conversationId,
        assignedBy: payload.assignedBy
      });
    }

    // Notify previous assignee
    if (previousAssignee && (!assignedTo || previousAssignee.toString() !== assignedTo._id.toString())) {
      io.to(getUserRoom(previousAssignee)).emit('inbox:unassigned-from-me', {
        conversationId
      });
    }

    console.log(`[SOCKET] Emitted inbox:assignment for conversation ${conversationId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting assignment:', err.message);
  }
}

/**
 * Emit conversation unassigned event
 */
async function emitUnassignment(workspaceId, conversationId, unassignedBy, previousAssignee) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      unassignedBy: {
        _id: unassignedBy._id,
        name: unassignedBy.name
      },
      previousAssignee: previousAssignee?.toString() || null,
      timestamp: new Date()
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:unassignment', payload);

    // Notify previous assignee
    if (previousAssignee) {
      io.to(getUserRoom(previousAssignee)).emit('inbox:unassigned-from-me', {
        conversationId
      });
    }

    console.log(`[SOCKET] Emitted inbox:unassignment for conversation ${conversationId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting unassignment:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CHANGE EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit conversation status change event
 */
async function emitStatusChange(workspaceId, conversationId, newStatus, changedBy, previousStatus = null) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      status: newStatus,
      previousStatus,
      changedBy: {
        _id: changedBy._id,
        name: changedBy.name
      },
      timestamp: new Date()
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:status-change', payload);

    // Emit to conversation viewers
    io.to(getConversationRoom(conversationId)).emit('conversation:status', payload);

    console.log(`[SOCKET] Emitted inbox:status-change (${newStatus}) for conversation ${conversationId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting status change:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW CONVERSATION EVENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit new conversation started event
 * Called when a new customer initiates a conversation
 */
async function emitNewConversation(workspaceId, conversation, contact, firstMessage) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversation: {
        _id: conversation._id,
        status: conversation.status,
        assignedTo: conversation.assignedTo,
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview
      },
      contact: {
        _id: contact._id,
        name: contact.name,
        phone: contact.phone,
        profilePicture: contact.profilePicture
      },
      firstMessage: firstMessage ? {
        _id: firstMessage._id,
        type: firstMessage.type,
        text: firstMessage.text,
        createdAt: firstMessage.createdAt
      } : null,
      timestamp: new Date()
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:new-conversation', payload);

    console.log(`[SOCKET] Emitted inbox:new-conversation for ${contact.phone}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting new conversation:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPING INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit agent typing indicator
 */
async function emitAgentTyping(workspaceId, conversationId, agent, isTyping = true) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      agent: {
        _id: agent._id,
        name: agent.name
      },
      isTyping,
      timestamp: new Date()
    };

    // Emit to conversation viewers
    io.to(getConversationRoom(conversationId)).emit('conversation:typing', payload);

    console.log(`[SOCKET] Emitted typing indicator for agent ${agent.name} in conversation ${conversationId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting typing:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION UPDATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit conversation update (generic)
 */
async function emitConversationUpdate(workspaceId, conversationId, updates) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      updates,
      timestamp: new Date()
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:conversation-update', payload);

    console.log(`[SOCKET] Emitted inbox:conversation-update for ${conversationId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting conversation update:', err.message);
  }
}

/**
 * Emit read receipt
 */
async function emitReadReceipt(workspaceId, conversationId, agentId) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      agentId,
      timestamp: new Date()
    };

    // Emit to conversation viewers
    io.to(getConversationRoom(conversationId)).emit('conversation:read', payload);

    console.log(`[SOCKET] Emitted read receipt for conversation ${conversationId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting read receipt:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE STATUS UPDATES (delivery, read receipts from WhatsApp)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit message status update (sent, delivered, read, failed)
 */
async function emitMessageStatus(workspaceId, conversationId, messageId, status, timestamp = null) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      conversationId,
      messageId,
      status,
      timestamp: timestamp || new Date()
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:message-status', payload);

    // Emit to conversation viewers
    io.to(getConversationRoom(conversationId)).emit('conversation:message-status', payload);

    console.log(`[SOCKET] Emitted message status (${status}) for message ${messageId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting message status:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INBOX STATS UPDATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Emit inbox stats update (for dashboard counters)
 */
async function emitStatsUpdate(workspaceId, stats) {
  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      stats,
      timestamp: new Date()
    };

    // Emit to workspace
    io.to(getWorkspaceRoom(workspaceId)).emit('inbox:stats-update', payload);

    console.log(`[SOCKET] Emitted inbox:stats-update for workspace ${workspaceId}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting stats update:', err.message);
  }
}

module.exports = {
  // Room helpers
  getWorkspaceRoom,
  getUserRoom,
  getConversationRoom,
  
  // Message events
  emitNewMessage,
  emitMessageSent,
  emitMessageStatus,
  
  // Assignment events
  emitAssignment,
  emitUnassignment,
  
  // Status events
  emitStatusChange,
  
  // Conversation events
  emitNewConversation,
  emitConversationUpdate,
  emitReadReceipt,
  
  // Typing
  emitAgentTyping,
  
  // Stats
  emitStatsUpdate
};
