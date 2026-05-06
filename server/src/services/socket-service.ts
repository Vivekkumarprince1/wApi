/**
 * SOCKET SERVICE
 * Handles real-time event broadcasting for the Shared Inbox.
 */

import { getSocketEmitter } from "./socket-emitter";

// Room Helpers
export const getWorkspaceRoom = (workspaceId: string) => `workspace:${workspaceId}`;
export const getUserRoom = (userId: string) => `user:${userId}`;
export const getConversationRoom = (conversationId: string) => `conversation:${conversationId}`;

/**
 * Global reference to IO instance (initialized in server.js via bridge)
 */
export const getIO = () => {
  // @ts-ignore - global.io is set in server.js
  return global.io || null;
};

/**
 * Fallback to Redis Emitter if global.io is missing (e.g., in background workers)
 */
const getBroadcaster = (roomId: string) => {
  try {
    const io = getIO();
    if (io) {
      // If we have a local IO instance, use it to ensure direct delivery to local sockets
      return io.to(roomId);
    }
    // Otherwise use the Redis Emitter for cross-process reachability
    return getSocketEmitter().to(roomId);
  } catch (err) {
    console.error(`[SocketService] Failed to get broadcaster for room ${roomId}:`, err);
    // Return a dummy object with an emit method that does nothing to prevent downstream crashes
    return {
      emit: (event: string, ...args: any[]) => {
        console.warn(`[SocketService] Suppressed emit(${event}) due to broadcaster error`);
        return false;
      },
      to: (room: string) => ({ emit: () => false })
    } as any;
  }
};

/**
 * Emit message sent event (Outbound)
 */
export async function emitMessageSent(workspaceId: string, conversationId: string, message: any, sentBy: any, socketId?: string) {
  const payload = {
    conversationId,
    message: {
      ...(message.toObject ? message.toObject() : message),
      sentBy: {
        _id: sentBy?._id,
        name: sentBy?.name
      }
    }
  };

  const workspaceRoom = getWorkspaceRoom(workspaceId);
  const conversationRoom = getConversationRoom(conversationId);

  // Use emitter with broadcast if socketId is provided to avoid echo to sender
  const broadcasterWorkspace = getSocketEmitter().to(workspaceRoom);
  const broadcasterConversation = getSocketEmitter().to(conversationRoom);

  if (socketId) {
    // If we have a local IO instance, use broadcast to exclude the sender
    const io = getIO();
    if (io) {
      io.to(workspaceRoom).except(socketId).emit('inbox:message_new', payload);
      io.to(conversationRoom).except(socketId).emit('inbox:message_new', payload);
    } else {
      // Redis emitter doesn't easily support 'except', but the frontend deduplicates via ID anyway.
      // However, we should still use a single event name.
      broadcasterWorkspace.emit('inbox:message_new', payload);
      broadcasterConversation.emit('inbox:message_new', payload);
    }
  } else {
    broadcasterWorkspace.emit('inbox:message_new', payload);
    broadcasterConversation.emit('inbox:message_new', payload);
  }
  
  console.log(`[Socket] Emitted inbox:message_new for outbound message ${message._id}`);
}

/**
 * Emit new message event (Inbound from Webhook)
 */
export async function emitNewInboundMessage(workspaceId: string, conversation: any, message: any, contact: any) {
  const payload = {
    conversationId: conversation._id,
    message: {
      ...(message.toObject ? message.toObject() : message)
    },
    contact: {
      _id: contact?._id,
      name: contact?.name,
      phone: contact?.phone
    }
  };

  // Standardized naming: inbox:message_new (Synchronized with reference project)
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('inbox:message_new', payload);
  getBroadcaster(getConversationRoom(conversation._id)).emit('inbox:message_new', payload);
  
  console.log(`[Socket] Emitted inbox:message_new for inbound message ${message._id} with status: ${message.status || 'received'}`);
}

export async function emitTyping(workspaceId: string, conversationId: string, user: any, isTyping: boolean) {
  const payload = {
    conversationId,
    user: { id: user._id, name: user.name },
    isTyping
  };

  getBroadcaster(getConversationRoom(conversationId)).emit('conversation:typing', payload);
}

export async function emitStatusUpdate(workspaceId: string, conversationId: string, messageId: string, status: string, timestamp: Date) {
  const payload = {
    messageId,
    conversationId,
    status: (status || 'sent').toLowerCase(),
    timestamp: timestamp.toISOString()
  };

  console.log(`[Socket] Broadcasting status update (${status}) for ${messageId} to rooms: workspace:${workspaceId}, conversation:${conversationId}`);
  
  const broadcasterWorkspace = getBroadcaster(getWorkspaceRoom(workspaceId));
  const broadcasterConversation = getBroadcaster(getConversationRoom(conversationId));

  broadcasterWorkspace.emit('inbox:message_status', payload);
  broadcasterConversation.emit('inbox:message_status', payload);
}

/**
 * Optimized batch status emission for high-volume delivery/read receipts.
 */
export async function emitStatusBatch(workspaceId: string, updates: Array<{ messageId: string; conversationId: string; status: string; timestamp: Date }>) {
  if (!updates.length) return;

  const normalizedUpdates = updates.map(u => ({
    messageId: u.messageId,
    conversationId: u.conversationId,
    status: (u.status || 'sent').toLowerCase(),
    timestamp: u.timestamp.toISOString()
  }));

  // 1. Emit full batch to Workspace Room (Inbox view)
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('inbox:status_batch', {
    workspaceId,
    updates: normalizedUpdates
  });

  // 2. Group by Conversation and emit per Conversation Room (Message Thread view)
  const convGroups = new Map<string, any[]>();
  normalizedUpdates.forEach(u => {
    if (!convGroups.has(u.conversationId)) convGroups.set(u.conversationId, []);
    convGroups.get(u.conversationId)!.push(u);
  });

  for (const [convId, convUpdates] of Array.from(convGroups.entries())) {
    getBroadcaster(getConversationRoom(convId)).emit('inbox:status_batch', {
      conversationId: convId,
      updates: convUpdates
    });
  }

  console.log(`[Socket] Emitted status batch for ${updates.length} messages (Workspace: ${workspaceId})`);
}

const toIsoString = (value: Date | string | undefined) => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

export async function emitCampaignStatusUpdate(workspaceId: string, payload: Record<string, any>) {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('campaign:status_update', {
    workspaceId,
    ...payload,
    updatedAt: toIsoString(payload.updatedAt),
  });
}

export async function emitCampaignStatusBatch(
  workspaceId: string,
  updates: Array<{ campaignId: string; status: string; timestamp: Date | string; messageId?: string }>
) {
  if (!updates.length) return;

  const normalizedUpdates = updates.map((update) => ({
    campaignId: update.campaignId,
    messageId: update.messageId,
    status: (update.status || 'sent').toLowerCase(),
    timestamp: toIsoString(update.timestamp),
  }));

  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('campaign:message_status_batch', {
    workspaceId,
    updates: normalizedUpdates,
  });

  console.log(`[Socket] Emitted campaign status batch for ${normalizedUpdates.length} updates (Workspace: ${workspaceId})`);
}

/**
 * Emit contact created
 */
export async function emitContactCreated(workspaceId: string, contact: any) {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('contact:created', {
    type: 'contact.created',
    data: contact,
    timestamp: new Date()
  });
}

/**
 * Emit contact updated
 */
export async function emitContactUpdated(workspaceId: string, contactId: string, updates: any) {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('contact:updated', {
    type: 'contact.updated',
    contactId,
    updates,
    timestamp: new Date()
  });
}

/**
 * Emit contact deleted
 */
export async function emitContactDeleted(workspaceId: string, contactId: string) {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('contact:deleted', {
    type: 'contact.deleted',
    contactId,
    timestamp: new Date()
  });
}

/**
 * Emit conversation updated (List update)
 */
export async function emitConversationUpdated(workspaceId: string, conversationId: string, updates: any) {
  const payload = {
    conversationId,
    updates,
    timestamp: new Date()
  };
  
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('conversation:updated', payload);
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('inbox:conversation_updated', payload);
}

/**
 * Emit template synchronized
 */
export async function emitTemplateSynced(workspaceId: string, templates: any[]) {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('templates:synced', {
    type: 'templates.synced',
    count: templates.length,
    templates,
    timestamp: new Date()
  });
}

/**
 * Emit user status change (online/offline)
 */
export async function emitUserStatusChanged(workspaceId: string, userId: string, status: 'online' | 'offline' | 'away') {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('user:status', {
    type: 'user.status',
    userId,
    status,
    timestamp: new Date()
  });
}

/**
 * Emit workspace settings change
 */
export async function emitWorkspaceSettingsUpdated(workspaceId: string, settings: any) {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit('workspace:settings-updated', {
    type: 'workspace.settings',
    settings,
    timestamp: new Date()
  });
}

/**
 * Emit error event for specific user
 */
export async function emitError(workspaceId: string, userId: string, error: any) {
  getBroadcaster(getUserRoom(userId)).emit('error:occurred', {
    type: 'error',
    error: {
      message: error.message || 'An error occurred',
      code: error.code,
      timestamp: new Date()
    }
  });
}

/**
 * Generic Emitter (for custom events)
 */
export async function emitCustom(workspaceId: string, eventName: string, data: any) {
  getBroadcaster(getWorkspaceRoom(workspaceId)).emit(eventName, {
    type: eventName,
    data,
    timestamp: new Date()
  });
}
/**
 * Emit notification to a specific user
 */
export async function emitNotification(userId: string, notification: any) {
  getBroadcaster(getUserRoom(userId)).emit('system:notification', {
    success: true,
    notification,
    timestamp: new Date()
  });
}

/**
 * SocketService Object Export
 * Provides a unified interface for all socket operations
 */
export const SocketService = {
  getIO,
  getWorkspaceRoom,
  getUserRoom,
  getConversationRoom,
  emitMessageSent,
  emitNewInboundMessage,
  emitTyping,
  emitStatusUpdate,
  emitStatusBatch,
  emitCampaignStatusUpdate,
  emitCampaignStatusBatch,
  emitContactCreated,
  emitContactUpdated,
  emitContactDeleted,
  emitConversationUpdated,
  emitTemplateSynced,
  emitUserStatusChanged,
  emitWorkspaceSettingsUpdated,
  emitError,
  emitCustom,
  emitNotification
};
