const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: {
    type: String,
    enum: [
      'user.login', 'user.logout', 'user.created', 'user.updated', 'user.deleted',
      'contact.created', 'contact.updated', 'contact.deleted', 'contact.imported',
      'contact.opted_out', 'contact.opted_in', 'contact.manually_opted_out', 'contact.manually_opted_in',
      'message.sent', 'message.failed', 'message.delivered', 'message.read',
      'campaign.started', 'campaign.completed', 'campaign.paused',
      'template.created', 'template.submitted', 'template.approved', 'template.rejected', 'template.deleted',
      'settings.updated', 'team.member_added', 'team.member_removed', 'team.permissions_changed',
      'waba.connected', 'waba.disconnected', 'waba.verified', 'waba.disabled',
      'token.refreshed', 'token.expired', 'token.revoked',
      'webhook.received', 'webhook.failed'
    ],
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
