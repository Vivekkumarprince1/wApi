const mongoose = require('mongoose');

/**
 * AutoReplyLog Model
 * Tracks when auto-replies were sent to enforce 24-hour window
 */
const AutoReplyLogSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  
  // Which auto-reply was sent
  autoReply: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AutoReply',
    required: true
  },
  
  // Which contact received it
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  
  // Which message triggered it
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // When it was sent
  sentAt: {
    type: Date,
    default: Date.now
  }
});

// Index for 24-hour window lookup: workspace + contact + autoReply + sentAt
AutoReplyLogSchema.index({ workspace: 1, contact: 1, autoReply: 1, sentAt: -1 });

// Compound index for efficient queries
AutoReplyLogSchema.index({ autoReply: 1, contact: 1, sentAt: -1 });

// TTL index: automatically delete logs after 30 days (window management)
AutoReplyLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

module.exports = mongoose.model('AutoReplyLog', AutoReplyLogSchema);
