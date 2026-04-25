const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource: {
    type: { type: String }, // contact, message, template, etc.
    id: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String }
  },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String },
  // TTL handled via schema.index below; no inline index to avoid duplicates
  createdAt: { type: Date, default: Date.now }
});

// TTL index - keep logs for 90 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound index for efficient querying
AuditLogSchema.index({ workspace: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
