const mongoose = require('mongoose');

const CampaignSummarySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  date: { type: Date, required: true }, // YYYY-MM-DD (normalized to midnight)
  
  // Aggregated metrics for the day
  campaignsInitiated: { type: Number, default: 0 },
  messagesSent: { type: Number, default: 0 },
  messagesDelivered: { type: Number, default: 0 },
  messagesRead: { type: Number, default: 0 },
  messagesFailed: { type: Number, default: 0 },
  
  // Cost tracking (optional)
  estimatedCost: { type: Number, default: 0 },
  
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for fast lookup
CampaignSummarySchema.index({ workspace: 1, date: -1 }, { unique: true });

CampaignSummarySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CampaignSummary', CampaignSummarySchema);
