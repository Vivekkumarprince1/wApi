const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MESSAGE MODEL
 * 
 * Stores all WhatsApp messages (inbound and outbound) for:
 * - Conversation history
 * - Template send logging
 * - Billing/analytics (conversation categories)
 * - Delivery status tracking
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const MessageSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSPACE & CONTACT
  // ─────────────────────────────────────────────────────────────────────────────
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true
  },
  contact: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contact',
    index: true
  },
  // Conversation reference (inbox threading)
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    index: true
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MESSAGE PROPERTIES
  // ─────────────────────────────────────────────────────────────────────────────
  // Agent/system sender (for outbound from inbox)
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  direction: { 
    type: String, 
    enum: ['inbound', 'outbound'], 
    required: true,
    index: true
  },
  type: { 
    type: String, 
    enum: ['text', 'template', 'image', 'video', 'document', 'audio', 'sticker', 'location', 'contacts', 'interactive', 'reaction'], 
    default: 'text',
    index: true
  },
  body: { type: String },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DELIVERY STATUS
  // ─────────────────────────────────────────────────────────────────────────────
  status: { 
    type: String, 
    enum: ['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'received'], 
    default: 'queued',
    index: true
  },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // WHATSAPP IDENTIFIERS
  // ─────────────────────────────────────────────────────────────────────────────
  whatsappMessageId: { type: String, index: true }, // wamid.xxx
  whatsappConversationId: { type: String }, // Conversation ID from Meta
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATE-SPECIFIC FIELDS
  // ─────────────────────────────────────────────────────────────────────────────
  template: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    name: { type: String },
    metaTemplateName: { type: String },
    category: { 
      type: String, 
      enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] 
    },
    language: { type: String },
    variables: {
      header: [String],
      body: [String],
      buttons: [String]
    }
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSATION BILLING (INTERAKT-STYLE)
  // ─────────────────────────────────────────────────────────────────────────────
  conversationBilling: {
    category: {
      type: String,
      enum: [
        'marketing_conversation',
        'utility_conversation', 
        'authentication_conversation',
        'service_conversation' // User-initiated (free tier)
      ]
    },
    // Conversation window (24-hour sessions)
    windowStart: { type: Date },
    windowEnd: { type: Date },
    isNewConversation: { type: Boolean, default: false }, // First message in 24hr window
    // Pricing info
    pricingModel: { type: String }, // conversation-based, message-based
    estimatedCost: { type: Number }
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MEDIA (for image, video, document, audio types)
  // ─────────────────────────────────────────────────────────────────────────────
  media: {
    id: { type: String }, // Meta media ID
    url: { type: String },
    mimeType: { type: String },
    filename: { type: String },
    fileSize: { type: Number },
    sha256: { type: String },
    caption: { type: String }
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CAMPAIGN TRACKING
  // ─────────────────────────────────────────────────────────────────────────────
  campaign: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    name: { type: String },
    batchId: { type: String }
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────────────────
  meta: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  
  // Recipient phone (for quick queries without contact lookup)
  recipientPhone: { type: String, index: true },
  
  // Created timestamp
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// ═══════════════════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════════════════

// Compound indexes for common queries
MessageSchema.index({ workspace: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, contact: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, type: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, 'template.category': 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, 'campaign.id': 1 });

// ═══════════════════════════════════════════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update delivery status from webhook
 */
MessageSchema.methods.updateStatus = async function(newStatus, timestamp) {
  this.status = newStatus;
  
  const now = timestamp ? new Date(timestamp * 1000) : new Date();
  
  switch (newStatus) {
    case 'sent':
      this.sentAt = this.sentAt || now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      break;
    case 'read':
      this.readAt = now;
      break;
    case 'failed':
      this.failedAt = now;
      break;
  }
  
  return this.save();
};

/**
 * Check if message is within conversation window
 */
MessageSchema.methods.isInConversationWindow = function() {
  if (!this.conversationBilling?.windowEnd) return false;
  return new Date() < this.conversationBilling.windowEnd;
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find message by WhatsApp message ID
 */
MessageSchema.statics.findByWhatsAppId = function(wamid) {
  return this.findOne({ whatsappMessageId: wamid });
};

/**
 * Get conversation history for a contact
 */
MessageSchema.statics.getConversationHistory = function(workspaceId, contactId, options = {}) {
  const { limit = 50, before, after } = options;
  
  const query = {
    workspace: workspaceId,
    contact: contactId
  };
  
  if (before) query.createdAt = { $lt: new Date(before) };
  if (after) query.createdAt = { ...query.createdAt, $gt: new Date(after) };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get template send stats for workspace
 */
MessageSchema.statics.getTemplateStats = function(workspaceId, startDate, endDate) {
  const match = {
    workspace: workspaceId,
    type: 'template',
    direction: 'outbound'
  };
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          category: '$template.category',
          status: '$status'
        },
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Message', MessageSchema);
