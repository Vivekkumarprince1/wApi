const mongoose = require('mongoose');

/**
 * AutomationRule (Workflow) Model
 * Defines workflow triggers, conditions, and actions
 */
const AutomationRuleSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  description: { type: String },
  
  // Trigger configuration
  trigger: { 
    type: String, 
    enum: ['message_received', 'status_updated', 'campaign_completed', 'keyword', 'tag_added', 'ad_lead'], 
    required: true 
  },
  
  // Trigger conditions (flexible JSON object)
  condition: { 
    type: Object, 
    default: {},
    // Examples:
    // { type: 'keyword', keywords: ['help', 'support'] }
    // { type: 'tag', tags: ['vip', 'premium'] }
    // { type: 'ad_source', adIds: ['123', '456'] }
    // { type: 'message_type', messageTypes: ['text', 'image'] }
  },
  
  // Actions to execute (array of action objects)
  actions: { 
    type: Array, 
    default: [],
    // Examples:
    // [
    //   { type: 'send_template', templateId: '...', params: {} },
    //   { type: 'delay', duration: 3600 },
    //   { type: 'assign_agent', agentId: '...' },
    //   { type: 'add_tag', tag: 'qualified-lead' },
    //   { type: 'remove_tag', tag: 'cold-lead' },
    //   { type: 'webhook', url: 'https://...' }
    // ]
  },
  
  // Status
  enabled: { type: Boolean, default: true },
  
  // Stats
  executionCount: { type: Number, default: 0 },
  lastExecutedAt: { type: Date },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  
  // Daily execution limits (for plan enforcement)
  dailyExecutionLimit: { type: Number }, // null = unlimited
  dailyExecutionCount: { type: Number, default: 0 },
  dailyExecutionResetAt: { type: Date },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
AutomationRuleSchema.index({ workspace: 1, enabled: 1 });
AutomationRuleSchema.index({ workspace: 1, trigger: 1, enabled: 1 });

// Update timestamp on save
AutomationRuleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AutomationRule', AutomationRuleSchema);

