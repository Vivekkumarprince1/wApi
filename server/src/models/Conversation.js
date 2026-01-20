const mongoose = require('mongoose');

/**
 * Conversation Schema - Stage 4 Enhanced
 * Supports Shared Inbox with Agent Assignment & Per-Agent Unread Tracking
 */

const ConversationSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  
  // Channel info
  channel: { type: String, default: 'whatsapp' },
  
  // ====== STAGE 4: ENHANCED ASSIGNMENT ======
  // Primary assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  
  // Assignment history for audit trail
  assignmentHistory: [{
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
    action: { type: String, enum: ['assigned', 'unassigned', 'reassigned'] }
  }],
  
  // Who last replied to this conversation (agent)
  lastRepliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastAgentReplyAt: { type: Date },
  
  // Status (enhanced)
  status: { 
    type: String, 
    enum: ['open', 'pending', 'resolved', 'closed', 'snoozed'], 
    default: 'open' 
  },
  statusChangedAt: { type: Date, default: Date.now },
  statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Snooze support
  snoozedUntil: { type: Date },
  
  // Priority for inbox sorting
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  // ====== END STAGE 4: ASSIGNMENT ======
  
  // ====== STAGE 4: PER-AGENT UNREAD TRACKING ======
  // Global unread count (for dashboard stats)
  unreadCount: { type: Number, default: 0 },
  
  // Per-agent unread counts (Map of agentId -> unreadCount)
  // This allows each agent to have their own unread state
  agentUnreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  // Track which agents have viewed this conversation
  viewedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now }
  }],
  // ====== END STAGE 4: UNREAD TRACKING ======
  
  // Last message info for quick preview
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String },
  lastMessageDirection: { type: String, enum: ['inbound', 'outbound'] },
  lastMessageType: { type: String }, // text, image, template, etc.
  
  // First response tracking (for SLA)
  firstResponseAt: { type: Date },
  firstResponseBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // ====== STAGE 4 HARDENING: SLA TRACKING ======
  slaDeadline: { type: Date },           // When first response is due
  slaBreached: { type: Boolean, default: false },
  slaBreachedAt: { type: Date },
  slaEscalatedAt: { type: Date },
  slaEscalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Soft lock for collision prevention
  softLock: {
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date },
    expiresAt: { type: Date }
  },
  // ====== END STAGE 4 HARDENING ======
  
  // Activity tracking
  lastActivityAt: { type: Date, default: Date.now },
  lastCustomerMessageAt: { type: Date },
  
  // Tags for organization
  tags: [String],
  
  // Notes
  notes: { type: String },

  // ====== WEEK 2: BILLING FIELDS ======
  conversationType: {
    type: String,
    enum: ['customer_initiated', 'business_initiated'],
    default: 'customer_initiated',
  },
  messageCount: { type: Number, default: 0 },
  templateMessageCount: { type: Number, default: 0 },
  freeMessageCount: { type: Number, default: 0 },
  conversationStartedAt: { type: Date, default: Date.now },
  isBillable: { type: Boolean, default: true },
  // ====== END BILLING FIELDS ======
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES - Optimized for Stage 4 Inbox Queries
// ═══════════════════════════════════════════════════════════════════════════

// Primary indexes
ConversationSchema.index({ workspace: 1, contact: 1 }, { unique: true });

// Inbox query indexes
ConversationSchema.index({ workspace: 1, status: 1, lastActivityAt: -1 });
ConversationSchema.index({ workspace: 1, assignedTo: 1, status: 1 });
ConversationSchema.index({ workspace: 1, assignedTo: 1, lastMessageAt: -1 });

// Unassigned conversations (for managers to assign)
ConversationSchema.index({ 
  workspace: 1, 
  assignedTo: 1, 
  status: 1, 
  lastActivityAt: -1 
}, { 
  partialFilterExpression: { assignedTo: null } 
});

// Priority-based inbox
ConversationSchema.index({ workspace: 1, priority: 1, lastActivityAt: -1 });

// Billing indexes (Week 2)
ConversationSchema.index({ workspace: 1, conversationStartedAt: 1, isBillable: 1 });

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCE METHODS - Stage 4
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assign conversation to an agent
 */
ConversationSchema.methods.assignTo = function(agentId, assignedById) {
  const previousAssignee = this.assignedTo;
  
  this.assignedTo = agentId;
  this.assignedBy = assignedById;
  this.assignedAt = new Date();
  
  // Add to history
  this.assignmentHistory.push({
    assignedTo: agentId,
    assignedBy: assignedById,
    assignedAt: new Date(),
    action: previousAssignee ? 'reassigned' : 'assigned'
  });
  
  // Initialize unread count for new agent
  if (!this.agentUnreadCounts.has(agentId.toString())) {
    this.agentUnreadCounts.set(agentId.toString(), this.unreadCount);
  }
  
  return this;
};

/**
 * Unassign conversation
 */
ConversationSchema.methods.unassign = function(unassignedById) {
  const previousAssignee = this.assignedTo;
  
  if (previousAssignee) {
    this.assignmentHistory.push({
      assignedTo: null,
      assignedBy: unassignedById,
      assignedAt: new Date(),
      action: 'unassigned'
    });
  }
  
  this.assignedTo = null;
  this.assignedBy = null;
  this.assignedAt = null;
  
  return this;
};

/**
 * Mark as read for specific agent
 */
ConversationSchema.methods.markReadForAgent = function(agentId) {
  this.agentUnreadCounts.set(agentId.toString(), 0);
  
  // Update viewedBy
  const existingView = this.viewedBy.find(
    v => v.user.toString() === agentId.toString()
  );
  
  if (existingView) {
    existingView.viewedAt = new Date();
  } else {
    this.viewedBy.push({
      user: agentId,
      viewedAt: new Date()
    });
  }
  
  return this;
};

/**
 * Increment unread count for all agents (when new message arrives)
 */
ConversationSchema.methods.incrementUnreadForAllAgents = function() {
  this.unreadCount += 1;
  
  // Increment for all agents who have a count entry
  for (const [agentId, count] of this.agentUnreadCounts.entries()) {
    this.agentUnreadCounts.set(agentId, count + 1);
  }
  
  // If assigned, ensure assignee has entry
  if (this.assignedTo) {
    const assigneeId = this.assignedTo.toString();
    if (!this.agentUnreadCounts.has(assigneeId)) {
      this.agentUnreadCounts.set(assigneeId, 1);
    }
  }
  
  return this;
};

/**
 * Get unread count for specific agent
 */
ConversationSchema.methods.getUnreadForAgent = function(agentId) {
  return this.agentUnreadCounts.get(agentId.toString()) || 0;
};

/**
 * Update status with audit trail
 */
ConversationSchema.methods.updateStatus = function(newStatus, changedById) {
  this.status = newStatus;
  this.statusChangedAt = new Date();
  this.statusChangedBy = changedById;
  return this;
};

// ═══════════════════════════════════════════════════════════════════════════
// STATIC METHODS - Stage 4 Queries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get conversations for agent inbox
 */
ConversationSchema.statics.getAgentInbox = async function(workspaceId, agentId, options = {}) {
  const { page = 1, limit = 20, status, sort = '-lastActivityAt' } = options;
  
  const query = {
    workspace: workspaceId,
    assignedTo: agentId
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('contact', 'name phone email')
    .populate('assignedTo', 'name email')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

/**
 * Get all conversations (for managers)
 */
ConversationSchema.statics.getAllInbox = async function(workspaceId, options = {}) {
  const { page = 1, limit = 20, status, assignedTo, sort = '-lastActivityAt' } = options;
  
  const query = { workspace: workspaceId };
  
  if (status) query.status = status;
  if (assignedTo !== undefined) {
    query.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
  }
  
  return this.find(query)
    .populate('contact', 'name phone email')
    .populate('assignedTo', 'name email')
    .populate('lastRepliedBy', 'name email')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

/**
 * Get unassigned conversations
 */
ConversationSchema.statics.getUnassigned = async function(workspaceId, options = {}) {
  const { page = 1, limit = 20, sort = '-lastActivityAt' } = options;
  
  return this.find({
    workspace: workspaceId,
    assignedTo: null,
    status: { $in: ['open', 'pending'] }
  })
    .populate('contact', 'name phone email')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

// Update timestamp on save
ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Conversation', ConversationSchema);

