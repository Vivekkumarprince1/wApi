/**
 * DailyAnalytics Model - Stage 5
 * 
 * Stores pre-computed daily analytics summaries per workspace.
 * Aggregated nightly by a cron job for fast dashboard queries.
 */

const mongoose = require('mongoose');

const DailyAnalyticsSchema = new mongoose.Schema({
  workspace: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workspace', 
    required: true 
  },
  
  // Date for this record (stored as midnight UTC)
  date: { type: Date, required: true },
  
  // ═══════════════════════════════════════════════════════════════════
  // CONVERSATION METRICS
  // ═══════════════════════════════════════════════════════════════════
  conversations: {
    // Volume metrics
    newCount: { type: Number, default: 0 },           // New conversations started
    reopenedCount: { type: Number, default: 0 },      // Reopened from closed/resolved
    closedCount: { type: Number, default: 0 },        // Conversations closed
    resolvedCount: { type: Number, default: 0 },      // Conversations resolved
    
    // Active conversations at end of day
    activeCount: { type: Number, default: 0 },
    
    // By status breakdown
    byStatus: {
      open: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      resolved: { type: Number, default: 0 },
      closed: { type: Number, default: 0 },
      snoozed: { type: Number, default: 0 }
    },
    
    // By source
    bySource: {
      organic: { type: Number, default: 0 },          // Customer initiated
      campaign: { type: Number, default: 0 },         // From campaigns
      automation: { type: Number, default: 0 },       // From automations
      widget: { type: Number, default: 0 },           // From chat widget
      api: { type: Number, default: 0 }               // From API
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // RESPONSE TIME METRICS
  // ═══════════════════════════════════════════════════════════════════
  responseTime: {
    // First response time (in seconds)
    avgFirstResponseTime: { type: Number, default: 0 },
    minFirstResponseTime: { type: Number, default: 0 },
    maxFirstResponseTime: { type: Number, default: 0 },
    medianFirstResponseTime: { type: Number, default: 0 },
    
    // Conversations with first response
    conversationsWithResponse: { type: Number, default: 0 },
    
    // SLA metrics
    slaBreachCount: { type: Number, default: 0 },
    slaMetCount: { type: Number, default: 0 },
    slaComplianceRate: { type: Number, default: 0 }   // Percentage
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // MESSAGE METRICS
  // ═══════════════════════════════════════════════════════════════════
  messages: {
    // Volume
    totalInbound: { type: Number, default: 0 },
    totalOutbound: { type: Number, default: 0 },
    
    // By type
    byType: {
      text: { type: Number, default: 0 },
      image: { type: Number, default: 0 },
      video: { type: Number, default: 0 },
      document: { type: Number, default: 0 },
      audio: { type: Number, default: 0 },
      template: { type: Number, default: 0 },
      interactive: { type: Number, default: 0 },
      location: { type: Number, default: 0 },
      contacts: { type: Number, default: 0 },
      sticker: { type: Number, default: 0 }
    },
    
    // Delivery stats (outbound only)
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    
    // Rates
    deliveryRate: { type: Number, default: 0 },       // Percentage
    readRate: { type: Number, default: 0 }            // Percentage
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // AGENT METRICS (Summary - detailed in AgentDailyAnalytics)
  // ═══════════════════════════════════════════════════════════════════
  agents: {
    activeCount: { type: Number, default: 0 },        // Agents who replied
    totalReplies: { type: Number, default: 0 },       // Total agent replies
    avgRepliesPerAgent: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 }     // Average across agents
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // BILLING METRICS
  // ═══════════════════════════════════════════════════════════════════
  billing: {
    // Billable conversations by category
    totalBillableConversations: { type: Number, default: 0 },
    byCategory: {
      marketing: { type: Number, default: 0 },
      utility: { type: Number, default: 0 },
      authentication: { type: Number, default: 0 },
      service: { type: Number, default: 0 }
    },
    
    // By initiator
    businessInitiated: { type: Number, default: 0 },
    userInitiated: { type: Number, default: 0 },
    
    // Template usage
    templateConversations: { type: Number, default: 0 }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // CAMPAIGN METRICS (Summary)
  // ═══════════════════════════════════════════════════════════════════
  campaigns: {
    campaignsRun: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    replied: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    
    // Rates
    deliveryRate: { type: Number, default: 0 },
    readRate: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // CONTACT METRICS
  // ═══════════════════════════════════════════════════════════════════
  contacts: {
    newContacts: { type: Number, default: 0 },
    totalContacts: { type: Number, default: 0 },      // Snapshot at end of day
    optOuts: { type: Number, default: 0 },
    optIns: { type: Number, default: 0 }
  },
  
  // Metadata
  computedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 }               // Schema version for migrations
});

// Unique index: one record per workspace per day
DailyAnalyticsSchema.index({ workspace: 1, date: 1 }, { unique: true });

// Query indexes
DailyAnalyticsSchema.index({ workspace: 1, date: -1 });
DailyAnalyticsSchema.index({ date: 1 });

module.exports = mongoose.model('DailyAnalytics', DailyAnalyticsSchema);
