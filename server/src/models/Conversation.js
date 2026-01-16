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

  // ====== WEEK 2: BILLING FIELDS ======
  conversationType: {
    type: String,
    enum: ['customer_initiated', 'business_initiated'],
    default: 'customer_initiated',
    // customer_initiated = billable conversation (paid)
    // business_initiated = may have different pricing
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  templateMessageCount: {
    type: Number,
    default: 0,
    // Messages sent using templates (paid on free tier)
  },
  freeMessageCount: {
    type: Number,
    default: 0,
    // Messages sent in free window after customer message
  },
  conversationStartedAt: {
    type: Date,
    default: Date.now,
    // Exact start time of this conversation window (for 24h tracking)
  },
  isBillable: {
    type: Boolean,
    default: true,
    // Whether this conversation should be counted for billing
  },
  // ====== END BILLING FIELDS ======
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
ConversationSchema.index({ workspace: 1, contact: 1 }, { unique: true });
ConversationSchema.index({ workspace: 1, status: 1, lastActivityAt: -1 });
ConversationSchema.index({ workspace: 1, assignedTo: 1 });
// Week 2: Billing-related indexes
ConversationSchema.index({ workspace: 1, conversationStartedAt: 1, isBillable: 1 });

// Update timestamp on save
ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Conversation', ConversationSchema);

