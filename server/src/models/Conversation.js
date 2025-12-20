const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  
  // Channel info
  channel: { type: String, default: 'whatsapp' },
  
  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Status
  status: { 
    type: String, 
    enum: ['open', 'pending', 'resolved', 'closed'], 
    default: 'open' 
  },
  
  // Unread count for agents
  unreadCount: { type: Number, default: 0 },
  
  // Last message info for quick preview
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String },
  lastMessageDirection: { type: String, enum: ['inbound', 'outbound'] },
  
  // Activity tracking
  lastActivityAt: { type: Date, default: Date.now },
  
  // Tags for organization
  tags: [String],
  
  // Notes
  notes: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
ConversationSchema.index({ workspace: 1, contact: 1 }, { unique: true });
ConversationSchema.index({ workspace: 1, status: 1, lastActivityAt: -1 });
ConversationSchema.index({ workspace: 1, assignedTo: 1 });

// Update timestamp on save
ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Conversation', ConversationSchema);
