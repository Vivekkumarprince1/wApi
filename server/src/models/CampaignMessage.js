const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN MESSAGE MODEL - Stage 3 Enhanced
 * 
 * Tracks individual message sends in a campaign for:
 * - Idempotency (prevent duplicate sends)
 * - Retry safety
 * - Delivery tracking
 * - Webhook status rollups
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const CampaignMessageSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true 
  },
  campaign: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Campaign', 
    required: true,
    index: true 
  },
  message: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Message' 
  },
  contact: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contact', 
    required: true,
    index: true 
  },
  
  // Recipient info (denormalized for performance)
  phone: { type: String },
  
  // Status lifecycle for idempotency
  status: { 
    type: String, 
    enum: ['pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed'], 
    default: 'queued',
    index: true 
  },
  
  // Retry tracking
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttemptAt: { type: Date },
  lastError: { type: String },
  errorCode: { type: String },
  
  // WhatsApp tracking
  whatsappMessageId: { type: String, index: true }, // wamid.xxx from Meta
  
  // Webhook updates (timestamps for each status)
  queuedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
  
  // Batch reference
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignBatch' },
  batchIndex: { type: Number },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
CampaignMessageSchema.index({ campaign: 1, contact: 1 }, { unique: true }); // Prevent duplicate sends
CampaignMessageSchema.index({ campaign: 1, status: 1 });
CampaignMessageSchema.index({ whatsappMessageId: 1 }, { sparse: true }); // For webhook lookups
CampaignMessageSchema.index({ workspace: 1, createdAt: -1 });
CampaignMessageSchema.index({ workspace: 1, contact: 1, sentAt: -1 }); // For reply tracking

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
CampaignMessageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if message can be retried
 */
CampaignMessageSchema.methods.canRetry = function() {
  return this.status === 'failed' && this.attempts < this.maxAttempts;
};

/**
 * Update status with timestamp
 */
CampaignMessageSchema.methods.updateStatus = function(newStatus, timestamp = new Date()) {
  this.status = newStatus;
  
  switch (newStatus) {
    case 'queued':
      this.queuedAt = timestamp;
      break;
    case 'sent':
      this.sentAt = timestamp;
      break;
    case 'delivered':
      this.deliveredAt = timestamp;
      break;
    case 'read':
      this.readAt = timestamp;
      break;
    case 'failed':
      this.failedAt = timestamp;
      break;
  }
  
  return this.save();
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get message counts by status for a campaign
 */
CampaignMessageSchema.statics.getStatusCounts = async function(campaignId) {
  const counts = await this.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(campaignId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  return counts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
};

/**
 * Find by WhatsApp message ID
 */
CampaignMessageSchema.statics.findByWhatsAppId = function(whatsappMessageId) {
  return this.findOne({ whatsappMessageId });
};

module.exports = mongoose.model('CampaignMessage', CampaignMessageSchema);
