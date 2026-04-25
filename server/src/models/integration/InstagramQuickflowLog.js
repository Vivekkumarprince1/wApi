const mongoose = require('mongoose');

const InstagramQuickflowLogSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true
  },
  
  quickflow: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'InstagramQuickflow', 
    required: true,
    index: true
  },
  
  // Contact/User info from Instagram
  instagramUserId: { 
    type: String, 
    required: true 
  },
  
  instagramUsername: { 
    type: String 
  },
  
  // Trigger details
  triggerType: {
    type: String,
    enum: ['comment', 'dm', 'story_reply', 'mention']
  },
  
  triggerPostId: { 
    type: String 
  },
  
  triggerMessageId: { 
    type: String 
  },
  
  triggerContent: { 
    type: String 
  },
  
  // Response details
  responseSent: { 
    type: Boolean, 
    default: false 
  },
  
  responseContent: { 
    type: String 
  },
  
  responseId: { 
    type: String 
  },
  
  // WhatsApp redirect
  whatsappRedirected: { 
    type: Boolean, 
    default: false 
  },
  
  whatsappPhoneNumber: { 
    type: String 
  },
  
  // Tracking
  triggeredAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  
  replySentAt: { 
    type: Date 
  },
  
  // TTL for 30-day cleanup
  expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
  }
});

// TTL index for automatic cleanup after 30 days
InstagramQuickflowLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Indexes for 24h window lookup
InstagramQuickflowLogSchema.index({ 
  workspace: 1, 
  quickflow: 1, 
  instagramUserId: 1,
  triggeredAt: -1
});

module.exports = mongoose.model('InstagramQuickflowLog', InstagramQuickflowLogSchema);
