/**
 * AutomationAuditLog Model - Stage 6
 * 
 * Tracks all automation rule executions for audit and debugging.
 * Stores execution logs, skipped reasons, failure reasons.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const automationAuditLogSchema = new Schema(
  {
    // Reference
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ruleId: { type: Schema.Types.ObjectId, ref: 'AutomationRule', required: true, index: true },
    executionId: { type: Schema.Types.ObjectId, ref: 'AutomationExecution', required: true },

    // Context
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },

    // Trigger information
    triggerType: {
      type: String,
      enum: [
        'conversation.created',
        'customer.message.received',
        'first.agent.reply',
        'conversation.closed',
        'sla.breached'
      ],
      required: true,
      index: true
    },
    triggerMetadata: Schema.Types.Mixed, // Raw trigger data

    // Execution details
    status: {
      type: String,
      enum: ['SUCCESS', 'SKIPPED', 'FAILED', 'PARTIAL'],
      required: true,
      index: true
    },

    // Reason for skipping or failing
    reason: String,
    errorMessage: String,

    // Actions executed
    actionsExecuted: [{
      actionType: String, // sendTemplateMessage, addTag, etc.
      status: { type: String, enum: ['SUCCESS', 'FAILED', 'SKIPPED'] },
      result: Schema.Types.Mixed,
      error: String,
      executedAt: Date,
      duration: Number // milliseconds
    }],

    // Conditions evaluated
    conditionsEvaluated: [{
      condition: Schema.Types.Mixed,
      result: Boolean,
      evaluatedAt: Date
    }],

    // Rate limiting info
    rateLimitApplied: Boolean,
    rateLimitReason: String,

    // Loop detection
    loopDetected: Boolean,
    loopReason: String,

    // Execution timing
    executedAt: { type: Date, default: Date.now, index: true },
    duration: Number, // milliseconds for entire execution

    // User info (if manually triggered)
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    manualTrigger: Boolean,

    // Retry info
    retryAttempt: { type: Number, default: 0 },
    retriedFromLogId: { type: Schema.Types.ObjectId, ref: 'AutomationAuditLog' },

    // Notes/comments
    notes: String,

    // TTL: Keep logs for 90 days
    expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }
  },
  {
    timestamps: true,
    collection: 'automationAuditLogs',
    indexes: [
      { workspaceId: 1, createdAt: -1 },
      { ruleId: 1, createdAt: -1 },
      { conversationId: 1, createdAt: -1 },
      { status: 1, createdAt: -1 },
      { triggerType: 1, createdAt: -1 },
      { expiresAt: 1 } // TTL index
    ]
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// Indexes
// ═══════════════════════════════════════════════════════════════════════════

automationAuditLogSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
automationAuditLogSchema.index({ ruleId: 1, status: 1, createdAt: -1 });
automationAuditLogSchema.index({ conversationId: 1, createdAt: -1 });
automationAuditLogSchema.index({ executedAt: -1 });

// ═══════════════════════════════════════════════════════════════════════════
// Statics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log an automation execution
 */
automationAuditLogSchema.statics.logExecution = async function(data) {
  try {
    const log = new this({
      workspaceId: data.workspaceId,
      ruleId: data.ruleId,
      executionId: data.executionId,
      conversationId: data.conversationId,
      contactId: data.contactId,
      triggerType: data.triggerType,
      triggerMetadata: data.triggerMetadata,
      status: data.status,
      reason: data.reason,
      errorMessage: data.errorMessage,
      actionsExecuted: data.actionsExecuted || [],
      conditionsEvaluated: data.conditionsEvaluated || [],
      rateLimitApplied: data.rateLimitApplied || false,
      rateLimitReason: data.rateLimitReason,
      loopDetected: data.loopDetected || false,
      loopReason: data.loopReason,
      duration: data.duration,
      triggeredBy: data.triggeredBy,
      manualTrigger: data.manualTrigger || false,
      notes: data.notes
    });

    await log.save();
    return log;
  } catch (error) {
    console.error('[AutomationAuditLog] Failed to log execution:', error);
    throw error;
  }
};

/**
 * Get logs for a workspace
 */
automationAuditLogSchema.statics.getLogs = async function(workspaceId, options = {}) {
  const {
    ruleId,
    conversationId,
    status,
    triggerType,
    startDate,
    endDate,
    page = 1,
    limit = 50,
    sortBy = 'executedAt'
  } = options;

  let query = { workspaceId };

  if (ruleId) query.ruleId = ruleId;
  if (conversationId) query.conversationId = conversationId;
  if (status) query.status = status;
  if (triggerType) query.triggerType = triggerType;

  if (startDate || endDate) {
    query.executedAt = {};
    if (startDate) query.executedAt.$gte = new Date(startDate);
    if (endDate) query.executedAt.$lte = new Date(endDate);
  }

  const total = await this.countDocuments(query);
  const logs = await this
    .find(query)
    .sort({ [sortBy]: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get execution summary stats
 */
automationAuditLogSchema.statics.getExecutionStats = async function(workspaceId, options = {}) {
  const { ruleId, days = 7 } = options;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let pipeline = [
    {
      $match: {
        workspaceId: mongoose.Types.ObjectId(workspaceId),
        executedAt: { $gte: startDate }
      }
    }
  ];

  if (ruleId) {
    pipeline[0].$match.ruleId = mongoose.Types.ObjectId(ruleId);
  }

  pipeline.push({
    $group: {
      _id: '$status',
      count: { $sum: 1 },
      avgDuration: { $avg: '$duration' },
      maxDuration: { $max: '$duration' },
      minDuration: { $min: '$duration' }
    }
  });

  const stats = await this.aggregate(pipeline);

  return {
    period: { startDate, endDate: new Date(), days },
    byStatus: stats.reduce((acc, s) => {
      acc[s._id] = {
        count: s.count,
        avgDuration: Math.round(s.avgDuration || 0),
        maxDuration: s.maxDuration,
        minDuration: s.minDuration
      };
      return acc;
    }, {})
  };
};

/**
 * Get failure analysis
 */
automationAuditLogSchema.statics.getFailureAnalysis = async function(workspaceId, options = {}) {
  const { ruleId, days = 7 } = options;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = {
    workspaceId,
    status: { $in: ['FAILED', 'PARTIAL'] },
    executedAt: { $gte: startDate }
  };

  if (ruleId) query.ruleId = ruleId;

  const failures = await this.find(query).lean();

  const analysis = {
    totalFailures: failures.length,
    byReason: {},
    byErrorMessage: {},
    recentFailures: failures.slice(0, 10)
  };

  for (const failure of failures) {
    if (failure.reason) {
      analysis.byReason[failure.reason] = (analysis.byReason[failure.reason] || 0) + 1;
    }
    if (failure.errorMessage) {
      analysis.byErrorMessage[failure.errorMessage] = (analysis.byErrorMessage[failure.errorMessage] || 0) + 1;
    }
  }

  return analysis;
};

module.exports = mongoose.model('AutomationAuditLog', automationAuditLogSchema);
