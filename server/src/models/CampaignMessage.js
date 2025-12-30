const mongoose = require('mongoose');

// ✅ Tracks individual message sends in a campaign for idempotency & retry safety
const CampaignMessageSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  
  // Status lifecycle for idempotency
  status: { 
    type: String, 
    enum: ['queued', 'sending', 'sent', 'delivered', 'read', 'failed'], 
    default: 'queued' 
  },
  
  // Retry tracking
  attempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date },
  lastError: { type: String },
  
  // Meta tracking
  whatsappMessageId: { type: String }, // Message ID from WhatsApp
  
  // Webhook updates
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for fast lookups
CampaignMessageSchema.index({ campaign: 1, contact: 1 }, { unique: true }); // Prevent duplicate sends
CampaignMessageSchema.index({ campaign: 1, status: 1 });
CampaignMessageSchema.index({ message: 1 });
CampaignMessageSchema.index({ workspace: 1, createdAt: -1 });

// Update timestamp
CampaignMessageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CampaignMessage', CampaignMessageSchema);
