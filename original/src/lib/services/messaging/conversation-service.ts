import { Types } from 'mongoose';
import { Conversation, Message, Contact } from '@/lib/models';
const { getIO } = require('../socket-bridge');

/**
 * CONVERSATION SERVICE
 * 
 * Centralized logic for syncing messages to conversations 
 * and broadcasting real-time updates to the inbox.
 */
export class ConversationService {
  /**
   * Sync a message to its conversation thread.
   * Ensures the conversation exists, updates its metadata, and emits socket events.
   */
  static async syncMessage(messageId: string | Types.ObjectId) {
    const message = await Message.findById(messageId);
    if (!message) {
      console.warn(`[ConversationService] Message ${messageId} not found for sync`);
      return;
    }

    const isReaction = message.type === 'reaction';

    const workspaceId = message.workspace;
    const contactId = message.contact;

    if (!contactId) {
      console.warn(`[ConversationService] Message ${messageId} has no contactId, skipping sync`);
      return;
    }

    // 1. Ensure Conversation exists
    let conversation = await Conversation.findOne({ 
      workspace: workspaceId, 
      contact: contactId 
    });

    if (!conversation) {
      console.log(`[ConversationService] Creating new conversation for contact ${contactId} in workspace ${workspaceId}`);
      conversation = await Conversation.create({
        workspace: workspaceId,
        contact: contactId,
        status: 'open',
        isOpen: true,
        lastActivityAt: message.createdAt || new Date(),
        conversationType: message.direction === 'inbound' ? 'customer_initiated' : 'business_initiated',
      });
      if (message.direction === 'inbound') {
        (conversation as any).incrementUnreadForAllAgents();
      }
    }

    // 2. Link message to conversation if orphan
    if (!message.conversation) {
      message.conversation = conversation._id as Types.ObjectId;
      await message.save();
    }

    // 3. Update Conversation Metadata
    const updateData: any = {
      $set: {}
    };

    if (!isReaction) {
      updateData.$set.lastMessageAt = message.createdAt || new Date();
      updateData.$set.lastActivityAt = new Date();
      updateData.$set.lastMessagePreview = this.generatePreview(message);
      updateData.$set.lastMessageDirection = message.direction;
      updateData.$set.lastMessageType = message.type;
    }

    // Increment message counters
    if (!updateData.$inc) updateData.$inc = {};
    if (!isReaction) {
      updateData.$inc.messageCount = 1;
    }
    if (message.type === 'template' && !isReaction) {
       updateData.$inc.templateMessageCount = 1;
    }

    if (message.direction === 'inbound' && !isReaction) {
      (conversation as any).incrementUnreadForAllAgents();
      const lastInbound = message.createdAt || new Date();
      conversation.lastCustomerMessageAt = lastInbound;
      conversation.lastInboundAt = lastInbound;
      
      // Handle WhatsApp 24h Window (Gupshup Rule: 24h from last inbound)
      conversation.windowExpiresAt = new Date(new Date(lastInbound).getTime() + 24 * 60 * 60 * 1000);
      conversation.isOpen = true;
    } else if (!isReaction) {
      conversation.lastOutboundAt = new Date();
      if (message.sentBy) {
        conversation.lastRepliedBy = message.sentBy as any;
        conversation.lastAgentReplyAt = new Date();
      }
    }

    // Apply metadata updates to instance
    Object.assign(conversation, updateData.$set);
    if (updateData.$inc) {
      if (updateData.$inc.messageCount) conversation.messageCount = (conversation.messageCount || 0) + updateData.$inc.messageCount;
      if (updateData.$inc.templateMessageCount) conversation.templateMessageCount = (conversation.templateMessageCount || 0) + updateData.$inc.templateMessageCount;
    }

    await conversation.save();
    const updatedConversation = conversation;

    // 4. Multi-room Socket Broadcast (Standardized via SocketService for Process Isolation)
    const SocketService = require('../socket-service');

    const conversationIdStr = conversation._id.toString();
    const workspaceIdStr = workspaceId.toString();

    // Standardized Payload (Aligns with inbox expectations)
    const threadPayload = {
      conversationId: conversationIdStr,
      message
    };

    // Standardized UI Notifications
    if (message.direction === 'inbound') {
      await SocketService.emitNewInboundMessage(workspaceIdStr, conversation, message, null);
    } else {
      // For outbound, we can emit sent event
      const sentBy = message.sentBy ? await (require('@/lib/models').User.findById(message.sentBy).select('name')) : null;
      await SocketService.emitMessageSent(workspaceIdStr, conversationIdStr, message, sentBy);
    }

    // Always trigger list update for previews
    const listPayload = {
      conversationId: conversationIdStr,
      lastMessage: message,
      unreadCount: updatedConversation?.unreadCount || 0
    };
    
    // We'll add a helper for conversation list update to SocketService in next step if needed, 
    // but for now let's use the standardized workspace broadcaster
    SocketService.getIO() ? SocketService.getIO().to(`workspace:${workspaceIdStr}`).emit("inbox:conversation_updated", listPayload) : null;
    // Ensure it also goes through Redis bridge
    const { broadcastToWorkspace } = require('../socket-emitter');
    broadcastToWorkspace(workspaceIdStr, "inbox:conversation_updated", listPayload);

    return updatedConversation;
  }

  /**
   * Generate a clean preview string based on message type
   */
  private static generatePreview(message: any): string {
    let preview = '';
    
    switch (message.type) {
      case 'text':
        preview = message.body || '';
        break;
      case 'template':
        // Try to use the rendered body, fallback to template name
        preview = message.body || `[Template: ${message.template?.name || 'Message'}]`;
        break;
      case 'image':
        preview = message.body || '📷 Image';
        break;
      case 'video':
        preview = '🎥 Video';
        break;
      case 'audio':
        preview = '🎵 Audio';
        break;
      case 'document':
        preview = '📄 Document';
        break;
      default:
        preview = `[${message.type.toUpperCase()}]`;
    }

    return preview.substring(0, 100);
  }
}
