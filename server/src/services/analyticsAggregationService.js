/**
 * Analytics Aggregation Service - Stage 5
 * 
 * Computes and stores daily analytics summaries.
 * Provides real-time analytics queries.
 * 
 * Follows Interakt's analytics patterns:
 * - Conversation metrics
 * - Response time tracking
 * - SLA compliance
 * - Agent performance
 * - Billing summaries
 */

const mongoose = require('mongoose');
const DailyAnalytics = require('../models/DailyAnalytics');
const AgentDailyAnalytics = require('../models/AgentDailyAnalytics');
const Conversation = require('../models/Conversation');
const ConversationLedger = require('../models/ConversationLedger');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const CampaignMessage = require('../models/CampaignMessage');
const User = require('../models/User');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// DAILY AGGREGATION (Run by cron job)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute daily analytics for a workspace
 * Called by nightly cron job
 */
async function computeDailyAnalytics(workspaceId, date = null) {
  try {
    // Default to yesterday
    const targetDate = date || getYesterdayMidnight();
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    
    logger.info(`[Analytics] Computing daily analytics for workspace ${workspaceId} on ${startOfDay.toISOString().split('T')[0]}`);
    
    // Compute all metrics in parallel
    const [
      conversationMetrics,
      responseMetrics,
      messageMetrics,
      billingMetrics,
      campaignMetrics,
      contactMetrics,
      agentMetrics
    ] = await Promise.all([
      computeConversationMetrics(workspaceId, startOfDay, endOfDay),
      computeResponseTimeMetrics(workspaceId, startOfDay, endOfDay),
      computeMessageMetrics(workspaceId, startOfDay, endOfDay),
      computeBillingMetrics(workspaceId, startOfDay, endOfDay),
      computeCampaignMetrics(workspaceId, startOfDay, endOfDay),
      computeContactMetrics(workspaceId, startOfDay, endOfDay),
      computeAgentMetrics(workspaceId, startOfDay, endOfDay)
    ]);
    
    // Upsert daily analytics record
    const dailyRecord = await DailyAnalytics.findOneAndUpdate(
      { workspace: workspaceId, date: startOfDay },
      {
        workspace: workspaceId,
        date: startOfDay,
        conversations: conversationMetrics,
        responseTime: responseMetrics,
        messages: messageMetrics,
        billing: billingMetrics,
        campaigns: campaignMetrics,
        contacts: contactMetrics,
        agents: {
          activeCount: agentMetrics.length,
          totalReplies: agentMetrics.reduce((sum, a) => sum + a.responses.totalReplies, 0),
          avgRepliesPerAgent: agentMetrics.length > 0 
            ? Math.round(agentMetrics.reduce((sum, a) => sum + a.responses.totalReplies, 0) / agentMetrics.length)
            : 0,
          avgResponseTime: agentMetrics.length > 0
            ? Math.round(agentMetrics.reduce((sum, a) => sum + a.responses.avgResponseTime, 0) / agentMetrics.length)
            : 0
        },
        computedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Upsert per-agent analytics
    for (const agentData of agentMetrics) {
      await AgentDailyAnalytics.findOneAndUpdate(
        { workspace: workspaceId, agent: agentData.agentId, date: startOfDay },
        {
          workspace: workspaceId,
          agent: agentData.agentId,
          date: startOfDay,
          ...agentData,
          computedAt: new Date()
        },
        { upsert: true }
      );
    }
    
    logger.info(`[Analytics] Daily analytics computed for workspace ${workspaceId}`);
    return dailyRecord;
    
  } catch (error) {
    logger.error(`[Analytics] Failed to compute daily analytics:`, error);
    throw error;
  }
}

/**
 * Compute daily analytics for ALL workspaces
 * Called by nightly cron
 */
async function computeAllWorkspacesDaily(date = null) {
  const Workspace = require('../models/Workspace');
  
  try {
    const workspaces = await Workspace.find({ 
      'subscription.status': 'active' 
    }).select('_id').lean();
    
    logger.info(`[Analytics] Computing daily analytics for ${workspaces.length} workspaces`);
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const ws of workspaces) {
      try {
        await computeDailyAnalytics(ws._id, date);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ workspace: ws._id, error: error.message });
      }
    }
    
    logger.info(`[Analytics] Daily computation complete: ${results.success} success, ${results.failed} failed`);
    return results;
    
  } catch (error) {
    logger.error(`[Analytics] Failed to compute all workspaces:`, error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// METRIC COMPUTATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute conversation volume metrics
 */
async function computeConversationMetrics(workspaceId, startOfDay, endOfDay) {
  const ObjectId = mongoose.Types.ObjectId;
  
  // New conversations
  const newConversations = await Conversation.countDocuments({
    workspace: workspaceId,
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });
  
  // Status changes to get reopened, closed, resolved
  const statusCounts = await Conversation.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId),
        statusChangedAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const statusMap = statusCounts.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {});
  
  // Active conversations at end of day
  const activeCount = await Conversation.countDocuments({
    workspace: workspaceId,
    status: { $in: ['open', 'pending'] },
    lastActivityAt: { $lte: endOfDay }
  });
  
  // By status snapshot
  const byStatusAgg = await Conversation.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId)
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byStatus = byStatusAgg.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, { open: 0, pending: 0, resolved: 0, closed: 0, snoozed: 0 });
  
  return {
    newCount: newConversations,
    reopenedCount: 0, // Would need status history tracking
    closedCount: statusMap.closed || 0,
    resolvedCount: statusMap.resolved || 0,
    activeCount,
    byStatus,
    bySource: {
      organic: newConversations, // Default - would need source tracking
      campaign: 0,
      automation: 0,
      widget: 0,
      api: 0
    }
  };
}

/**
 * Compute response time metrics
 */
async function computeResponseTimeMetrics(workspaceId, startOfDay, endOfDay) {
  const ObjectId = mongoose.Types.ObjectId;
  
  // Get conversations with first response in this period
  const conversationsWithResponse = await Conversation.find({
    workspace: workspaceId,
    firstResponseAt: { $gte: startOfDay, $lte: endOfDay }
  }).select('createdAt firstResponseAt slaBreached').lean();
  
  if (conversationsWithResponse.length === 0) {
    return {
      avgFirstResponseTime: 0,
      minFirstResponseTime: 0,
      maxFirstResponseTime: 0,
      medianFirstResponseTime: 0,
      conversationsWithResponse: 0,
      slaBreachCount: 0,
      slaMetCount: 0,
      slaComplianceRate: 100
    };
  }
  
  // Calculate response times in seconds
  const responseTimes = conversationsWithResponse.map(c => {
    const created = new Date(c.createdAt).getTime();
    const firstResponse = new Date(c.firstResponseAt).getTime();
    return Math.round((firstResponse - created) / 1000);
  }).filter(t => t > 0);
  
  // Sort for median
  responseTimes.sort((a, b) => a - b);
  
  const sum = responseTimes.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / responseTimes.length);
  const min = responseTimes[0] || 0;
  const max = responseTimes[responseTimes.length - 1] || 0;
  const median = responseTimes[Math.floor(responseTimes.length / 2)] || 0;
  
  // SLA metrics
  const slaBreachCount = conversationsWithResponse.filter(c => c.slaBreached).length;
  const slaMetCount = conversationsWithResponse.length - slaBreachCount;
  const slaComplianceRate = Math.round((slaMetCount / conversationsWithResponse.length) * 100);
  
  return {
    avgFirstResponseTime: avg,
    minFirstResponseTime: min,
    maxFirstResponseTime: max,
    medianFirstResponseTime: median,
    conversationsWithResponse: conversationsWithResponse.length,
    slaBreachCount,
    slaMetCount,
    slaComplianceRate
  };
}

/**
 * Compute message metrics
 */
async function computeMessageMetrics(workspaceId, startOfDay, endOfDay) {
  const ObjectId = mongoose.Types.ObjectId;
  
  // Message counts by direction
  const directionAgg = await Message.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId),
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$direction',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const directions = directionAgg.reduce((acc, d) => {
    acc[d._id] = d.count;
    return acc;
  }, {});
  
  // Message counts by type
  const typeAgg = await Message.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId),
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byType = typeAgg.reduce((acc, t) => {
    acc[t._id] = t.count;
    return acc;
  }, { text: 0, image: 0, video: 0, document: 0, audio: 0, template: 0, interactive: 0, location: 0, contacts: 0, sticker: 0 });
  
  // Delivery status for outbound
  const statusAgg = await Message.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId),
        direction: 'outbound',
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const statusMap = statusAgg.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {});
  
  const sent = statusMap.sent || 0;
  const delivered = statusMap.delivered || 0;
  const read = statusMap.read || 0;
  const failed = statusMap.failed || 0;
  
  const totalOutbound = directions.outbound || 0;
  
  return {
    totalInbound: directions.inbound || 0,
    totalOutbound,
    byType,
    sent,
    delivered,
    read,
    failed,
    deliveryRate: totalOutbound > 0 ? Math.round((delivered / totalOutbound) * 100) : 0,
    readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0
  };
}

/**
 * Compute billing metrics from ConversationLedger
 */
async function computeBillingMetrics(workspaceId, startOfDay, endOfDay) {
  const ObjectId = mongoose.Types.ObjectId;
  
  // Billable conversations by category
  const categoryAgg = await ConversationLedger.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId),
        startedAt: { $gte: startOfDay, $lte: endOfDay },
        billable: true
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byCategory = categoryAgg.reduce((acc, c) => {
    acc[c._id.toLowerCase()] = c.count;
    return acc;
  }, { marketing: 0, utility: 0, authentication: 0, service: 0 });
  
  // By initiator
  const initiatorAgg = await ConversationLedger.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId),
        startedAt: { $gte: startOfDay, $lte: endOfDay },
        billable: true
      }
    },
    {
      $group: {
        _id: '$initiatedBy',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const initiatorMap = initiatorAgg.reduce((acc, i) => {
    acc[i._id] = i.count;
    return acc;
  }, {});
  
  // Template conversations
  const templateConversations = await ConversationLedger.countDocuments({
    workspace: workspaceId,
    startedAt: { $gte: startOfDay, $lte: endOfDay },
    template: { $exists: true, $ne: null }
  });
  
  const totalBillable = Object.values(byCategory).reduce((a, b) => a + b, 0);
  
  return {
    totalBillableConversations: totalBillable,
    byCategory,
    businessInitiated: initiatorMap.BUSINESS || 0,
    userInitiated: initiatorMap.USER || 0,
    templateConversations
  };
}

/**
 * Compute campaign metrics
 */
async function computeCampaignMetrics(workspaceId, startOfDay, endOfDay) {
  const ObjectId = mongoose.Types.ObjectId;
  
  // Campaigns run today
  const campaignsRun = await Campaign.countDocuments({
    workspace: workspaceId,
    status: 'completed',
    completedAt: { $gte: startOfDay, $lte: endOfDay }
  });
  
  // Campaign message stats
  const messageStats = await CampaignMessage.aggregate([
    {
      $lookup: {
        from: 'campaigns',
        localField: 'campaign',
        foreignField: '_id',
        as: 'campaignInfo'
      }
    },
    {
      $unwind: '$campaignInfo'
    },
    {
      $match: {
        'campaignInfo.workspace': new ObjectId(workspaceId),
        sentAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const stats = messageStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {});
  
  const sent = (stats.sent || 0) + (stats.delivered || 0) + (stats.read || 0);
  const delivered = stats.delivered || 0;
  const read = stats.read || 0;
  const failed = stats.failed || 0;
  
  // Reply rate would need conversation linking
  const replied = 0;
  
  return {
    campaignsRun,
    messagesSent: sent,
    delivered,
    read,
    replied,
    failed,
    deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
    readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
    replyRate: delivered > 0 ? Math.round((replied / delivered) * 100) : 0
  };
}

/**
 * Compute contact metrics
 */
async function computeContactMetrics(workspaceId, startOfDay, endOfDay) {
  // New contacts
  const newContacts = await Contact.countDocuments({
    workspace: workspaceId,
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });
  
  // Total contacts
  const totalContacts = await Contact.countDocuments({
    workspace: workspaceId
  });
  
  // Opt-outs today
  const optOuts = await Contact.countDocuments({
    workspace: workspaceId,
    'optOut.optedOutAt': { $gte: startOfDay, $lte: endOfDay }
  });
  
  // Opt-ins today
  const optIns = await Contact.countDocuments({
    workspace: workspaceId,
    'optOut.optedBackInAt': { $gte: startOfDay, $lte: endOfDay }
  });
  
  return {
    newContacts,
    totalContacts,
    optOuts,
    optIns
  };
}

/**
 * Compute per-agent metrics
 */
async function computeAgentMetrics(workspaceId, startOfDay, endOfDay) {
  const ObjectId = mongoose.Types.ObjectId;
  
  // Get all agents who had activity
  const agentActivity = await Message.aggregate([
    {
      $match: {
        workspace: new ObjectId(workspaceId),
        direction: 'outbound',
        sentBy: { $exists: true, $ne: null },
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$sentBy',
        totalReplies: { $sum: 1 },
        firstActivityAt: { $min: '$createdAt' },
        lastActivityAt: { $max: '$createdAt' }
      }
    }
  ]);
  
  const agentMetrics = [];
  
  for (const activity of agentActivity) {
    // Get conversation stats for this agent
    const assigned = await Conversation.countDocuments({
      workspace: workspaceId,
      assignedTo: activity._id,
      assignedAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    const resolved = await Conversation.countDocuments({
      workspace: workspaceId,
      assignedTo: activity._id,
      status: 'resolved',
      statusChangedAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    const closed = await Conversation.countDocuments({
      workspace: workspaceId,
      assignedTo: activity._id,
      status: 'closed',
      statusChangedAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    // First responses by this agent
    const firstResponses = await Conversation.countDocuments({
      workspace: workspaceId,
      firstResponseBy: activity._id,
      firstResponseAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    // SLA metrics
    const slaBreaches = await Conversation.countDocuments({
      workspace: workspaceId,
      assignedTo: activity._id,
      slaBreached: true,
      slaBreachedAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    // Active assigned at end of day
    const activeAssigned = await Conversation.countDocuments({
      workspace: workspaceId,
      assignedTo: activity._id,
      status: { $in: ['open', 'pending'] }
    });
    
    agentMetrics.push({
      agentId: activity._id,
      conversations: {
        assigned,
        reassignedFrom: 0,
        reassignedTo: 0,
        resolved,
        closed,
        activeAssigned
      },
      responses: {
        totalReplies: activity.totalReplies,
        firstResponses,
        avgResponseTime: 0, // Would need message-level response tracking
        minResponseTime: 0,
        maxResponseTime: 0,
        medianResponseTime: 0,
        responseTimeBuckets: {
          under1min: 0,
          under5min: 0,
          under15min: 0,
          under1hour: 0,
          over1hour: 0
        }
      },
      sla: {
        breaches: slaBreaches,
        met: firstResponses - slaBreaches,
        complianceRate: firstResponses > 0 
          ? Math.round(((firstResponses - slaBreaches) / firstResponses) * 100)
          : 100
      },
      activity: {
        firstActivityAt: activity.firstActivityAt,
        lastActivityAt: activity.lastActivityAt,
        activeMinutes: 0,
        internalNotesAdded: 0,
        tagsAdded: 0,
        contactsUpdated: 0
      }
    });
  }
  
  return agentMetrics;
}

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME ANALYTICS QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get analytics overview for dashboard
 */
async function getAnalyticsOverview(workspaceId, startDate, endDate) {
  const ObjectId = mongoose.Types.ObjectId;
  
  // Get daily records in range
  const dailyRecords = await DailyAnalytics.find({
    workspace: workspaceId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 }).lean();
  
  if (dailyRecords.length === 0) {
    // Return real-time computed metrics if no daily records
    return computeRealTimeOverview(workspaceId, startDate, endDate);
  }
  
  // Aggregate metrics
  const overview = {
    period: { startDate, endDate },
    conversations: {
      total: dailyRecords.reduce((sum, r) => sum + r.conversations.newCount, 0),
      resolved: dailyRecords.reduce((sum, r) => sum + r.conversations.resolvedCount, 0),
      closed: dailyRecords.reduce((sum, r) => sum + r.conversations.closedCount, 0)
    },
    responseTime: {
      avgFirstResponseTime: calculateAverage(dailyRecords.map(r => r.responseTime.avgFirstResponseTime)),
      slaComplianceRate: calculateAverage(dailyRecords.map(r => r.responseTime.slaComplianceRate))
    },
    messages: {
      totalInbound: dailyRecords.reduce((sum, r) => sum + r.messages.totalInbound, 0),
      totalOutbound: dailyRecords.reduce((sum, r) => sum + r.messages.totalOutbound, 0),
      deliveryRate: calculateAverage(dailyRecords.map(r => r.messages.deliveryRate)),
      readRate: calculateAverage(dailyRecords.map(r => r.messages.readRate))
    },
    billing: {
      totalConversations: dailyRecords.reduce((sum, r) => sum + r.billing.totalBillableConversations, 0),
      byCategory: aggregateByCategory(dailyRecords.map(r => r.billing.byCategory))
    },
    campaigns: {
      total: dailyRecords.reduce((sum, r) => sum + r.campaigns.campaignsRun, 0),
      messagesSent: dailyRecords.reduce((sum, r) => sum + r.campaigns.messagesSent, 0),
      deliveryRate: calculateAverage(dailyRecords.map(r => r.campaigns.deliveryRate))
    },
    contacts: {
      newContacts: dailyRecords.reduce((sum, r) => sum + r.contacts.newContacts, 0),
      total: dailyRecords[dailyRecords.length - 1]?.contacts.totalContacts || 0
    },
    trend: dailyRecords.map(r => ({
      date: r.date,
      conversations: r.conversations.newCount,
      messages: r.messages.totalInbound + r.messages.totalOutbound,
      billing: r.billing.totalBillableConversations
    }))
  };
  
  return overview;
}

/**
 * Compute real-time overview when no daily records exist
 */
async function computeRealTimeOverview(workspaceId, startDate, endDate) {
  const [conversations, messages, billing, contacts] = await Promise.all([
    computeConversationMetrics(workspaceId, startDate, endDate),
    computeMessageMetrics(workspaceId, startDate, endDate),
    computeBillingMetrics(workspaceId, startDate, endDate),
    computeContactMetrics(workspaceId, startDate, endDate)
  ]);
  
  return {
    period: { startDate, endDate },
    conversations: {
      total: conversations.newCount,
      resolved: conversations.resolvedCount,
      closed: conversations.closedCount
    },
    responseTime: {
      avgFirstResponseTime: 0,
      slaComplianceRate: 100
    },
    messages: {
      totalInbound: messages.totalInbound,
      totalOutbound: messages.totalOutbound,
      deliveryRate: messages.deliveryRate,
      readRate: messages.readRate
    },
    billing: {
      totalConversations: billing.totalBillableConversations,
      byCategory: billing.byCategory
    },
    campaigns: {
      total: 0,
      messagesSent: 0,
      deliveryRate: 0
    },
    contacts: {
      newContacts: contacts.newContacts,
      total: contacts.totalContacts
    },
    trend: []
  };
}

/**
 * Get agent performance analytics
 */
async function getAgentAnalytics(workspaceId, startDate, endDate) {
  // Get agent daily records
  const agentRecords = await AgentDailyAnalytics.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(workspaceId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$agent',
        totalReplies: { $sum: '$responses.totalReplies' },
        firstResponses: { $sum: '$responses.firstResponses' },
        avgResponseTime: { $avg: '$responses.avgResponseTime' },
        conversationsAssigned: { $sum: '$conversations.assigned' },
        conversationsResolved: { $sum: '$conversations.resolved' },
        slaBreaches: { $sum: '$sla.breaches' },
        slaMet: { $sum: '$sla.met' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        agentId: '$_id',
        name: '$user.name',
        email: '$user.email',
        totalReplies: 1,
        firstResponses: 1,
        avgResponseTime: { $round: ['$avgResponseTime', 0] },
        conversationsAssigned: 1,
        conversationsResolved: 1,
        slaBreaches: 1,
        slaMet: 1,
        slaComplianceRate: {
          $cond: [
            { $gt: [{ $add: ['$slaBreaches', '$slaMet'] }, 0] },
            { $round: [{ $multiply: [{ $divide: ['$slaMet', { $add: ['$slaBreaches', '$slaMet'] }] }, 100] }, 0] },
            100
          ]
        }
      }
    },
    { $sort: { totalReplies: -1 } }
  ]);
  
  return agentRecords;
}

/**
 * Get billing preview for current period
 */
async function getBillingPreview(workspaceId) {
  const Workspace = require('../models/Workspace');
  
  const workspace = await Workspace.findById(workspaceId)
    .select('billingQuota billingUsage plan')
    .lean();
  
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  
  // Get current period dates
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // Get detailed billing from ConversationLedger
  const billingDetails = await ConversationLedger.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(workspaceId),
        startedAt: { $gte: periodStart, $lte: periodEnd },
        billable: true
      }
    },
    {
      $group: {
        _id: {
          category: '$category',
          source: '$source'
        },
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Structure the response
  const byCategory = { MARKETING: 0, UTILITY: 0, AUTHENTICATION: 0, SERVICE: 0 };
  const bySource = { CAMPAIGN: 0, INBOX: 0, API: 0, AUTOMATION: 0, ANSWERBOT: 0 };
  
  billingDetails.forEach(d => {
    if (d._id.category) byCategory[d._id.category] = (byCategory[d._id.category] || 0) + d.count;
    if (d._id.source) bySource[d._id.source] = (bySource[d._id.source] || 0) + d.count;
  });
  
  const totalConversations = Object.values(byCategory).reduce((a, b) => a + b, 0);
  
  return {
    period: {
      start: periodStart,
      end: periodEnd,
      daysRemaining: Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24))
    },
    quota: workspace.billingQuota || { monthlyConversations: 1000 },
    usage: {
      total: totalConversations,
      byCategory,
      bySource,
      percentage: workspace.billingQuota?.monthlyConversations 
        ? Math.round((totalConversations / workspace.billingQuota.monthlyConversations) * 100)
        : 0
    },
    projections: {
      dailyAverage: Math.round(totalConversations / Math.max(now.getDate(), 1)),
      projectedTotal: Math.round((totalConversations / now.getDate()) * periodEnd.getDate())
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getYesterdayMidnight() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function calculateAverage(numbers) {
  const validNumbers = numbers.filter(n => n > 0);
  if (validNumbers.length === 0) return 0;
  return Math.round(validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length);
}

function aggregateByCategory(categories) {
  const result = { marketing: 0, utility: 0, authentication: 0, service: 0 };
  categories.forEach(cat => {
    Object.keys(result).forEach(key => {
      result[key] += cat[key] || 0;
    });
  });
  return result;
}

module.exports = {
  // Daily aggregation
  computeDailyAnalytics,
  computeAllWorkspacesDaily,
  
  // Real-time queries
  getAnalyticsOverview,
  getAgentAnalytics,
  getBillingPreview,
  
  // Individual metrics (for testing)
  computeConversationMetrics,
  computeResponseTimeMetrics,
  computeMessageMetrics,
  computeBillingMetrics,
  computeCampaignMetrics,
  computeContactMetrics,
  computeAgentMetrics
};
