/**
 * Billing Ledger Service - Stage 5
 * 
 * Core billing logic following Meta's conversation pricing model:
 * 
 * 1. Business-Initiated Conversations:
 *    - Start when business sends template message
 *    - Category determined by template category (MARKETING/UTILITY/AUTHENTICATION)
 *    - 24-hour window starts from template send time
 * 
 * 2. User-Initiated Conversations:
 *    - Start when customer sends first message
 *    - Category is SERVICE (free tier or low cost)
 *    - 24-hour window starts from customer message
 * 
 * 3. Within-Window Messages:
 *    - Messages within 24h of conversation start are part of same conversation
 *    - No additional conversation charge (only message charges apply)
 * 
 * 4. Window Expiry:
 *    - After 24h, next message starts NEW conversation
 *    - Business reply after window requires template (new business-initiated)
 */

const ConversationLedger = require('../models/ConversationLedger');
const Conversation = require('../models/Conversation');
const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const Contact = require('../models/Contact');
const { logger } = require('../utils/logger');
const usageLedgerService = require('./usageLedgerService');

// Import event emitter for integration events
let integrationEventEmitter;
try {
  integrationEventEmitter = require('./integrationEventService');
} catch (e) {
  // Will be created later
}

/**
 * Resolve conversation category based on initiator and template
 * 
 * Rules:
 * - If business-initiated with template → use template category
 * - If user-initiated → SERVICE
 * - If reply within user-initiated window → still SERVICE
 * - If business sends template after window → template category
 */
function resolveCategory(initiatedBy, templateCategory) {
  // User-initiated conversations are always SERVICE
  if (initiatedBy === 'USER') {
    return 'SERVICE';
  }
  
  // Business-initiated must have template category
  if (initiatedBy === 'BUSINESS') {
    // Valid template categories
    const validCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
    
    if (templateCategory && validCategories.includes(templateCategory)) {
      return templateCategory;
    }
    
    // Map legacy categories
    const categoryMap = {
      'PROMOTIONAL': 'MARKETING',
      'TRANSACTIONAL': 'UTILITY',
      'OTP': 'AUTHENTICATION'
    };
    
    if (templateCategory && categoryMap[templateCategory]) {
      return categoryMap[templateCategory];
    }
    
    // Default business-initiated without valid category to UTILITY
    // This is a fallback - templates SHOULD always have category
    logger.warn('[BillingLedger] Business-initiated without valid category, defaulting to UTILITY', {
      templateCategory
    });
    return 'UTILITY';
  }
  
  // Fallback
  return 'SERVICE';
}

/**
 * Check if there's an active conversation window for this contact
 * 
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} contactId 
 * @returns {Object|null} Active ledger entry or null
 */
async function findActiveWindow(workspaceId, contactId) {
  const now = new Date();
  
  const activeWindow = await ConversationLedger.findOne({
    workspace: workspaceId,
    contact: contactId,
    isActive: true,
    expiresAt: { $gt: now }
  }).sort({ startedAt: -1 });
  
  return activeWindow;
}

/**
 * Start a new conversation window (business-initiated)
 * Called when business sends a template message
 * 
 * @param {Object} options
 * @returns {Object} Ledger entry
 */
async function startBusinessConversation(options) {
  const {
    workspaceId,
    conversationId,
    contactId,
    phoneNumber,
    templateId,
    templateName,
    templateCategory,
    source = 'INBOX',
    campaignId,
    campaignName,
    userId,
    messageId,
    whatsappMessageId,
    isBillable = true
  } = options;

  try {
    // Check for existing active window
    const existingWindow = await findActiveWindow(workspaceId, contactId);
    
    if (existingWindow) {
      // Window exists - record message in existing window
      await existingWindow.recordMessage('outbound');
      await usageLedgerService.incrementMessages({ workspaceId, direction: 'outbound' });
      
      logger.info('[BillingLedger] Message recorded in existing window', {
        ledgerId: existingWindow._id,
        conversationId,
        window: 'existing'
      });
      
      return {
        ledger: existingWindow,
        isNewConversation: false,
        billable: false // Not a new conversation charge
      };
    }
    
    // Resolve category from template
    const category = resolveCategory('BUSINESS', templateCategory);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Create new ledger entry
    const ledger = new ConversationLedger({
      workspace: workspaceId,
      conversation: conversationId,
      contact: contactId,
      phoneNumber,
      category,
      initiatedBy: 'BUSINESS',
      source,
      startedAt: now,
      expiresAt,
      isActive: true,
      billable: isBillable,
      template: templateId,
      templateName,
      templateCategory,
      campaign: campaignId,
      campaignName,
      initiatedByUser: userId,
      firstMessageId: messageId,
      whatsappMessageId,
      businessMessageCount: 1,
      userMessageCount: 0,
      messageCount: 1,
      lastMessageAt: now
    });
    
    await ledger.save();

    await usageLedgerService.incrementConversations({
      workspaceId,
      category,
      initiatedBy: 'BUSINESS'
    });
    await usageLedgerService.incrementMessages({ workspaceId, direction: 'outbound' });
    
    logger.info('[BillingLedger] New business conversation started', {
      ledgerId: ledger._id,
      conversationId,
      category,
      source,
      templateName,
      expiresAt
    });
    
    // Emit event for integrations
    if (integrationEventEmitter) {
      integrationEventEmitter.emit('conversation_started', {
        workspaceId,
        conversationId,
        ledgerId: ledger._id,
        category,
        initiatedBy: 'BUSINESS',
        source,
        templateName,
        phoneNumber,
        startedAt: now,
        expiresAt
      });
    }
    
    return {
      ledger,
      isNewConversation: true,
      billable: isBillable,
      category
    };
    
  } catch (error) {
    logger.error('[BillingLedger] startBusinessConversation failed:', error);
    throw error;
  }
}

/**
 * Start a new conversation window (user-initiated)
 * Called when customer sends first message
 * 
 * @param {Object} options
 * @returns {Object} Ledger entry
 */
async function startUserConversation(options) {
  const {
    workspaceId,
    conversationId,
    contactId,
    phoneNumber,
    messageId,
    whatsappMessageId,
    isBillable = true
  } = options;

  try {
    // Check for existing active window
    const existingWindow = await findActiveWindow(workspaceId, contactId);
    
    if (existingWindow) {
      // Window exists - record message
      await existingWindow.recordMessage('inbound');
      await usageLedgerService.incrementMessages({ workspaceId, direction: 'inbound' });
      
      logger.info('[BillingLedger] User message recorded in existing window', {
        ledgerId: existingWindow._id,
        conversationId
      });
      
      return {
        ledger: existingWindow,
        isNewConversation: false,
        billable: false
      };
    }
    
    // User-initiated is always SERVICE category
    const category = 'SERVICE';
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Create new ledger entry
    const ledger = new ConversationLedger({
      workspace: workspaceId,
      conversation: conversationId,
      contact: contactId,
      phoneNumber,
      category,
      initiatedBy: 'USER',
      source: 'INBOX', // User messages come through inbox
      startedAt: now,
      expiresAt,
      isActive: true,
      billable: isBillable,
      firstMessageId: messageId,
      whatsappMessageId,
      businessMessageCount: 0,
      userMessageCount: 1,
      messageCount: 1,
      lastMessageAt: now
    });
    
    await ledger.save();

    await usageLedgerService.incrementConversations({
      workspaceId,
      category,
      initiatedBy: 'USER'
    });
    await usageLedgerService.incrementMessages({ workspaceId, direction: 'inbound' });
    
    logger.info('[BillingLedger] New user conversation started', {
      ledgerId: ledger._id,
      conversationId,
      category,
      phoneNumber,
      expiresAt
    });
    
    // Emit event for integrations
    if (integrationEventEmitter) {
      integrationEventEmitter.emit('conversation_started', {
        workspaceId,
        conversationId,
        ledgerId: ledger._id,
        category,
        initiatedBy: 'USER',
        source: 'INBOX',
        phoneNumber,
        startedAt: now,
        expiresAt
      });
    }
    
    return {
      ledger,
      isNewConversation: true,
      billable: isBillable,
      category
    };
    
  } catch (error) {
    logger.error('[BillingLedger] startUserConversation failed:', error);
    throw error;
  }
}

/**
 * Record a message in an existing conversation
 * Updates the appropriate ledger entry
 * 
 * @param {Object} options
 * @returns {Object} Updated ledger
 */
async function recordMessage(options) {
  const {
    workspaceId,
    conversationId,
    contactId,
    direction, // 'inbound' or 'outbound'
    messageId,
    whatsappMessageId,
    isTemplate = false,
    templateCategory
  } = options;

  try {
    // Find active window
    const activeWindow = await findActiveWindow(workspaceId, contactId);
    
    if (activeWindow) {
      // Record in existing window
      await activeWindow.recordMessage(direction);
      await usageLedgerService.incrementMessages({ workspaceId, direction });
      
      return {
        ledger: activeWindow,
        isNewConversation: false,
        billable: false
      };
    }
    
    // No active window - this shouldn't normally happen for inbound
    // For outbound without window, business must use template
    if (direction === 'outbound') {
      if (isTemplate) {
        // Start new business conversation with template
        const contact = await Contact.findById(contactId).select('phone').lean();
        
        return startBusinessConversation({
          workspaceId,
          conversationId,
          contactId,
          phoneNumber: contact?.phone,
          templateCategory,
          messageId,
          whatsappMessageId,
          source: 'INBOX'
        });
      }
      
      // Outbound without template and without window - should not bill
      logger.warn('[BillingLedger] Outbound message without active window or template', {
        conversationId,
        contactId
      });
      return {
        ledger: null,
        isNewConversation: false,
        billable: false,
        error: 'NO_ACTIVE_WINDOW'
      };
    }
    
    // Inbound without window - start user conversation
    const contact = await Contact.findById(contactId).select('phone').lean();
    
    return startUserConversation({
      workspaceId,
      conversationId,
      contactId,
      phoneNumber: contact?.phone,
      messageId,
      whatsappMessageId
    });
    
  } catch (error) {
    logger.error('[BillingLedger] recordMessage failed:', error);
    throw error;
  }
}

/**
 * Check if there's an active free reply window
 * Used to determine if business can reply without template
 * 
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} contactId 
 * @returns {Boolean}
 */
async function hasActiveReplyWindow(workspaceId, contactId) {
  const activeWindow = await findActiveWindow(workspaceId, contactId);
  return activeWindow !== null;
}

/**
 * Close expired conversation windows
 * Should be called by cron job
 * 
 * @param {ObjectId} workspaceId Optional - if not provided, closes for all workspaces
 * @returns {Number} Count of closed windows
 */
async function closeExpiredWindows(workspaceId = null) {
  try {
    const now = new Date();
    
    const query = {
      isActive: true,
      expiresAt: { $lt: now }
    };
    
    if (workspaceId) {
      query.workspace = workspaceId;
    }
    
    const result = await ConversationLedger.updateMany(
      query,
      {
        $set: {
          isActive: false,
          closedAt: now
        }
      }
    );
    
    logger.info('[BillingLedger] Closed expired windows', {
      workspaceId: workspaceId || 'all',
      count: result.modifiedCount
    });
    
    return result.modifiedCount;
    
  } catch (error) {
    logger.error('[BillingLedger] closeExpiredWindows failed:', error);
    throw error;
  }
}

/**
 * Get conversation billing summary for a workspace
 * 
 * @param {ObjectId} workspaceId 
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Object} Summary with category breakdown
 */
async function getBillingSummary(workspaceId, startDate, endDate) {
  try {
    const summary = await ConversationLedger.aggregate([
      {
        $match: {
          workspace: new mongoose.Types.ObjectId(workspaceId),
          startedAt: { 
            $gte: new Date(startDate), 
            $lte: new Date(endDate) 
          },
          billable: true
        }
      },
      {
        $group: {
          _id: {
            category: '$category',
            initiatedBy: '$initiatedBy'
          },
          count: { $sum: 1 },
          totalMessages: { $sum: '$messageCount' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$count' },
          totalMessages: { $sum: '$totalMessages' },
          breakdown: {
            $push: {
              category: '$_id.category',
              initiatedBy: '$_id.initiatedBy',
              count: '$count',
              messages: '$totalMessages'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          totalMessages: 1,
          breakdown: 1
        }
      }
    ]);
    
    // Transform to structured response
    const result = summary[0] || { total: 0, totalMessages: 0, breakdown: [] };
    
    // Add category totals
    const categoryTotals = {
      MARKETING: 0,
      UTILITY: 0,
      AUTHENTICATION: 0,
      SERVICE: 0
    };
    
    result.breakdown.forEach(item => {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.count;
    });
    
    result.categoryTotals = categoryTotals;
    
    return result;
    
  } catch (error) {
    logger.error('[BillingLedger] getBillingSummary failed:', error);
    throw error;
  }
}

/**
 * Get workspace quota status
 * 
 * @param {ObjectId} workspaceId 
 * @returns {Object} Quota status with usage and limits
 */
async function getQuotaStatus(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId)
      .select('plan planLimits usage billingQuota')
      .lean();
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    
    // Get current month usage from ledger
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyUsage = await ConversationLedger.aggregate([
      {
        $match: {
          workspace: new mongoose.Types.ObjectId(workspaceId),
          startedAt: { $gte: startOfMonth },
          billable: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Build usage map
    const usageByCategory = {};
    let totalConversations = 0;
    
    monthlyUsage.forEach(item => {
      usageByCategory[item._id] = item.count;
      totalConversations += item.count;
    });
    
    // Get limits from workspace or defaults
    const limits = workspace.billingQuota || {
      monthlyConversations: workspace.planLimits?.maxMessages || 1000,
      marketingConversations: 500,
      utilityConversations: 300,
      authenticationConversations: 100,
      serviceConversations: 100
    };
    
    // Calculate percentages
    const totalPercentage = (totalConversations / limits.monthlyConversations) * 100;
    
    return {
      used: totalConversations,
      limit: limits.monthlyConversations,
      percentage: Math.round(totalPercentage * 100) / 100,
      warningThreshold: 80,
      blockThreshold: 100,
      isWarning: totalPercentage >= 80,
      isBlocked: totalPercentage >= 100,
      byCategory: usageByCategory,
      limits
    };
    
  } catch (error) {
    logger.error('[BillingLedger] getQuotaStatus failed:', error);
    throw error;
  }
}

const mongoose = require('mongoose');

module.exports = {
  resolveCategory,
  findActiveWindow,
  startBusinessConversation,
  startUserConversation,
  recordMessage,
  hasActiveReplyWindow,
  closeExpiredWindows,
  getBillingSummary,
  getQuotaStatus
};
