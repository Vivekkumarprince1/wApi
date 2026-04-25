const mongoose = require('mongoose');

/**
 * TEAM MODEL (Interakt-style)
 * Groups agents into teams for:
 *  - Visibility control (team_only sees only their contacts)
 *  - Auto-assignment (round_robin, least_busy, random)
 *  - Lead/Member hierarchy
 */
const TeamSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },

  description: {
    type: String,
    trim: true,
    maxLength: 500
  },

  // Team members with hierarchy (Lead vs Member)
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['lead', 'member'],
      default: 'member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    _id: false
  }],

  // Contact visibility control
  visibility: {
    type: String,
    enum: ['team_only', 'all'],
    default: 'team_only'
  },

  // Auto-assignment config
  autoAssign: {
    enabled: { type: Boolean, default: false },
    strategy: {
      type: String,
      enum: ['round_robin', 'least_busy', 'random'],
      default: 'round_robin'
    },
    // Round-robin tracking
    lastAssignedIndex: { type: Number, default: 0 }
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound indexes
TeamSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
TeamSchema.index({ workspaceId: 1, 'members.user': 1 });
TeamSchema.index({ workspaceId: 1, isActive: 1 });

// Virtual for member count
TeamSchema.virtual('memberCount').get(function() {
  return this.members?.length || 0;
});

// Ensure virtuals are included in JSON/Object
TeamSchema.set('toJSON', { virtuals: true });
TeamSchema.set('toObject', { virtuals: true });

// ══════════════════════════════════════
// INSTANCE METHODS
// ══════════════════════════════════════

// Add a member
TeamSchema.methods.addMember = function(userId, role = 'member') {
  const existing = this.members.find(m => m.user.toString() === userId.toString());
  if (existing) {
    existing.role = role;
  } else {
    this.members.push({ user: userId, role });
  }
  return this;
};

// Remove a member
TeamSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(m => m.user.toString() !== userId.toString());
  return this;
};

// Check if user is a lead
TeamSchema.methods.isLead = function(userId) {
  return this.members.some(m => m.user.toString() === userId.toString() && m.role === 'lead');
};

// Check if user is a member (any role)
TeamSchema.methods.hasMember = function(userId) {
  return this.members.some(m => m.user.toString() === userId.toString());
};

// Get leads only
TeamSchema.methods.getLeads = function() {
  return this.members.filter(m => m.role === 'lead');
};

// ══════════════════════════════════════
// STATIC METHODS
// ══════════════════════════════════════

// Find teams a user belongs to
TeamSchema.statics.findByUser = function(workspaceId, userId) {
  return this.find({
    workspaceId,
    'members.user': userId,
    isActive: true
  });
};

// Find teams with auto-assign enabled
TeamSchema.statics.findAutoAssignTeams = function(workspaceId) {
  return this.find({
    workspaceId,
    isActive: true,
    'autoAssign.enabled': true
  });
};

module.exports = mongoose.model('Team', TeamSchema);
