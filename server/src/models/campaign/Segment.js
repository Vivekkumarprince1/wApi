const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SEGMENT MODEL - Dynamic Contact Cohorts
 * 
 * Allows businesses to save dynamic filter logic for campaigns and analytics.
 * Segments are resolved to a list of contacts at runtime.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const SegmentSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true,
    index: true 
  },
  name: { type: String, required: true },
  description: { type: String },
  
  // Filter logic used to resolve contacts
  filters: {
    tags: [String],              // Contacts must have at least one of these tags
    notTags: [String],           // Contacts must NOT have any of these tags
    status: [String],            // Filter by lead status
    lastSeenBefore: { type: Date },
    lastSeenAfter: { type: Date },
    hasActivity: { type: Boolean },
    activityType: { type: String }, // 'READ', 'REPLIED', 'CLICKED'
    
    // Custom MongoDB query object for advanced users
    customQuery: { type: mongoose.Schema.Types.Mixed }
  },
  
  // Stats (cached)
  contactCount: { type: Number, default: 0 },
  lastResolvedAt: { type: Date },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Index for faster listing
SegmentSchema.index({ workspace: 1, name: 1 });

module.exports = mongoose.model('Segment', SegmentSchema);
