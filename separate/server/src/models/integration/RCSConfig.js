const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RCS CONFIGURATION MODEL
 * 
 * Stores credentials and settings for RCS providers (e.g., Jio, Gupshup RCS).
 * Each workspace can have one active RCS configuration.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const RCSConfigSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  provider: {
    type: String,
    enum: ['JIO', 'GUPSHUP', 'META_RCS'],
    default: 'JIO'
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'DISCONNECTED'],
    default: 'PENDING'
  },
  
  // Provider-specific credentials (encrypted in production)
  credentials: {
    apiKey: { type: String },
    apiSecret: { type: String },
    senderId: { type: String }, // RCS Agent ID
    endpoint: { type: String }
  },
  
  // Webhook for delivery status updates
  webhookUrl: { type: String },
  webhookSecret: { type: String },
  
  // Messaging capabilities
  capabilities: {
    richCard: { type: Boolean, default: true },
    carousel: { type: Boolean, default: true },
    suggestedReplies: { type: Boolean, default: true }
  },
  
  // Audit timestamps
  lastConnectedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

RCSConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('RCSConfig', RCSConfigSchema);
