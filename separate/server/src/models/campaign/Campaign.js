const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN MODEL - Stage 3 Implementation
 * 
 * Full campaign lifecycle management following Interakt's production architecture:
 * - Status: DRAFT → SCHEDULED → RUNNING → PAUSED/COMPLETED/FAILED
 * - Batch processing with chunking
 * - Real-time delivery tracking
 * - Failure safety and auto-pause
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const CampaignSchema = new mongoose.Schema({
  // ─────────────────────────────────────────────────────────────────────────────
  // WORKSPACE & TEMPLATE REFERENCES
  // ─────────────────────────────────────────────────────────────────────────────
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true
  },
  name: { type: String, required: true },
  description: { type: String },
  
  // ✅ Campaign type: one-time or scheduled
  campaignType: { 
    type: String, 
    enum: ['one-time', 'scheduled'], 
    default: 'one-time' 
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATE REFERENCE (Must be APPROVED)
  // ─────────────────────────────────────────────────────────────────────────────
  template: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Template',
    required: true // Stage 3: Template is required for campaigns
  },
  templateSnapshot: {
    name: { type: String },
    category: { type: String },
    language: { type: String },
    variables: [String],
    headerType: { type: String },
    bodyText: { type: String }
  },
  
  // Deprecated - kept for backwards compatibility
  message: { type: String },
  messageTemplate: { type: String },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // VARIABLE MAPPING (templateVar → contactField)
  // ─────────────────────────────────────────────────────────────────────────────
  variableMapping: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RECIPIENTS (Static list or filter-based)
  // ─────────────────────────────────────────────────────────────────────────────
  contacts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contact' 
  }],
  
  // ✅ Dynamic recipient filtering (alternative to static contacts list)
  recipientFilter: {
    type: { type: String, enum: ['all', 'tags', 'custom', 'segment'] },
    tags: [String],
    segmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment' },
    customFilter: { type: mongoose.Schema.Types.Mixed } // MongoDB query object
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CAMPAIGN STATUS (Interakt-style lifecycle)
  // ─────────────────────────────────────────────────────────────────────────────
  status: { 
    type: String, 
    enum: ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED',
           // Legacy statuses for backwards compatibility
           'draft', 'queued', 'sending', 'completed', 'paused', 'failed'], 
    default: 'DRAFT',
    index: true
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SCHEDULING & TIMING
  // ─────────────────────────────────────────────────────────────────────────────
  scheduledAt: { type: Date },           // When campaign is scheduled to start
  startedAt: { type: Date },             // When execution actually began
  completedAt: { type: Date },           // When campaign finished (success or partial)
  
  // Legacy field for backwards compatibility
  scheduleAt: { type: Date },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DELIVERY TOTALS (Updated via webhook rollups)
  // ─────────────────────────────────────────────────────────────────────────────
  totals: {
    totalRecipients: { type: Number, default: 0 },
    queued: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    replied: { type: Number, default: 0 }
  },
  
  // Legacy stats fields for backwards compatibility
  totalContacts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  repliedCount: { type: Number, default: 0 },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BATCH PROCESSING TRACKING
  // ─────────────────────────────────────────────────────────────────────────────
  batching: {
    totalBatches: { type: Number, default: 0 },
    completedBatches: { type: Number, default: 0 },
    failedBatches: { type: Number, default: 0 },
    currentBatchIndex: { type: Number, default: 0 },
    batchSize: { type: Number, default: 50 },
    lastBatchProcessedAt: { type: Date }
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PAUSE & FAILURE HANDLING
  // ─────────────────────────────────────────────────────────────────────────────
  pausedReason: { 
    type: String, 
    enum: [
      null,
      'USER_PAUSED',           // Manual pause by user
      'LIMIT_REACHED',         // Daily/monthly limit reached
      'TEMPLATE_REVOKED',      // Template no longer approved
      'ACCOUNT_BLOCKED',       // WABA account blocked
      'ACCOUNT_DISABLED',      // WABA account disabled
      'TOKEN_EXPIRED',         // Access token expired
      'CAPABILITY_REVOKED',    // Messaging capability revoked
      'HIGH_FAILURE_RATE',     // Too many failures (>30%)
      'RATE_LIMITED',          // Meta rate limit hit repeatedly
      'PHONE_DISCONNECTED'     // Phone number disconnected
    ],
    default: null 
  },
  pausedAt: { type: Date, default: null },
  
  // Failure tracking for auto-pause
  failureTracking: {
    consecutiveFailures: { type: Number, default: 0 },
    failureRate: { type: Number, default: 0 },
    lastFailureAt: { type: Date },
    lastFailureError: { type: String },
    metaErrorCodes: [String] // Track specific Meta error codes
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTION METADATA
  // ─────────────────────────────────────────────────────────────────────────────
  execution: {
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pausedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastResumedAt: { type: Date },
    resumeCount: { type: Number, default: 0 }
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIT METADATA (Task D - Traceability)
  // ─────────────────────────────────────────────────────────────────────────────
  audit: {
    // Who performed actions
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date },
    pausedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pausedAt: { type: Date },
    resumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resumedAt: { type: Date },
    
    // System-initiated pause tracking
    systemPaused: { type: Boolean, default: false },
    lastSystemPauseReason: { 
      type: String,
      enum: [
        null,
        'QUALITY_DEGRADED',        // WABA quality dropped to RED
        'TIER_DOWNGRADED',         // Messaging tier was downgraded
        'ENFORCEMENT_DETECTED',    // Meta enforcement action detected
        'HIGH_FAILURE_RATE',       // Auto-pause from failures
        'TOKEN_EXPIRED',           // Access token expired
        'ACCOUNT_BLOCKED',         // Account was blocked
        'KILL_SWITCH_ACTIVATED'    // Global kill-switch triggered
      ],
      default: null
    },
    lastSystemPauseAt: { type: Date },
    
    // Action history (lightweight audit trail)
    history: [{
      action: { 
        type: String, 
        enum: ['CREATED', 'STARTED', 'PAUSED', 'RESUMED', 'COMPLETED', 'FAILED', 'SYSTEM_PAUSED']
      },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date, default: Date.now },
      reason: { type: String },
      systemInitiated: { type: Boolean, default: false }
    }]
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIT FIELDS
  // ─────────────────────────────────────────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
CampaignSchema.index({ workspace: 1, status: 1 });
CampaignSchema.index({ workspace: 1, createdAt: -1 });
CampaignSchema.index({ workspace: 1, scheduledAt: 1, status: 1 }); // For scheduler
CampaignSchema.index({ status: 1, scheduledAt: 1 }); // For global scheduler queries

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

// Update timestamp on save
CampaignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Sync legacy fields with new totals
  if (this.isModified('totals')) {
    this.totalContacts = this.totals.totalRecipients || this.totalContacts;
    this.sentCount = this.totals.sent || this.sentCount;
    this.deliveredCount = this.totals.delivered || this.deliveredCount;
    this.failedCount = this.totals.failed || this.failedCount;
    this.readCount = this.totals.read || this.readCount;
    this.repliedCount = this.totals.replied || this.repliedCount;
  }
  
  // Normalize status to uppercase for consistency
  if (this.status && this.status === this.status.toLowerCase()) {
    const statusMap = {
      'draft': 'DRAFT',
      'queued': 'SCHEDULED',
      'sending': 'RUNNING',
      'completed': 'COMPLETED',
      'paused': 'PAUSED',
      'failed': 'FAILED'
    };
    if (statusMap[this.status]) {
      this.status = statusMap[this.status];
    }
  }
  
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if campaign can be started
 */
CampaignSchema.methods.canStart = function() {
  return ['DRAFT', 'SCHEDULED', 'draft'].includes(this.status);
};

/**
 * Check if campaign can be paused
 */
CampaignSchema.methods.canPause = function() {
  return ['RUNNING', 'sending', 'queued'].includes(this.status);
};

/**
 * Check if campaign can be resumed
 */
CampaignSchema.methods.canResume = function() {
  return ['PAUSED', 'paused'].includes(this.status);
};

/**
 * Get progress percentage
 */
CampaignSchema.methods.getProgress = function() {
  const total = this.totals?.totalRecipients || this.totalContacts || 0;
  if (total === 0) return 0;
  const processed = (this.totals?.sent || this.sentCount || 0) + 
                   (this.totals?.failed || this.failedCount || 0);
  return Math.round((processed / total) * 100);
};

/**
 * Get delivery rate (delivered / sent)
 */
CampaignSchema.methods.getDeliveryRate = function() {
  const sent = this.totals?.sent || this.sentCount || 0;
  if (sent === 0) return 0;
  const delivered = this.totals?.delivered || this.deliveredCount || 0;
  return Math.round((delivered / sent) * 100);
};

/**
 * Get read rate (read / delivered)
 */
CampaignSchema.methods.getReadRate = function() {
  const delivered = this.totals?.delivered || this.deliveredCount || 0;
  if (delivered === 0) return 0;
  const read = this.totals?.read || this.readCount || 0;
  return Math.round((read / delivered) * 100);
};

/**
 * Update totals atomically
 */
CampaignSchema.statics.incrementTotal = async function(campaignId, field, value = 1) {
  const updateField = `totals.${field}`;
  const legacyField = field === 'totalRecipients' ? 'totalContacts' : `${field}Count`;
  
  return this.findByIdAndUpdate(
    campaignId,
    {
      $inc: { 
        [updateField]: value,
        [legacyField]: value
      },
      $set: { updatedAt: new Date() }
    },
    { new: true }
  );
};

/**
 * Add audit history entry (Task D)
 */
CampaignSchema.statics.addAuditEntry = async function(campaignId, action, options = {}) {
  const { userId, reason, systemInitiated = false } = options;
  
  const entry = {
    action,
    at: new Date(),
    systemInitiated
  };
  
  if (userId) entry.by = userId;
  if (reason) entry.reason = reason;
  
  // Also update relevant audit timestamps
  const auditUpdates = {};
  
  switch (action) {
    case 'STARTED':
      auditUpdates['audit.startedBy'] = userId;
      auditUpdates['audit.startedAt'] = new Date();
      break;
    case 'PAUSED':
      auditUpdates['audit.pausedBy'] = userId;
      auditUpdates['audit.pausedAt'] = new Date();
      break;
    case 'RESUMED':
      auditUpdates['audit.resumedBy'] = userId;
      auditUpdates['audit.resumedAt'] = new Date();
      break;
    case 'SYSTEM_PAUSED':
      auditUpdates['audit.systemPaused'] = true;
      auditUpdates['audit.lastSystemPauseReason'] = reason;
      auditUpdates['audit.lastSystemPauseAt'] = new Date();
      break;
  }
  
  return this.findByIdAndUpdate(
    campaignId,
    {
      $push: { 'audit.history': { $each: [entry], $slice: -50 } }, // Keep last 50 entries
      $set: { ...auditUpdates, updatedAt: new Date() }
    },
    { new: true }
  );
};

/**
 * Mark campaign as system-paused (Task D & E)
 */
CampaignSchema.statics.systemPause = async function(campaignId, reason) {
  return this.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        status: 'PAUSED',
        pausedReason: reason,
        pausedAt: new Date(),
        'audit.systemPaused': true,
        'audit.lastSystemPauseReason': reason,
        'audit.lastSystemPauseAt': new Date(),
        updatedAt: new Date()
      },
      $push: {
        'audit.history': {
          $each: [{
            action: 'SYSTEM_PAUSED',
            at: new Date(),
            reason,
            systemInitiated: true
          }],
          $slice: -50
        }
      }
    },
    { new: true }
  );
};

module.exports = mongoose.model('Campaign', CampaignSchema);
