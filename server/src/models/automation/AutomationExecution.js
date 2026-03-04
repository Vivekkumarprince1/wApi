/**
 * AutomationExecution Model - Stage 6 Automation Engine
 * 
 * Logs every automation rule execution for audit and debugging.
 * Records success, skip, and failure reasons.
 */

const mongoose = require('mongoose');

// ═══════════════════════════════════════════════════════════════════════════
// ACTION RESULT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const ActionResultSchema = new mongoose.Schema({
  // Action type that was executed
  actionType: {
    type: String,
    required: true
  },
  // Action index in the rule's action array
  actionIndex: {
    type: Number,
    required: true
  },
  // Result status
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'SKIPPED'],
    required: true
  },
  // Error message if failed
  error: String,
  // Any output/result from the action
  result: mongoose.Schema.Types.Mixed,
  // Time taken to execute (ms)
  durationMs: Number,
  // Timestamp
  executedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const AutomationExecutionSchema = new mongoose.Schema({
  // Reference to the automation rule
  rule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AutomationRule',
    required: true,
    index: true
  },
  
  // Rule name snapshot (in case rule is deleted)
  ruleName: {
    type: String,
    required: true
  },
  
  // Workspace
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  // Trigger event that caused execution
  triggerEvent: {
    type: String,
    required: true
  },
  
  // Associated conversation (if any)
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    index: true
  },
  
  // Associated contact
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    index: true
  },
  
  // Associated message (if triggered by message)
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // EXECUTION STATUS
  // ─────────────────────────────────────────────────────────────────────────
  
  // Overall execution status
  status: {
    type: String,
    enum: ['SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED'],
    required: true,
    index: true
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // SKIP / FAILURE REASONS
  // ─────────────────────────────────────────────────────────────────────────
  
  // Reason if skipped
  skipReason: {
    type: String,
    enum: [
      'RATE_LIMIT_EXCEEDED',       // Rule rate limit hit
      'CONTACT_COOLDOWN',          // Contact recently triggered
      'CONVERSATION_COOLDOWN',     // Conversation recently triggered
      'DAILY_LIMIT_EXCEEDED',      // Daily execution limit
      'CONDITION_NOT_MET',         // Conditions evaluated to false
      'FILTER_NOT_MATCHED',        // Trigger filters not matched
      'LOOP_DETECTED',             // Same rule+conversation loop
      'WORKSPACE_DISABLED',        // Workspace automation disabled
      'GLOBAL_KILL_SWITCH',        // Global automation kill switch
      'OUTSIDE_BUSINESS_HOURS',    // Not in business hours
      'RULE_DISABLED',             // Rule was disabled during execution
      'NO_24H_WINDOW',             // No 24h window for session message
      'DRY_RUN'                    // Dry run test (no actions executed)
    ]
  },
  
  // Additional skip details
  skipDetails: String,
  
  // Failure reason if failed
  failureReason: {
    type: String,
    enum: [
      'ACTION_FAILED',             // One or more actions failed
      'TEMPLATE_NOT_FOUND',        // Template doesn't exist
      'TEMPLATE_NOT_APPROVED',     // Template not approved
      'INVALID_PHONE',             // Invalid phone number
      'WHATSAPP_API_ERROR',        // WhatsApp API returned error
      'PERMISSION_DENIED',         // No permission for action
      'RESOURCE_NOT_FOUND',        // Agent/pipeline/etc not found
      'INTERNAL_ERROR',            // Unexpected error
      'TIMEOUT'                    // Action timed out
    ]
  },
  
  // Failure details
  failureDetails: String,
  
  // ─────────────────────────────────────────────────────────────────────────
  // ACTION RESULTS
  // ─────────────────────────────────────────────────────────────────────────
  
  // Results of each action executed
  actionResults: [ActionResultSchema],
  
  // Number of actions executed
  actionsExecuted: {
    type: Number,
    default: 0
  },
  
  // Number of actions succeeded
  actionsSucceeded: {
    type: Number,
    default: 0
  },
  
  // Number of actions failed
  actionsFailed: {
    type: Number,
    default: 0
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT SNAPSHOT
  // ─────────────────────────────────────────────────────────────────────────
  
  // Snapshot of context at execution time (for debugging)
  contextSnapshot: {
    // Contact data at time of execution
    contact: {
      phone: String,
      name: String,
      tags: [String]
    },
    // Conversation data
    conversation: {
      status: String,
      assignedTo: mongoose.Schema.Types.ObjectId,
      source: String
    },
    // Trigger message data (if any)
    message: {
      type: String,
      content: String,
      direction: String
    },
    // Additional metadata
    metadata: mongoose.Schema.Types.Mixed
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // TIMING
  // ─────────────────────────────────────────────────────────────────────────
  
  // When execution started
  startedAt: {
    type: Date,
    default: Date.now
  },
  
  // When execution completed
  completedAt: Date,
  
  // Total duration (ms)
  durationMs: Number,
  
  // ─────────────────────────────────────────────────────────────────────────
  // FLAGS
  // ─────────────────────────────────────────────────────────────────────────
  
  // Was this a dry run?
  isDryRun: {
    type: Boolean,
    default: false
  },
  
  // Was this a manual test?
  isManualTest: {
    type: Boolean,
    default: false
  },
  
  // Triggered by user (for manual executions)
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════════════

// Fast lookup by workspace and date range
AutomationExecutionSchema.index({ workspace: 1, createdAt: -1 });

// Lookup by rule
AutomationExecutionSchema.index({ rule: 1, createdAt: -1 });

// Lookup by contact (for cooldown checks)
AutomationExecutionSchema.index({ workspace: 1, contact: 1, rule: 1, createdAt: -1 });

// Lookup by conversation (for loop detection)
AutomationExecutionSchema.index({ workspace: 1, conversation: 1, rule: 1, createdAt: -1 });

// Status filtering
AutomationExecutionSchema.index({ workspace: 1, status: 1, createdAt: -1 });

// TTL index - auto-delete after 90 days
AutomationExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ═══════════════════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if contact is in cooldown for a rule
 */
AutomationExecutionSchema.statics.isContactInCooldown = async function(
  ruleId, 
  contactId, 
  cooldownSeconds
) {
  const cooldownStart = new Date(Date.now() - cooldownSeconds * 1000);
  
  const recentExecution = await this.findOne({
    rule: ruleId,
    contact: contactId,
    status: { $in: ['SUCCESS', 'PARTIAL'] },
    createdAt: { $gte: cooldownStart }
  });
  
  return !!recentExecution;
};

/**
 * Check if conversation is in cooldown for a rule
 */
AutomationExecutionSchema.statics.isConversationInCooldown = async function(
  ruleId, 
  conversationId, 
  cooldownSeconds
) {
  const cooldownStart = new Date(Date.now() - cooldownSeconds * 1000);
  
  const recentExecution = await this.findOne({
    rule: ruleId,
    conversation: conversationId,
    status: { $in: ['SUCCESS', 'PARTIAL'] },
    createdAt: { $gte: cooldownStart }
  });
  
  return !!recentExecution;
};

/**
 * Count contact executions today for a rule
 */
AutomationExecutionSchema.statics.getContactDailyCount = async function(
  ruleId, 
  contactId
) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  return this.countDocuments({
    rule: ruleId,
    contact: contactId,
    status: { $in: ['SUCCESS', 'PARTIAL'] },
    createdAt: { $gte: todayStart }
  });
};

/**
 * Detect potential loop (same rule triggered for same conversation recently)
 */
AutomationExecutionSchema.statics.detectLoop = async function(
  ruleId, 
  conversationId, 
  windowSeconds = 10
) {
  const windowStart = new Date(Date.now() - windowSeconds * 1000);
  
  const recentCount = await this.countDocuments({
    rule: ruleId,
    conversation: conversationId,
    createdAt: { $gte: windowStart }
  });
  
  return recentCount >= 3; // 3+ executions in window = likely loop
};

/**
 * Get execution stats for a rule
 */
AutomationExecutionSchema.statics.getRuleStats = async function(ruleId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        rule: new mongoose.Types.ObjectId(ruleId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$durationMs' }
      }
    }
  ]);
  
  const result = {
    total: 0,
    success: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
    avgDurationMs: 0
  };
  
  for (const stat of stats) {
    result.total += stat.count;
    result[stat._id.toLowerCase()] = stat.count;
    if (stat.avgDuration) {
      result.avgDurationMs = stat.avgDuration;
    }
  }
  
  return result;
};

/**
 * Get skip reason breakdown
 */
AutomationExecutionSchema.statics.getSkipReasonBreakdown = async function(workspaceId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(workspaceId),
        status: 'SKIPPED',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$skipReason',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark execution as completed
 */
AutomationExecutionSchema.methods.complete = function(status, details = {}) {
  this.status = status;
  this.completedAt = new Date();
  this.durationMs = this.completedAt - this.startedAt;
  
  if (details.skipReason) {
    this.skipReason = details.skipReason;
    this.skipDetails = details.skipDetails;
  }
  
  if (details.failureReason) {
    this.failureReason = details.failureReason;
    this.failureDetails = details.failureDetails;
  }
  
  // Calculate action stats
  if (this.actionResults && this.actionResults.length > 0) {
    this.actionsExecuted = this.actionResults.length;
    this.actionsSucceeded = this.actionResults.filter(a => a.status === 'SUCCESS').length;
    this.actionsFailed = this.actionResults.filter(a => a.status === 'FAILED').length;
  }
  
  return this.save();
};

/**
 * Add action result
 */
AutomationExecutionSchema.methods.addActionResult = function(result) {
  this.actionResults.push({
    actionType: result.actionType,
    actionIndex: result.actionIndex,
    status: result.status,
    error: result.error,
    result: result.result,
    durationMs: result.durationMs,
    executedAt: new Date()
  });
};

module.exports = mongoose.model('AutomationExecution', AutomationExecutionSchema);
