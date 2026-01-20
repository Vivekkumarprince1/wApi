/**
 * Template & Campaign Analytics Service - Stage 5
 * 
 * Aggregates template and campaign performance metrics:
 * - Template usage tracking
 * - Template-triggered conversations
 * - Campaign performance
 * - Read/reply rates
 */

const mongoose = require('mongoose');
const Template = require('../models/Template');
const TemplateMetric = require('../models/TemplateMetric');
const Campaign = require('../models/Campaign');
const CampaignMessage = require('../models/CampaignMessage');
const ConversationLedger = require('../models/ConversationLedger');
const Message = require('../models/Message');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get template usage analytics for a workspace
 */
async function getTemplateAnalytics(workspaceId, startDate, endDate, options = {}) {
  const ObjectId = mongoose.Types.ObjectId;
  const { limit = 20, sortBy = 'totalSent' } = options;
  
  try {
    // Get all templates for workspace
    const templates = await Template.find({ workspace: workspaceId })
      .select('name displayName category status language')
      .lean();
    
    // Get usage metrics for date range
    const usageMetrics = await Message.aggregate([
      {
        $match: {
          workspace: new ObjectId(workspaceId),
          direction: 'outbound',
          type: 'template',
          template: { $exists: true, $ne: null },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$template',
          totalSent: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          read: {
            $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      },
      { $sort: { [sortBy]: -1 } },
      { $limit: limit }
    ]);
    
    // Get conversations triggered by templates
    const conversationMetrics = await ConversationLedger.aggregate([
      {
        $match: {
          workspace: new ObjectId(workspaceId),
          template: { $exists: true, $ne: null },
          startedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$template',
          conversationsStarted: { $sum: 1 },
          billableConversations: {
            $sum: { $cond: ['$billable', 1, 0] }
          }
        }
      }
    ]);
    
    // Merge metrics with template info
    const conversationMap = conversationMetrics.reduce((acc, c) => {
      acc[c._id.toString()] = c;
      return acc;
    }, {});
    
    const templateMap = templates.reduce((acc, t) => {
      acc[t._id.toString()] = t;
      return acc;
    }, {});
    
    const analytics = usageMetrics.map(metric => {
      const template = templateMap[metric._id.toString()] || {};
      const convMetric = conversationMap[metric._id.toString()] || {};
      
      return {
        templateId: metric._id,
        name: template.name || 'Unknown',
        displayName: template.displayName || template.name || 'Unknown',
        category: template.category || 'UNKNOWN',
        status: template.status || 'unknown',
        language: template.language || 'en',
        metrics: {
          totalSent: metric.totalSent,
          delivered: metric.delivered,
          read: metric.read,
          failed: metric.failed,
          deliveryRate: metric.totalSent > 0 
            ? Math.round((metric.delivered / metric.totalSent) * 100) 
            : 0,
          readRate: metric.delivered > 0 
            ? Math.round((metric.read / metric.delivered) * 100) 
            : 0,
          conversationsStarted: convMetric.conversationsStarted || 0,
          billableConversations: convMetric.billableConversations || 0
        }
      };
    });
    
    // Calculate totals
    const totals = analytics.reduce((acc, t) => {
      acc.totalSent += t.metrics.totalSent;
      acc.delivered += t.metrics.delivered;
      acc.read += t.metrics.read;
      acc.failed += t.metrics.failed;
      acc.conversationsStarted += t.metrics.conversationsStarted;
      return acc;
    }, { totalSent: 0, delivered: 0, read: 0, failed: 0, conversationsStarted: 0 });
    
    totals.deliveryRate = totals.totalSent > 0 
      ? Math.round((totals.delivered / totals.totalSent) * 100) 
      : 0;
    totals.readRate = totals.delivered > 0 
      ? Math.round((totals.read / totals.delivered) * 100) 
      : 0;
    
    return {
      period: { startDate, endDate },
      templates: analytics,
      totals
    };
    
  } catch (error) {
    logger.error('[TemplateAnalytics] Failed to get template analytics:', error);
    throw error;
  }
}

/**
 * Get template performance over time
 */
async function getTemplatePerformanceTrend(workspaceId, templateId, startDate, endDate, groupBy = 'day') {
  const ObjectId = mongoose.Types.ObjectId;
  
  const dateFormat = {
    day: '%Y-%m-%d',
    week: '%Y-W%V',
    month: '%Y-%m'
  }[groupBy];
  
  try {
    const trend = await Message.aggregate([
      {
        $match: {
          workspace: new ObjectId(workspaceId),
          template: new ObjectId(templateId),
          direction: 'outbound',
          type: 'template',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' }
          },
          sent: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          read: {
            $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    return trend.map(t => ({
      period: t._id,
      sent: t.sent,
      delivered: t.delivered,
      read: t.read,
      failed: t.failed,
      deliveryRate: t.sent > 0 ? Math.round((t.delivered / t.sent) * 100) : 0,
      readRate: t.delivered > 0 ? Math.round((t.read / t.delivered) * 100) : 0
    }));
    
  } catch (error) {
    logger.error('[TemplateAnalytics] Failed to get template trend:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get campaign analytics for a workspace
 */
async function getCampaignAnalytics(workspaceId, startDate, endDate, options = {}) {
  const ObjectId = mongoose.Types.ObjectId;
  const { limit = 20, status = null } = options;
  
  try {
    // Build query
    const query = {
      workspace: new ObjectId(workspaceId),
      createdAt: { $gte: startDate, $lte: endDate }
    };
    
    if (status) {
      query.status = status;
    }
    
    // Get campaigns with message stats
    const campaigns = await Campaign.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'campaignmessages',
          localField: '_id',
          foreignField: 'campaign',
          as: 'messages'
        }
      },
      {
        $lookup: {
          from: 'templates',
          localField: 'template',
          foreignField: '_id',
          as: 'templateInfo'
        }
      },
      {
        $unwind: { path: '$templateInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          name: 1,
          status: 1,
          createdAt: 1,
          scheduledAt: 1,
          startedAt: 1,
          completedAt: 1,
          templateName: '$templateInfo.name',
          templateCategory: '$templateInfo.category',
          totalRecipients: { $size: '$messages' },
          sent: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'msg',
                cond: { $in: ['$$msg.status', ['sent', 'delivered', 'read']] }
              }
            }
          },
          delivered: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'msg',
                cond: { $in: ['$$msg.status', ['delivered', 'read']] }
              }
            }
          },
          read: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'msg',
                cond: { $eq: ['$$msg.status', 'read'] }
              }
            }
          },
          failed: {
            $size: {
              $filter: {
                input: '$messages',
                as: 'msg',
                cond: { $eq: ['$$msg.status', 'failed'] }
              }
            }
          }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit }
    ]);
    
    // Enrich with calculated rates
    const enrichedCampaigns = campaigns.map(c => ({
      ...c,
      deliveryRate: c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : 0,
      readRate: c.delivered > 0 ? Math.round((c.read / c.delivered) * 100) : 0,
      failureRate: c.totalRecipients > 0 ? Math.round((c.failed / c.totalRecipients) * 100) : 0
    }));
    
    // Calculate totals
    const totals = enrichedCampaigns.reduce((acc, c) => {
      acc.totalCampaigns++;
      acc.totalRecipients += c.totalRecipients;
      acc.sent += c.sent;
      acc.delivered += c.delivered;
      acc.read += c.read;
      acc.failed += c.failed;
      return acc;
    }, { totalCampaigns: 0, totalRecipients: 0, sent: 0, delivered: 0, read: 0, failed: 0 });
    
    totals.avgDeliveryRate = totals.sent > 0 
      ? Math.round((totals.delivered / totals.sent) * 100) 
      : 0;
    totals.avgReadRate = totals.delivered > 0 
      ? Math.round((totals.read / totals.delivered) * 100) 
      : 0;
    
    // Get conversations triggered by campaigns
    const campaignConversations = await ConversationLedger.countDocuments({
      workspace: workspaceId,
      source: 'CAMPAIGN',
      startedAt: { $gte: startDate, $lte: endDate }
    });
    
    totals.conversationsTriggered = campaignConversations;
    
    return {
      period: { startDate, endDate },
      campaigns: enrichedCampaigns,
      totals
    };
    
  } catch (error) {
    logger.error('[CampaignAnalytics] Failed to get campaign analytics:', error);
    throw error;
  }
}

/**
 * Get detailed campaign performance
 */
async function getCampaignDetail(campaignId) {
  const ObjectId = mongoose.Types.ObjectId;
  
  try {
    // Get campaign with template
    const campaign = await Campaign.findById(campaignId)
      .populate('template', 'name displayName category')
      .populate('createdBy', 'name email')
      .lean();
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Get message stats by status
    const messageStats = await CampaignMessage.aggregate([
      { $match: { campaign: new ObjectId(campaignId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statsByStatus = messageStats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});
    
    // Get hourly distribution
    const hourlyDistribution = await CampaignMessage.aggregate([
      { 
        $match: { 
          campaign: new ObjectId(campaignId),
          sentAt: { $exists: true }
        } 
      },
      {
        $group: {
          _id: { $hour: '$sentAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get failure reasons
    const failureReasons = await CampaignMessage.aggregate([
      { 
        $match: { 
          campaign: new ObjectId(campaignId),
          status: 'failed'
        } 
      },
      {
        $group: {
          _id: '$failureReason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get conversations triggered by this campaign
    const conversationsTriggered = await ConversationLedger.countDocuments({
      campaign: campaignId
    });
    
    const totalRecipients = Object.values(statsByStatus).reduce((a, b) => a + b, 0);
    const sent = (statsByStatus.sent || 0) + (statsByStatus.delivered || 0) + (statsByStatus.read || 0);
    const delivered = (statsByStatus.delivered || 0) + (statsByStatus.read || 0);
    const read = statsByStatus.read || 0;
    const failed = statsByStatus.failed || 0;
    
    return {
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        template: campaign.template,
        createdBy: campaign.createdBy,
        createdAt: campaign.createdAt,
        scheduledAt: campaign.scheduledAt,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt
      },
      metrics: {
        totalRecipients,
        sent,
        delivered,
        read,
        failed,
        pending: statsByStatus.pending || 0,
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
        failureRate: totalRecipients > 0 ? Math.round((failed / totalRecipients) * 100) : 0,
        conversationsTriggered
      },
      hourlyDistribution: hourlyDistribution.map(h => ({
        hour: h._id,
        count: h.count
      })),
      failureReasons: failureReasons.map(f => ({
        reason: f._id || 'Unknown',
        count: f.count
      }))
    };
    
  } catch (error) {
    logger.error('[CampaignAnalytics] Failed to get campaign detail:', error);
    throw error;
  }
}

/**
 * Get campaign performance trend over time
 */
async function getCampaignTrend(workspaceId, startDate, endDate, groupBy = 'day') {
  const ObjectId = mongoose.Types.ObjectId;
  
  const dateFormat = {
    day: '%Y-%m-%d',
    week: '%Y-W%V',
    month: '%Y-%m'
  }[groupBy];
  
  try {
    const trend = await Campaign.aggregate([
      {
        $match: {
          workspace: new ObjectId(workspaceId),
          status: 'completed',
          completedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'campaignmessages',
          localField: '_id',
          foreignField: 'campaign',
          as: 'messages'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$completedAt' }
          },
          campaigns: { $sum: 1 },
          totalMessages: { $sum: { $size: '$messages' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    return trend.map(t => ({
      period: t._id,
      campaigns: t.campaigns,
      messages: t.totalMessages
    }));
    
  } catch (error) {
    logger.error('[CampaignAnalytics] Failed to get campaign trend:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPLY RATE ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate reply rates for campaigns and templates
 */
async function getReplyRateAnalytics(workspaceId, startDate, endDate) {
  const ObjectId = mongoose.Types.ObjectId;
  
  try {
    // This would require linking outbound messages to inbound replies
    // within a conversation context. For now, we estimate based on
    // conversations that had both outbound templates and inbound messages
    
    const replyMetrics = await ConversationLedger.aggregate([
      {
        $match: {
          workspace: new ObjectId(workspaceId),
          initiatedBy: 'BUSINESS',
          startedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'messages',
          let: { convId: '$conversation' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversation', '$$convId'] },
                    { $eq: ['$direction', 'inbound'] }
                  ]
                }
              }
            }
          ],
          as: 'inboundMessages'
        }
      },
      {
        $group: {
          _id: '$source',
          totalConversations: { $sum: 1 },
          withReplies: {
            $sum: {
              $cond: [{ $gt: [{ $size: '$inboundMessages' }, 0] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    return replyMetrics.map(m => ({
      source: m._id,
      totalConversations: m.totalConversations,
      withReplies: m.withReplies,
      replyRate: m.totalConversations > 0 
        ? Math.round((m.withReplies / m.totalConversations) * 100) 
        : 0
    }));
    
  } catch (error) {
    logger.error('[Analytics] Failed to get reply rate analytics:', error);
    throw error;
  }
}

module.exports = {
  // Template analytics
  getTemplateAnalytics,
  getTemplatePerformanceTrend,
  
  // Campaign analytics
  getCampaignAnalytics,
  getCampaignDetail,
  getCampaignTrend,
  
  // Reply rates
  getReplyRateAnalytics
};
