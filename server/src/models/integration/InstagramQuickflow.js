const mongoose = require('mongoose');

const InstagramQuickflowSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true
  },
  
  // Quickflow name & type
  name: { 
    type: String, 
    required: true 
  },
  
  type: { 
    type: String, 
    enum: ['price_please', 'giveaway', 'lead_gen', 'story_auto_reply', 'custom'],
    required: true,
    index: true
  },
  
  // Trigger configuration
  triggerType: {
    type: String,
    enum: ['comment', 'dm', 'story_reply', 'mention'],
    required: true
  },
  
  // Keywords that trigger this quickflow
  keywords: [{ 
    type: String,
    lowercase: true
  }],
  
  // Match mode for keyword matching
  matchMode: {
    type: String,
    enum: ['contains', 'exact', 'starts_with'],
    default: 'contains'
  },
  
  // Response configuration
  response: {
    // Message to send as first reply
    message: { type: String },
    
    // Optional template to use
    template: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Template'
    },
    
    // Optional redirect to WhatsApp
    redirectToWhatsApp: {
      enabled: { type: Boolean, default: false },
      message: { type: String }
    }
  },
  
  // Status
  enabled: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
  // Statistics
  totalTriggered: { 
    type: Number, 
    default: 0 
  },
  
  totalRepliesSent: { 
    type: Number, 
    default: 0 
  },
  
  lastTriggeredAt: { 
    type: Date 
  },
  
  lastReplySentAt: { 
    type: Date 
  },
  
  // Rate limiting (24h window per contact)
  rateLimitEnabled: {
    type: Boolean,
    default: true
  },
  
  rateLimitWindow: {
    type: Number,
    default: 24 // hours
  },
  
  // Metadata
  preset: {
    type: Boolean,
    default: false
  },
  
  presetName: {
    type: String,
    enum: ['price_please', 'giveaway', 'lead_gen', 'story_auto_reply']
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes
InstagramQuickflowSchema.index({ workspace: 1, enabled: 1 });
InstagramQuickflowSchema.index({ workspace: 1, type: 1 });
InstagramQuickflowSchema.index({ workspace: 1, triggerType: 1 });

module.exports = mongoose.model('InstagramQuickflow', InstagramQuickflowSchema);
