/**
 * ConversationLedger Model - Stage 5 Billing
 * 
 * Tracks billable conversations following Meta's pricing model:
 * - Conversations are billed per 24-hour window
 * - Category determines pricing (MARKETING > UTILITY > AUTHENTICATION > SERVICE)
 * - Business-initiated conversations start when template is sent
 * - User-initiated conversations start when customer sends first message
 * 
 * This ledger provides accurate billing data for Interakt-style pricing.
 */

const mongoose = require('mongoose');

// Valid conversation categories per Meta's pricing model
const CONVERSATION_CATEGORIES = [
  'MARKETING',       // Promotional messages (highest cost)
  'UTILITY',         // Transactional messages (order updates, etc.)
  'AUTHENTICATION',  // OTP/verification messages
  'SERVICE'          // User-initiated free window replies (lowest/free)
];

// Who initiated the conversation
const INITIATOR_TYPES = ['BUSINESS', 'USER'];

// Where the conversation originated
const SOURCE_TYPES = ['CAMPAIGN', 'INBOX', 'API', 'AUTOMATION', 'ANSWERBOT'];

const ConversationLedgerSchema = new mongoose.Schema({
  // ═══════════════════════════════════════════════════════════════════
  // CORE IDENTIFIERS
  // ═══════════════════════════════════════════════════════════════════
  
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  
  // Phone number for quick lookups
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },

  // ═══════════════════════════════════════════════════════════════════
  // BILLING CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Conversation category per Meta's pricing tiers:
   * - MARKETING: Business-initiated with marketing template
   * - UTILITY: Business-initiated with utility template
   * - AUTHENTICATION: Business-initiated with authentication template
   * - SERVICE: User-initiated (customer messaged first, free 24h window)
   */
  category: {
    type: String,
    enum: CONVERSATION_CATEGORIES,
    required: true,
    index: true
  },
  
  /**
   * Who started the conversation:
   * - BUSINESS: Company sent first message (template)
   * - USER: Customer sent first message
   */
  initiatedBy: {
    type: String,
    enum: INITIATOR_TYPES,
    required: true,
    index: true
  },
  
  /**
   * Where the conversation originated:
   * - CAMPAIGN: Bulk campaign message
   * - INBOX: Agent sent from inbox
   * - API: External API call
   * - AUTOMATION: Workflow/automation trigger
   * - ANSWERBOT: FAQ auto-reply
   */
  source: {
    type: String,
    enum: SOURCE_TYPES,
    required: true,
    index: true
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIMING & WINDOW
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * When the conversation window started
   */
  startedAt: {
    type: Date,
    required: true,
    index: true
  },
  
  /**
   * When the 24-hour window expires
   * Calculated as startedAt + 24 hours
   */
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  /**
   * Whether the window is still active
   */
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  /**
   * When the window was closed (either expired or manually closed)
   */
  closedAt: {
    type: Date
  },

  // ═══════════════════════════════════════════════════════════════════
  // BILLING FLAGS
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Whether this conversation is billable
   * May be false for:
   * - Test/sandbox conversations
   * - Internal testing
   * - Conversations within existing user-initiated window
   */
  billable: {
    type: Boolean,
    default: true,
    index: true
  },
  
  /**
   * Whether this conversation has been billed/invoiced
   */
  billed: {
    type: Boolean,
    default: false
  },
  
  /**
   * Reference to invoice if billed
   */
  invoiceId: {
    type: String
  },
  
  /**
   * Billing period (YYYY-MM format)
   */
  billingPeriod: {
    type: String,
    index: true
  },

  // ═══════════════════════════════════════════════════════════════════
  // TEMPLATE REFERENCE (for business-initiated)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Template used to initiate (if business-initiated)
   */
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },
  
  /**
   * Template name for quick reference
   */
  templateName: {
    type: String
  },
  
  /**
   * Template category (should match conversation category)
   */
  templateCategory: {
    type: String
  },

  // ═══════════════════════════════════════════════════════════════════
  // MESSAGE TRACKING WITHIN WINDOW
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * First message that started this conversation
   */
  firstMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  /**
   * Total messages sent during this window
   */
  messageCount: {
    type: Number,
    default: 1
  },
  
  /**
   * Business messages sent
   */
  businessMessageCount: {
    type: Number,
    default: 0
  },
  
  /**
   * User messages received
   */
  userMessageCount: {
    type: Number,
    default: 0
  },
  
  /**
   * Last message timestamp (for window activity tracking)
   */
  lastMessageAt: {
    type: Date
  },

  // ═══════════════════════════════════════════════════════════════════
  // CAMPAIGN REFERENCE (if from campaign)
  // ═══════════════════════════════════════════════════════════════════
  
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  
  campaignName: {
    type: String
  },

  // ═══════════════════════════════════════════════════════════════════
  // AGENT TRACKING (if from inbox)
  // ═══════════════════════════════════════════════════════════════════
  
  initiatedByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ═══════════════════════════════════════════════════════════════════
  // META DATA
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * WhatsApp message ID of initiating message
   */
  whatsappMessageId: {
    type: String
  },
  
  /**
   * Meta's conversation ID (if provided in webhooks)
   */
  metaConversationId: {
    type: String
  },
  
  /**
   * Meta's pricing type from webhook
   */
  metaPricingType: {
    type: String
  },
  
  /**
   * Raw Meta billing event data
   */
  metaBillingData: {
    type: mongoose.Schema.Types.Mixed
  },

  // ═══════════════════════════════════════════════════════════════════
  // AUDIT
  // ═══════════════════════════════════════════════════════════════════
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  /**
   * Notes for manual adjustments
   */
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// ═══════════════════════════════════════════════════════════════════
// INDEXES FOR BILLING QUERIES
// ═══════════════════════════════════════════════════════════════════

// Find active conversation for contact (to check if within window)
ConversationLedgerSchema.index({ 
  workspace: 1, 
  contact: 1, 
  isActive: 1, 
  expiresAt: 1 
});

// Billing period aggregation
ConversationLedgerSchema.index({ 
  workspace: 1, 
  billingPeriod: 1, 
  category: 1, 
  billable: 1 
});

// Category breakdown reports
ConversationLedgerSchema.index({ 
  workspace: 1, 
  startedAt: 1, 
  category: 1 
});

// Campaign billing tracking
ConversationLedgerSchema.index({ 
  workspace: 1, 
  campaign: 1, 
  billable: 1 
});

// Source analysis
ConversationLedgerSchema.index({ 
  workspace: 1, 
  source: 1, 
  startedAt: 1 
});

// ═══════════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Find active conversation for a contact
 * Returns the conversation window if still valid (within 24h)
 */
ConversationLedgerSchema.statics.findActiveWindow = async function(workspaceId, contactId) {
  const now = new Date();
  return this.findOne({
    workspace: workspaceId,
    contact: contactId,
    isActive: true,
    expiresAt: { $gt: now }
  }).sort({ startedAt: -1 });
};

/**
 * Get billing summary for a period
 */
ConversationLedgerSchema.statics.getBillingSummary = async function(workspaceId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(workspaceId),
        startedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        billable: true
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalMessages: { $sum: '$messageCount' }
      }
    },
    {
      $project: {
        category: '$_id',
        count: 1,
        totalMessages: 1,
        _id: 0
      }
    }
  ]);
};

/**
 * Get monthly usage for workspace
 */
ConversationLedgerSchema.statics.getMonthlyUsage = async function(workspaceId, year, month) {
  const billingPeriod = `${year}-${String(month).padStart(2, '0')}`;
  
  return this.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(workspaceId),
        billingPeriod,
        billable: true
      }
    },
    {
      $group: {
        _id: {
          category: '$category',
          initiatedBy: '$initiatedBy'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        breakdown: {
          $push: {
            category: '$_id.category',
            initiatedBy: '$_id.initiatedBy',
            count: '$count'
          }
        }
      }
    }
  ]);
};

// ═══════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if this window is still active
 */
ConversationLedgerSchema.methods.isWindowActive = function() {
  return this.isActive && this.expiresAt > new Date();
};

/**
 * Record a new message in this window
 */
ConversationLedgerSchema.methods.recordMessage = function(direction) {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  
  if (direction === 'outbound') {
    this.businessMessageCount += 1;
  } else {
    this.userMessageCount += 1;
  }
  
  return this.save();
};

/**
 * Close the conversation window
 */
ConversationLedgerSchema.methods.closeWindow = function() {
  this.isActive = false;
  this.closedAt = new Date();
  return this.save();
};

// ═══════════════════════════════════════════════════════════════════
// PRE-SAVE HOOKS
// ═══════════════════════════════════════════════════════════════════

ConversationLedgerSchema.pre('save', function(next) {
  // Auto-calculate expiresAt if not set
  if (this.startedAt && !this.expiresAt) {
    this.expiresAt = new Date(this.startedAt.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Set billing period from startedAt
  if (this.startedAt && !this.billingPeriod) {
    const date = new Date(this.startedAt);
    this.billingPeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  // Check if window has expired
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.isActive = false;
    if (!this.closedAt) {
      this.closedAt = this.expiresAt;
    }
  }
  
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ConversationLedger', ConversationLedgerSchema);
