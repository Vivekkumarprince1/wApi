/**
 * InternalNote Model - Stage 4 Hardening
 * 
 * Internal notes visible only to agents, NOT sent to Meta/customer.
 * Stored separately from customer messages for clear separation.
 */

const mongoose = require('mongoose');

const InternalNoteSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true
  },
  conversation: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Conversation', 
    required: true,
    index: true
  },
  contact: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contact', 
    required: true 
  },
  
  // Note content
  content: { 
    type: String, 
    required: true,
    maxlength: 5000
  },
  
  // Who created the note
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Optional: mention other agents
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Optional: attach to specific message for context
  referencedMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
InternalNoteSchema.index({ conversation: 1, createdAt: -1 });
InternalNoteSchema.index({ workspace: 1, contact: 1, createdAt: -1 });
InternalNoteSchema.index({ workspace: 1, createdBy: 1 });

// Pre-save
InternalNoteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Get notes for a conversation
 */
InternalNoteSchema.statics.getForConversation = async function(conversationId, options = {}) {
  const { page = 1, limit = 50 } = options;
  
  return this.find({
    conversation: conversationId,
    isDeleted: false
  })
    .populate('createdBy', 'name email')
    .populate('mentions', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('InternalNote', InternalNoteSchema);
