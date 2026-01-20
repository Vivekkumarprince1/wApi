/**
 * Tag Model - Stage 5 CRM
 * 
 * Workspace-scoped tags for contacts and conversations.
 * Supports color coding and usage tracking.
 */

const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true 
  },
  
  // Tag details
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  
  // Normalized name for case-insensitive search
  normalizedName: {
    type: String,
    lowercase: true,
    trim: true
  },
  
  // Visual customization
  color: { 
    type: String, 
    default: '#6B7280'  // Gray default
  },
  
  // Description (optional)
  description: { type: String, maxlength: 200 },
  
  // Usage scope
  scope: {
    type: String,
    enum: ['all', 'contacts', 'conversations'],
    default: 'all'
  },
  
  // Usage counters (denormalized for quick display)
  usageCount: {
    contacts: { type: Number, default: 0 },
    conversations: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // System tag (cannot be deleted)
  isSystem: { type: Boolean, default: false },
  
  // Created by
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Unique tag names per workspace
TagSchema.index({ workspace: 1, normalizedName: 1 }, { unique: true });

// Query indexes
TagSchema.index({ workspace: 1, createdAt: -1 });
TagSchema.index({ workspace: 1, 'usageCount.total': -1 });

// Pre-save: normalize name
TagSchema.pre('save', function(next) {
  this.normalizedName = this.name.toLowerCase().trim();
  this.updatedAt = new Date();
  next();
});

// ═══════════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Find or create a tag by name
 */
TagSchema.statics.findOrCreate = async function(workspaceId, tagName, userId = null) {
  const normalizedName = tagName.toLowerCase().trim();
  
  let tag = await this.findOne({
    workspace: workspaceId,
    normalizedName
  });
  
  if (!tag) {
    tag = await this.create({
      workspace: workspaceId,
      name: tagName.trim(),
      normalizedName,
      createdBy: userId
    });
  }
  
  return tag;
};

/**
 * Increment usage counter
 */
TagSchema.statics.incrementUsage = async function(workspaceId, tagName, type = 'contacts') {
  const normalizedName = tagName.toLowerCase().trim();
  const field = type === 'contacts' ? 'usageCount.contacts' : 'usageCount.conversations';
  
  return this.findOneAndUpdate(
    { workspace: workspaceId, normalizedName },
    { 
      $inc: { 
        [field]: 1,
        'usageCount.total': 1
      }
    },
    { new: true }
  );
};

/**
 * Decrement usage counter
 */
TagSchema.statics.decrementUsage = async function(workspaceId, tagName, type = 'contacts') {
  const normalizedName = tagName.toLowerCase().trim();
  const field = type === 'contacts' ? 'usageCount.contacts' : 'usageCount.conversations';
  
  return this.findOneAndUpdate(
    { workspace: workspaceId, normalizedName },
    { 
      $inc: { 
        [field]: -1,
        'usageCount.total': -1
      }
    },
    { new: true }
  );
};

/**
 * Get popular tags for workspace
 */
TagSchema.statics.getPopularTags = async function(workspaceId, limit = 20) {
  return this.find({ workspace: workspaceId })
    .sort({ 'usageCount.total': -1 })
    .limit(limit)
    .lean();
};

/**
 * Search tags by prefix
 */
TagSchema.statics.searchByPrefix = async function(workspaceId, prefix, limit = 10) {
  const normalizedPrefix = prefix.toLowerCase().trim();
  
  return this.find({
    workspace: workspaceId,
    normalizedName: { $regex: `^${normalizedPrefix}`, $options: 'i' }
  })
    .sort({ 'usageCount.total': -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('Tag', TagSchema);
