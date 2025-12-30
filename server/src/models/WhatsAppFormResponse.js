const mongoose = require('mongoose');

const WhatsAppFormResponseSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  form: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppForm',
    required: true,
    index: true
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  
  // User identification
  userPhone: {
    type: String,
    required: true,
    index: true
  },
  userName: String,
  userEmail: String,

  // Response data
  responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed  // Map question ID to answer
  },

  // Response metadata
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'abandoned', 'failed'],
    default: 'in_progress',
    index: true
  },
  
  currentStep: {
    type: Number,
    default: 0
  },
  totalSteps: Number,
  completedSteps: { type: Number, default: 0 },

  // Timing
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: Date,
  lastActivityAt: Date,
  timeSpent: Number,              // In seconds

  // Session tracking
  sessionId: {
    type: String,
    index: true
  },
  retryCount: { type: Number, default: 0 },
  abandonReason: String,

  // Lead conversion
  convertedToLead: { type: Boolean, default: false },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  
  // WhatsApp metadata
  messageIds: [String],           // WhatsApp message IDs in conversation
  conversationId: String,

  // Webhook/Tracking
  sourceType: String,             // 'whatsapp', 'qr_code', 'campaign', etc.
  sourceId: String,
  
  // Additional metadata
  tags: [String],
  notes: String,
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index for old abandoned sessions (90 days cleanup)
WhatsAppFormResponseSchema.index(
  { abandonedAt: 1 },
  { expireAfterSeconds: 7776000 }
);

// Compound indexes for common queries
WhatsAppFormResponseSchema.index({ workspace: 1, form: 1, status: 1 });
WhatsAppFormResponseSchema.index({ workspace: 1, userPhone: 1, form: 1 });
WhatsAppFormResponseSchema.index({ workspace: 1, convertedToLead: 1 });

module.exports = mongoose.model('WhatsAppFormResponse', WhatsAppFormResponseSchema);
