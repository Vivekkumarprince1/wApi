const Workspace = require('../models/Workspace');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

/**
 * CONVERSATION-BASED BILLING SERVICE
 * 
 * Interakt Model: Charge per "conversation" (24h session between business & customer)
 * NOT per message - prevents billing exploits
 * 
 * Key Rules:
 * 1. Conversation = 24h session with unique contact starting from first inbound message
 * 2. Only inbound messages start conversations (business-initiated don't count as new conversation)
 * 3. Outbound reply to existing conversation within 24h = same conversation
 * 4. After 24h silence = new conversation on next inbound/outbound
 * 5. Charge = per conversation, not per message (Interakt does this)
 * 
 * Implementation:
 * - Track: conversationId, startedAt, lastMessageAt, type (user or template)
 * - Calculate: unique conversations per phone per workspace
 * - Bill: /conversations endpoint for usage report
 * - Enforce: Rate limit at conversation level, not message level
 */

class ConversationBillingService {
  /**
   * Get or create conversation for contact
   * Called when message arrives (inbound) or is sent (outbound)
   */
  async getOrCreateConversation(workspaceId, contactId, messageType = 'inbound') {
    try {
      const Contact_doc = await Contact.findById(contactId).select('workspace _id phone');
      if (!Contact_doc) {
        throw new Error('Contact not found');
      }

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Find active conversation within 24h
      let conversation = await Conversation.findOne({
        workspaceId,
        contactId,
        lastMessageAt: { $gte: twentyFourHoursAgo },
      });

      if (conversation) {
        // Update last message timestamp
        conversation.lastMessageAt = now;
        conversation.messageCount = (conversation.messageCount || 0) + 1;
        await conversation.save();

        return {
          conversationId: conversation._id,
          isNew: false,
          createdAt: conversation.createdAt,
        };
      }

      // Create new conversation
      const newConversation = new Conversation({
        workspaceId,
        contactId,
        contactPhone: Contact_doc.phone,
        startedAt: now,
        lastMessageAt: now,
        messageCount: 1,
        type: messageType === 'inbound' ? 'customer_initiated' : 'business_initiated',
        status: 'active',
      });

      await newConversation.save();

      logger.info('[ConversationBilling] New conversation created:',
        {
          conversationId: newConversation._id,
          workspaceId,
          contactId,
          type: newConversation.type,
        }
      );

      return {
        conversationId: newConversation._id,
        isNew: true,
        createdAt: newConversation.createdAt,
      };
    } catch (error) {
      logger.error('[ConversationBilling] getOrCreateConversation failed:', error);
      throw error;
    }
  }

  /**
   * Record message in conversation
   * Tracks template vs free tier usage
   */
  async recordMessage(
    workspaceId,
    conversationId,
    contactId,
    messageType,
    isTemplate = false
  ) {
    try {
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        {
          $inc: {
            messageCount: 1,
            ...(isTemplate ? { templateMessageCount: 1 } : { freeMessageCount: 1 }),
          },
          $set: { lastMessageAt: new Date() },
        },
        { new: true }
      );

      // Log to audit trail
      await AuditLog.create({
        workspaceId,
        entityType: 'conversation',
        entityId: conversationId,
        action: 'message_recorded',
        details: {
          contactId,
          messageType,
          isTemplate,
          totalMessages: conversation.messageCount,
        },
        status: 'success',
      });

      return conversation;
    } catch (error) {
      logger.error('[ConversationBilling] recordMessage failed:', error);
      throw error;
    }
  }

  /**
   * Close conversation (24h+ idle)
   * Cron job calls this periodically
   */
  async closeInactiveConversations(workspaceId, idleThresholdHours = 24) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - idleThresholdHours);

      const result = await Conversation.updateMany(
        {
          workspaceId,
          status: 'active',
          lastMessageAt: { $lt: cutoffTime },
        },
        {
          $set: {
            status: 'closed',
            closedAt: new Date(),
          },
        }
      );

      logger.info('[ConversationBilling] Inactive conversations closed:', {
        workspaceId,
        count: result.modifiedCount,
        idleThresholdHours,
      });

      return result.modifiedCount;
    } catch (error) {
      logger.error('[ConversationBilling] closeInactiveConversations failed:', error);
      throw error;
    }
  }

  /**
   * Get conversation count for period (for billing)
   * Returns: total conversations, template conversations, free conversations
   */
  async getConversationMetrics(workspaceId, startDate, endDate) {
    try {
      const metrics = await Conversation.aggregate([
        {
          $match: {
            workspaceId,
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
          },
        },
        {
          $group: {
            _id: null,
            totalConversations: { $sum: 1 },
            totalMessages: { $sum: '$messageCount' },
            templateConversations: {
              $sum: { $cond: [{ $gt: ['$templateMessageCount', 0] }, 1, 0] },
            },
            freeConversations: {
              $sum: { $cond: [{ $eq: ['$templateMessageCount', 0] }, 1, 0] },
            },
            templateMessagesCount: { $sum: '$templateMessageCount' },
            freeMessagesCount: { $sum: '$freeMessageCount' },
          },
        },
      ]);

      if (metrics.length === 0) {
        return {
          totalConversations: 0,
          totalMessages: 0,
          templateConversations: 0,
          freeConversations: 0,
          templateMessagesCount: 0,
          freeMessagesCount: 0,
          period: { startDate, endDate },
        };
      }

      return {
        ...metrics[0],
        period: { startDate, endDate },
      };
    } catch (error) {
      logger.error('[ConversationBilling] getConversationMetrics failed:', error);
      throw error;
    }
  }

  /**
   * Get current month conversations (for dashboard)
   */
  async getCurrentMonthConversations(workspaceId) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      return this.getConversationMetrics(workspaceId, startOfMonth, endOfMonth);
    } catch (error) {
      logger.error('[ConversationBilling] getCurrentMonthConversations failed:', error);
      throw error;
    }
  }

  /**
   * List conversations with filters
   */
  async listConversations(
    workspaceId,
    { status = 'active', limit = 50, offset = 0 } = {}
  ) {
    try {
      const conversations = await Conversation.find({
        workspaceId,
        ...(status && { status }),
      })
        .populate('contactId', 'name phone email')
        .sort({ lastMessageAt: -1 })
        .skip(offset)
        .limit(limit);

      const total = await Conversation.countDocuments({
        workspaceId,
        ...(status && { status }),
      });

      return {
        conversations,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      logger.error('[ConversationBilling] listConversations failed:', error);
      throw error;
    }
  }

  /**
   * Estimate billing amount for conversations
   * Used for invoice generation
   */
  async calculateBillingAmount(workspaceId, plan, startDate, endDate) {
    try {
      const metrics = await this.getConversationMetrics(
        workspaceId,
        startDate,
        endDate
      );

      // Plan pricing (example - should come from database)
      const pricing = {
        starter: { pricePerConversation: 0.01, freeConversationsPerMonth: 100 },
        pro: { pricePerConversation: 0.005, freeConversationsPerMonth: 500 },
        enterprise: { pricePerConversation: 0, freeConversationsPerMonth: 50000 },
      };

      const planConfig = pricing[plan] || pricing.starter;

      // Calculate billable conversations (only above free threshold)
      const billableConversations = Math.max(
        0,
        metrics.totalConversations - planConfig.freeConversationsPerMonth
      );

      const amount = billableConversations * planConfig.pricePerConversation;

      return {
        totalConversations: metrics.totalConversations,
        billableConversations,
        freeConversationLimit: planConfig.freeConversationsPerMonth,
        amountUSD: Math.round(amount * 100) / 100,
        period: metrics.period,
        plan,
      };
    } catch (error) {
      logger.error('[ConversationBilling] calculateBillingAmount failed:', error);
      throw error;
    }
  }
}

module.exports = new ConversationBillingService();
