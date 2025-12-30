const mongoose = require('mongoose');

/**
 * AutoReply Model
 * Stores automatic reply configurations with keyword triggers
 */
const AutoReplySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  
  // Keywords that trigger this auto-reply
  keywords: {
    type: [String],
    required: true,
    validate: {
      validator: (v) => v && v.length > 0 && v.length <= 10,
      message: 'Keywords must be between 1 and 10'
    }
  },
  
  // Keyword matching mode
  matchMode: {
    type: String,
    enum: ['contains', 'exact', 'starts_with'],
    default: 'contains'
  },
  
  // Template to send (must be APPROVED)
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    required: true
  },
  
  // Denormalized template name for display
  templateName: String,
  
  // Status
  enabled: {
    type: Boolean,
    default: true
  },
  
  // Statistics
  totalRepliesSent: {
    type: Number,
    default: 0
  },
  lastSentAt: Date,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for querying by workspace
AutoReplySchema.index({ workspace: 1 });

// Index for enabled auto-replies (for webhook filtering)
AutoReplySchema.index({ workspace: 1, enabled: 1 });

module.exports = mongoose.model('AutoReply', AutoReplySchema);
