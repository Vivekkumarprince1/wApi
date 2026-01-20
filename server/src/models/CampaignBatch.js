const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN BATCH MODEL - Stage 3 Implementation
 * 
 * Tracks individual batches of recipients for chunked campaign execution.
 * Each batch represents 50-100 recipients processed as a single job.
 * 
 * Flow:
 * 1. Campaign starts → Recipients chunked into batches
 * 2. Each batch enqueued as separate BullMQ job
 * 3. Worker processes batch → Updates batch status
 * 4. Campaign totals updated via rollups
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const CampaignBatchSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────────
  // REFERENCES
  // ─────────────────────────────────────────────────────────────────────────────
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
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH IDENTIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  batchIndex: { type: Number, required: true },
  totalBatches: { type: Number, required: true },
  jobId: { type: String, index: true }, // BullMQ job ID for idempotency
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RECIPIENTS IN THIS BATCH
  // ─────────────────────────────────────────────────────────────────────────────
  recipients: [{
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    phone: { type: String },
    status: { 
      type: String, 
      enum: ['pending', 'queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending'
    },
    messageId: { type: String }, // WhatsApp message ID
    error: { type: String },
    processedAt: { type: Date }
  }],
  
  // Total count for quick access
  recipientCount: { type: Number, default: 0 },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH STATUS
  // ─────────────────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED'],
    default: 'PENDING',
    index: true
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESSING STATS
  // ─────────────────────────────────────────────────────────────────────────────
  stats: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RETRY & ERROR TRACKING
  // ─────────────────────────────────────────────────────────────────────────────
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttemptAt: { type: Date },
  lastError: { type: String },
  errorCode: { type: String }, // Meta error code if applicable
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TIMING
  // ─────────────────────────────────────────────────────────────────────────────
  queuedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATE & VARIABLE MAPPING (Snapshot for this batch)
  // ─────────────────────────────────────────────────────────────────────────────
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  templateName: { type: String },
  variableMapping: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
CampaignBatchSchema.index({ campaign: 1, batchIndex: 1 }, { unique: true });
CampaignBatchSchema.index({ campaign: 1, status: 1 });
CampaignBatchSchema.index({ workspace: 1, status: 1, createdAt: -1 });
CampaignBatchSchema.index({ jobId: 1 }, { sparse: true });

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
CampaignBatchSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.recipientCount = this.recipients?.length || 0;
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark batch as started
 */
CampaignBatchSchema.methods.markStarted = function() {
  this.status = 'PROCESSING';
  this.startedAt = new Date();
  this.attempts += 1;
  this.lastAttemptAt = new Date();
  return this.save();
};

/**
 * Mark batch as completed
 */
CampaignBatchSchema.methods.markCompleted = function() {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  return this.save();
};

/**
 * Mark batch as failed
 */
CampaignBatchSchema.methods.markFailed = function(error, errorCode = null) {
  this.status = 'FAILED';
  this.lastError = error;
  this.errorCode = errorCode;
  this.completedAt = new Date();
  return this.save();
};

/**
 * Update recipient status within batch
 */
CampaignBatchSchema.methods.updateRecipientStatus = function(contactId, status, messageId = null, error = null) {
  const recipient = this.recipients.find(r => r.contactId.toString() === contactId.toString());
  if (recipient) {
    recipient.status = status;
    recipient.processedAt = new Date();
    if (messageId) recipient.messageId = messageId;
    if (error) recipient.error = error;
    
    // Update batch stats
    if (status === 'sent') this.stats.sent += 1;
    else if (status === 'failed') this.stats.failed += 1;
    else if (status === 'delivered') this.stats.delivered += 1;
    else if (status === 'read') this.stats.read += 1;
  }
  return this.save();
};

/**
 * Check if batch can be retried
 */
CampaignBatchSchema.methods.canRetry = function() {
  return this.status === 'FAILED' && this.attempts < this.maxAttempts;
};

/**
 * Get pending recipients in batch
 */
CampaignBatchSchema.methods.getPendingRecipients = function() {
  return this.recipients.filter(r => r.status === 'pending' || r.status === 'queued');
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create batches for a campaign
 * @param {ObjectId} campaignId 
 * @param {ObjectId} workspaceId 
 * @param {Array} contacts - Array of contact documents
 * @param {ObjectId} templateId 
 * @param {Object} variableMapping 
 * @param {Number} batchSize - Default 50
 */
CampaignBatchSchema.statics.createBatches = async function(
  campaignId, 
  workspaceId, 
  contacts, 
  templateId,
  templateName,
  variableMapping,
  batchSize = 50
) {
  const batches = [];
  const totalBatches = Math.ceil(contacts.length / batchSize);
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batchContacts = contacts.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    
    const batch = new this({
      workspace: workspaceId,
      campaign: campaignId,
      batchIndex,
      totalBatches,
      recipients: batchContacts.map(c => ({
        contactId: c._id,
        phone: c.phone,
        status: 'pending'
      })),
      recipientCount: batchContacts.length,
      templateId,
      templateName,
      variableMapping,
      status: 'PENDING'
    });
    
    batches.push(batch);
  }
  
  // Bulk insert all batches
  return this.insertMany(batches);
};

/**
 * Get next pending batch for a campaign
 */
CampaignBatchSchema.statics.getNextPendingBatch = function(campaignId) {
  return this.findOne({
    campaign: campaignId,
    status: { $in: ['PENDING', 'QUEUED'] }
  }).sort({ batchIndex: 1 });
};

/**
 * Get batch stats for a campaign
 */
CampaignBatchSchema.statics.getCampaignBatchStats = async function(campaignId) {
  const stats = await this.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(campaignId) } },
    {
      $group: {
        _id: null,
        totalBatches: { $sum: 1 },
        completedBatches: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
        failedBatches: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        processingBatches: { $sum: { $cond: [{ $eq: ['$status', 'PROCESSING'] }, 1, 0] } },
        pendingBatches: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        totalSent: { $sum: '$stats.sent' },
        totalDelivered: { $sum: '$stats.delivered' },
        totalRead: { $sum: '$stats.read' },
        totalFailed: { $sum: '$stats.failed' }
      }
    }
  ]);
  
  return stats[0] || {
    totalBatches: 0,
    completedBatches: 0,
    failedBatches: 0,
    processingBatches: 0,
    pendingBatches: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalFailed: 0
  };
};

module.exports = mongoose.model('CampaignBatch', CampaignBatchSchema);
