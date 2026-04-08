const mongoose = require('mongoose');

/**
 * AiIntentMatchLog Model - Smart Selection Tracking
 * 
 * Records each time the AI Intent Match layer resolves a query 
 * into a specific automation rule as a fallback.
 */

const AiIntentMatchLogSchema = new mongoose.Schema({
  // Workspace this log belongs to
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true
  },
  
  // Original customer query
  queryText: { 
    type: String, 
    required: true
  },
  
  // Rule that the AI selected as the best match
  matchedRule: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AutomationRule',
    required: true
  },
  
  // Confidence score from the LLM (0-1)
  confidence: { 
    type: Number,
    default: 1.0
  },
  
  // Conversation context
  conversation: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Conversation'
  },
  
  // Contact ID
  contact: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contact'
  },
  
  // Metadata from AI response
  aiMetadata: {
    model: String,
    intentDetected: String,
    reasoning: String
  }
}, { 
  timestamps: true 
});

// Fast lookup for reports
AiIntentMatchLogSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('AiIntentMatchLog', AiIntentMatchLogSchema);
