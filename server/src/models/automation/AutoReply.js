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
    default: [],
    validate: {
      validator: function(v) {
        if (this.triggerType === 'keyword') {
          return v && v.length > 0 && v.length <= 10;
        }
        return true;
      },
      message: 'Keywords are required for keyword-based auto-replies (max 10)'
    }
  },
  
  // Keyword matching mode
  matchMode: {
    type: String,
    enum: ['contains', 'exact', 'starts_with'],
    default: 'contains'
  },

  // Trigger type: always, outside_business_hours, specific_time
  triggerType: {
    type: String,
    enum: ['keyword', 'always', 'outside_business_hours'],
    default: 'keyword'
  },

  // Business hours reference if needed (can use workspace defaults)
  useWorkspaceBusinessHours: {
    type: Boolean,
    default: true
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
