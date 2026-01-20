/**
 * AgentDailyAnalytics Model - Stage 5
 * 
 * Per-agent daily performance metrics.
 * Used for agent leaderboards and performance tracking.
 */

const mongoose = require('mongoose');

const AgentDailyAnalyticsSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true 
  },
  
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Date for this record
  date: { type: Date, required: true },
  
  // ═══════════════════════════════════════════════════════════════════
  // CONVERSATION HANDLING
  // ═══════════════════════════════════════════════════════════════════
  conversations: {
    // Assignments
    assigned: { type: Number, default: 0 },           // New assignments
    reassignedFrom: { type: Number, default: 0 },     // Transferred away
    reassignedTo: { type: Number, default: 0 },       // Transferred to
    
    // Actions
    resolved: { type: Number, default: 0 },           // Resolved by this agent
    closed: { type: Number, default: 0 },             // Closed by this agent
    
    // Active at end of day
    activeAssigned: { type: Number, default: 0 }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // RESPONSE METRICS
  // ═══════════════════════════════════════════════════════════════════
  responses: {
    // Message counts
    totalReplies: { type: Number, default: 0 },
    firstResponses: { type: Number, default: 0 },     // Was first to respond
    
    // Response times (seconds)
    avgResponseTime: { type: Number, default: 0 },
    minResponseTime: { type: Number, default: 0 },
    maxResponseTime: { type: Number, default: 0 },
    medianResponseTime: { type: Number, default: 0 },
    
    // Response time buckets
    responseTimeBuckets: {
      under1min: { type: Number, default: 0 },
      under5min: { type: Number, default: 0 },
      under15min: { type: Number, default: 0 },
      under1hour: { type: Number, default: 0 },
      over1hour: { type: Number, default: 0 }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // SLA METRICS
  // ═══════════════════════════════════════════════════════════════════
  sla: {
    breaches: { type: Number, default: 0 },
    met: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 0 }      // Percentage
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // ACTIVITY METRICS
  // ═══════════════════════════════════════════════════════════════════
  activity: {
    // Session tracking
    firstActivityAt: { type: Date },
    lastActivityAt: { type: Date },
    activeMinutes: { type: Number, default: 0 },      // Estimated active time
    
    // Actions
    internalNotesAdded: { type: Number, default: 0 },
    tagsAdded: { type: Number, default: 0 },
    contactsUpdated: { type: Number, default: 0 }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMER SATISFACTION (Future)
  // ═══════════════════════════════════════════════════════════════════
  satisfaction: {
    surveysServed: { type: Number, default: 0 },
    responsesReceived: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    promoters: { type: Number, default: 0 },          // NPS 9-10
    passives: { type: Number, default: 0 },           // NPS 7-8
    detractors: { type: Number, default: 0 }          // NPS 0-6
  },
  
  // Metadata
  computedAt: { type: Date, default: Date.now }
});

// Unique index: one record per workspace per agent per day
AgentDailyAnalyticsSchema.index(
  { workspace: 1, agent: 1, date: 1 }, 
  { unique: true }
);

// Query indexes
AgentDailyAnalyticsSchema.index({ workspace: 1, date: -1 });
AgentDailyAnalyticsSchema.index({ agent: 1, date: -1 });
AgentDailyAnalyticsSchema.index({ workspace: 1, agent: 1, date: -1 });

module.exports = mongoose.model('AgentDailyAnalytics', AgentDailyAnalyticsSchema);
