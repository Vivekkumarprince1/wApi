const mongoose = require('mongoose');

/**
 * AutomationRule Model - Stage 6 Automation Engine
 * 
 * Defines automation rules that trigger actions based on events.
 * Follows Interakt automation semantics.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONDITION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const ConditionSchema = new mongoose.Schema({
  // Field to evaluate (e.g., 'contact.tags', 'conversation.status', 'message.content')
  field: {
    type: String,
    required: true
  },
  // Operator for comparison
  operator: {
    type: String,
    enum: [
      'equals',           // Exact match
      'not_equals',       // Not equal
      'contains',         // String contains / array includes
      'not_contains',     // String doesn't contain / array doesn't include
      'starts_with',      // String starts with
      'ends_with',        // String ends with
      'greater_than',     // Numeric comparison
      'less_than',        // Numeric comparison
      'is_empty',         // Field is null/undefined/empty
      'is_not_empty',     // Field has value
      'in',               // Value in array
      'not_in',           // Value not in array
      'matches_regex',    // Regex match
      'time_within',      // Within time window (hours)
      'day_of_week'       // Specific day(s)
    ],
    required: true
  },
  // Value to compare against
  value: {
    type: mongoose.Schema.Types.Mixed
  },
  // Logical grouping with other conditions
  logicalOperator: {
    type: String,
    enum: ['AND', 'OR'],
    default: 'AND'
  }
}, { _id: false });

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const TriggerSchema = new mongoose.Schema({
  // Event type that triggers this rule
  event: {
    type: String,
    enum: [
      // Legacy triggers (keep for backwards compat)
      'message_received', 'status_updated', 'campaign_completed', 'keyword', 'tag_added', 'ad_lead',
      // Stage 6 triggers
      'conversation.created',        // New conversation started
      'customer.message.received',   // Customer sends a message
      'first.agent.reply',           // Agent sends first reply
      'conversation.closed',         // Conversation marked closed
      'conversation.reopened',       // Conversation reopened
      'sla.breached',                // SLA breach detected
      'contact.created',             // New contact created
      'contact.updated',             // Contact updated
      'contact.tag.added',           // Tag added to contact
      'conversation.assigned',       // Conversation assigned to agent
      'conversation.unassigned',     // Conversation unassigned
      'deal.stage.changed',          // Deal moved to new stage
      'campaign.message.delivered',  // Campaign message delivered
      'campaign.message.read',       // Campaign message read
      'campaign.message.replied'     // Customer replied to campaign
    ],
    required: true
  },
  // Optional filters for the trigger (pre-condition filtering)
  filters: {
    // Only trigger for specific channels
    channel: {
      type: String,
      enum: ['whatsapp', 'instagram', 'all'],
      default: 'all'
    },
    // Only trigger for specific message types
    messageTypes: [{
      type: String,
      enum: ['text', 'image', 'document', 'audio', 'video', 'location', 'contact', 'interactive', 'button', 'order']
    }],
    // Keyword filters (any match)
    keywords: [String],
    // Tag filters (contact must have these tags)
    requiredTags: [String],
    // Exclude contacts with these tags
    excludeTags: [String],
    // Source filter
    source: {
      type: String,
      enum: ['organic', 'campaign', 'ads', 'api', 'all'],
      default: 'all'
    },
    // Business hours only
    businessHoursOnly: {
      type: Boolean,
      default: false
    }
  }
}, { _id: false });

// ═══════════════════════════════════════════════════════════════════════════
// ACTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const ActionSchema = new mongoose.Schema({
  // Type of action to execute
  type: {
    type: String,
    enum: [
      // Legacy action types
      'send_template', 'delay', 'assign_agent', 'add_tag', 'remove_tag', 'webhook',
      // Stage 6 action types
      'send_template_message',   // Send a template (any time)
      'send_text_message',       // Send text (24h window only)
      'send_media_message',      // Send media (24h window only)
      'assign_conversation',     // Assign to agent/team
      'move_pipeline_stage',     // Move deal to stage
      'create_deal',             // Create a deal for contact
      'notify_agent',            // Send notification to agent
      'notify_webhook',          // Send webhook notification
      'update_contact',          // Update contact fields
      'add_note',                // Add internal note
      'close_conversation',      // Close the conversation
      'mark_as_resolved'         // Mark conversation resolved
    ],
    required: true
  },
  // Action-specific configuration
  config: {
    // For send_template_message / send_template
    templateId: mongoose.Schema.Types.ObjectId,
    templateName: String,
    templateLanguage: String,
    templateVariables: mongoose.Schema.Types.Mixed,
    params: mongoose.Schema.Types.Mixed, // Legacy
    
    // For send_text_message / send_media_message
    messageContent: String,
    mediaUrl: String,
    mediaType: String,
    
    // For assign_conversation / assign_agent
    assignTo: {
      type: {
        type: String,
        enum: ['agent', 'team', 'round_robin', 'least_busy']
      },
      agentId: mongoose.Schema.Types.ObjectId,
      teamId: mongoose.Schema.Types.ObjectId
    },
    agentId: mongoose.Schema.Types.ObjectId, // Legacy
    
    // For add_tag / remove_tag
    tagName: String,
    tagId: mongoose.Schema.Types.ObjectId,
    tag: String, // Legacy
    
    // For move_pipeline_stage / create_deal
    pipelineId: mongoose.Schema.Types.ObjectId,
    stageId: String,
    dealTitle: String,
    dealValue: Number,
    
    // For notify_agent
    notificationTitle: String,
    notificationBody: String,
    notifyAgentId: mongoose.Schema.Types.ObjectId,
    
    // For notify_webhook / webhook
    webhookUrl: String,
    url: String, // Legacy
    webhookHeaders: mongoose.Schema.Types.Mixed,
    
    // For update_contact
    contactUpdates: mongoose.Schema.Types.Mixed,
    
    // For add_note
    noteContent: String,
    
    // For delay
    delaySeconds: Number,
    delayMinutes: Number,
    delayHours: Number,
    duration: Number // Legacy (seconds)
  },
  // Order of execution (lower = first)
  order: {
    type: Number,
    default: 0
  },
  // Continue on failure?
  continueOnFailure: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMIT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const RateLimitSchema = new mongoose.Schema({
  // Maximum executions per time window
  maxExecutions: {
    type: Number,
    default: 100
  },
  // Time window in seconds
  windowSeconds: {
    type: Number,
    default: 3600 // 1 hour
  },
  // Per-contact cooldown (seconds before same contact triggers again)
  perContactCooldown: {
    type: Number,
    default: 300 // 5 minutes
  },
  // Per-conversation cooldown
  perConversationCooldown: {
    type: Number,
    default: 60 // 1 minute
  },
  // Max executions per contact per day
  maxPerContactPerDay: {
    type: Number,
    default: 10
  }
}, { _id: false });

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const AutomationRuleSchema = new mongoose.Schema({
  // Workspace this rule belongs to
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true
  },
  
  // Rule name
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Description
  description: { 
    type: String,
    maxlength: 500
  },
  
  // Is rule enabled?
  enabled: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
  // Priority (higher = evaluated first)
  priority: {
    type: Number,
    default: 0
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // TRIGGER (Stage 6 - structured)
  // ─────────────────────────────────────────────────────────────────────────
  trigger: TriggerSchema,
  
  // Legacy trigger field (for backwards compatibility)
  legacyTrigger: { 
    type: String, 
    enum: ['message_received', 'status_updated', 'campaign_completed', 'keyword', 'tag_added', 'ad_lead']
  },
  
  // Legacy condition (flexible JSON object)
  condition: { 
    type: Object, 
    default: {}
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // CONDITIONS (Stage 6 - array of structured conditions)
  // ─────────────────────────────────────────────────────────────────────────
  conditions: [ConditionSchema],
  
  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  actions: { 
    type: [ActionSchema], 
    default: [],
    validate: [arr => arr.length > 0, 'At least one action is required']
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // RATE LIMITING (Stage 6)
  // ─────────────────────────────────────────────────────────────────────────
  rateLimit: {
    type: RateLimitSchema,
    default: () => ({})
  },
  
  // Current window execution count (for rate limiting)
  currentWindowCount: {
    type: Number,
    default: 0
  },
  currentWindowStart: {
    type: Date
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATISTICS
  // ─────────────────────────────────────────────────────────────────────────
  stats: {
    totalExecutions: { type: Number, default: 0 },
    successfulExecutions: { type: Number, default: 0 },
    failedExecutions: { type: Number, default: 0 },
    skippedExecutions: { type: Number, default: 0 },
    lastExecutedAt: Date,
    lastSuccessAt: Date,
    lastFailureAt: Date
  },
  
  // Legacy stats (keep for backwards compat)
  executionCount: { type: Number, default: 0 },
  lastExecutedAt: { type: Date },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  
  // Daily execution limits (for plan enforcement)
  dailyExecutionLimit: { type: Number }, // null = unlimited
  dailyExecutionCount: { type: Number, default: 0 },
  dailyExecutionResetAt: { type: Date },
  
  // Soft delete
  deletedAt: Date,
  
  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════════════

// Fast lookup of enabled rules by workspace and trigger event
AutomationRuleSchema.index({ 
  workspace: 1, 
  enabled: 1, 
  'trigger.event': 1,
  deletedAt: 1 
});

// Priority ordering
AutomationRuleSchema.index({ workspace: 1, priority: -1 });

// Legacy index
AutomationRuleSchema.index({ workspace: 1, legacyTrigger: 1, enabled: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find all enabled rules for a workspace and event type
 */
AutomationRuleSchema.statics.findEnabledRulesForEvent = async function(workspaceId, eventType) {
  // Check both new trigger.event and legacy trigger
  return this.find({
    workspace: workspaceId,
    enabled: true,
    deletedAt: null,
    $or: [
      { 'trigger.event': eventType },
      { legacyTrigger: eventType }
    ]
  }).sort({ priority: -1 });
};

/**
 * Increment execution stats
 */
AutomationRuleSchema.statics.recordExecution = async function(ruleId, status) {
  const updates = {
    $inc: { 
      'stats.totalExecutions': 1,
      executionCount: 1,
      currentWindowCount: 1
    },
    $set: { 
      'stats.lastExecutedAt': new Date(),
      lastExecutedAt: new Date()
    }
  };
  
  if (status === 'SUCCESS') {
    updates.$inc['stats.successfulExecutions'] = 1;
    updates.$inc.successCount = 1;
    updates.$set['stats.lastSuccessAt'] = new Date();
  } else if (status === 'FAILED') {
    updates.$inc['stats.failedExecutions'] = 1;
    updates.$inc.failureCount = 1;
    updates.$set['stats.lastFailureAt'] = new Date();
  } else if (status === 'SKIPPED') {
    updates.$inc['stats.skippedExecutions'] = 1;
  }
  
  return this.findByIdAndUpdate(ruleId, updates, { new: true });
};

/**
 * Reset rate limit window if expired
 */
AutomationRuleSchema.statics.checkAndResetWindow = async function(ruleId) {
  const rule = await this.findById(ruleId);
  if (!rule) return null;
  
  const windowSeconds = rule.rateLimit?.windowSeconds || 3600;
  const windowStart = rule.currentWindowStart;
  
  if (!windowStart || (Date.now() - windowStart.getTime()) > (windowSeconds * 1000)) {
    // Reset window
    return this.findByIdAndUpdate(ruleId, {
      $set: {
        currentWindowCount: 0,
        currentWindowStart: new Date()
      }
    }, { new: true });
  }
  
  return rule;
};

/**
 * Reset daily execution counts
 */
AutomationRuleSchema.statics.resetDailyCountsIfNeeded = async function(ruleId) {
  const rule = await this.findById(ruleId);
  if (!rule) return null;
  
  const resetAt = rule.dailyExecutionResetAt;
  const now = new Date();
  
  if (!resetAt || now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000) {
    return this.findByIdAndUpdate(ruleId, {
      $set: {
        dailyExecutionCount: 0,
        dailyExecutionResetAt: now
      }
    }, { new: true });
  }
  
  return rule;
};

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if rule is within rate limits
 */
AutomationRuleSchema.methods.isWithinRateLimit = function() {
  const maxExecutions = this.rateLimit?.maxExecutions || 100;
  return this.currentWindowCount < maxExecutions;
};

/**
 * Check if within daily limit
 */
AutomationRuleSchema.methods.isWithinDailyLimit = function() {
  if (!this.dailyExecutionLimit) return true; // No limit
  return this.dailyExecutionCount < this.dailyExecutionLimit;
};

/**
 * Get sorted actions
 */
AutomationRuleSchema.methods.getSortedActions = function() {
  return [...this.actions].sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Get the effective trigger event (handles legacy)
 */
AutomationRuleSchema.methods.getEffectiveTriggerEvent = function() {
  return this.trigger?.event || this.legacyTrigger;
};

module.exports = mongoose.model('AutomationRule', AutomationRuleSchema);

