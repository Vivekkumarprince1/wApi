const mongoose = require('mongoose');

const WebhookLogSchema = new mongoose.Schema({
  // Source
  source: { type: String, default: 'meta' },
  
  // Workspace mapped from phone_number_id
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  
  // Raw payload
  payload: { type: Object, required: true },
  
  // Verification
  verified: { type: Boolean, default: false },
  signatureHeader: { type: String },
  
  // Processing status
  processed: { type: Boolean, default: false },
  processedAt: { type: Date },
  
  // Error tracking
  error: { type: String },
  
  // Event type extracted from payload
  eventType: { type: String }, // e.g., 'message', 'status', 'template_status'
  
  createdAt: { type: Date, default: Date.now }
});

// Index for querying
WebhookLogSchema.index({ workspace: 1, createdAt: -1 });
WebhookLogSchema.index({ processed: 1, createdAt: -1 });
WebhookLogSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model('WebhookLog', WebhookLogSchema);
