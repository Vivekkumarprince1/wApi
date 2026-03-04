const mongoose = require('mongoose');

/**
 * WorkflowExecution Model
 * Tracks each workflow execution for idempotency, debugging, and analytics
 */
const WorkflowExecutionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule', required: true },
  
  // Trigger event
  triggerEvent: {
    type: { type: String, enum: ['message_received', 'status_updated', 'campaign_completed', 'ad_lead'], required: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    adId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAd' },
    payload: { type: Object }, // Raw trigger data
  },
  
  // Idempotency key (prevents duplicate executions)
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  
  // Execution status
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
    default: 'pending'
  },
  
  // Actions executed
  actionsExecuted: [{
    type: { type: String }, // 'send_template', 'assign_agent', 'add_tag', 'remove_tag', 'delay'
    status: { type: String, enum: ['pending', 'completed', 'failed'] },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String },
    result: { type: Object }
  }],
  
  // Timing
  startedAt: { type: Date },
  completedAt: { type: Date },
  delayUntil: { type: Date }, // For delayed executions
  
  // Error tracking
  error: { type: String },
  errorStack: { type: String },
  
  // Metadata
  meta: { type: Object, default: {} },
  
  createdAt: { type: Date, default: Date.now }
});

// Indexes for querying
WorkflowExecutionSchema.index({ workspace: 1, createdAt: -1 });
WorkflowExecutionSchema.index({ workflow: 1, status: 1 });
WorkflowExecutionSchema.index({ status: 1, delayUntil: 1 }); // For delayed execution polling
WorkflowExecutionSchema.index({ workspace: 1, status: 1, createdAt: -1 }); // For analytics

module.exports = mongoose.model('WorkflowExecution', WorkflowExecutionSchema);
