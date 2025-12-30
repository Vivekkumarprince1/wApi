const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  
  // ✅ Campaign type: one-time or scheduled
  campaignType: { type: String, enum: ['one-time', 'scheduled'], default: 'one-time' },
  
  // Message and template info
  message: { type: String }, // Message content with variables
  messageTemplate: { type: String }, // Template name if using template (deprecated)
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' }, // Reference to APPROVED Template model
  
  // ✅ Variable mapping: { "templateVar": "contactField" }
  variableMapping: { type: Object, default: {} }, // Maps template variables to contact fields
  
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  status: { type: String, enum: ['draft', 'queued', 'sending', 'completed', 'paused', 'failed'], default: 'draft' },
  
  // Stats
  totalContacts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  repliedCount: { type: Number, default: 0 },
  
  // ✅ Auto-pause tracking
  pausedReason: { type: String, default: null }, // null, LIMIT_REACHED, TEMPLATE_REVOKED, ACCOUNT_DISABLED, TOKEN_EXPIRED, CAPABILITY_REVOKED
  pausedAt: { type: Date, default: null },
  
  // Scheduling
  scheduleAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CampaignSchema.index({ workspace: 1, status: 1 });
CampaignSchema.index({ workspace: 1, createdAt: -1 });

// Update the updatedAt timestamp on save
CampaignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Campaign', CampaignSchema);
