/**
 * Billing Reports Controller - Stage 5
 * 
 * Provides exportable reports for:
 * - Conversation billing summary
 * - Usage breakdown by category/source
 * - Campaign performance
 * 
 * Supports:
 * - Date range filtering
 * - Workspace filtering (admin)
 * - CSV export
 * - JSON response
 */

const mongoose = require('mongoose');
const ConversationLedger = require('../models/ConversationLedger');
const Conversation = require('../models/Conversation');
const Campaign = require('../models/Campaign');
const CampaignMessage = require('../models/CampaignMessage');
const Workspace = require('../models/Workspace');
const { logger } = require('../utils/logger');
const { getQuotaStatusForUI } = require('../middlewares/quotaGuard');

/**
 * GET /api/v1/reports/conversations
 * Get conversation billing report
 * 
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 * - category: MARKETING | UTILITY | AUTHENTICATION | SERVICE (optional)
 * - source: CAMPAIGN | INBOX | API | AUTOMATION (optional)
 * - initiatedBy: BUSINESS | USER (optional)
 * - format: json | csv (default: json)
 * - page: number (default: 1)
 * - limit: number (default: 100, max: 1000)
 */
exports.getConversationsReport = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const {
      startDate,
      endDate,
      category,
      source,
      initiatedBy,
      format = 'json',
      page = 1,
      limit = 100
    } = req.query;

    // Validate required params
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        code: 'MISSING_DATE_RANGE'
      });
    }

    // Build query
    const query = {
      workspace: workspaceId,
      startedAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (category) query.category = category;
    if (source) query.source = source;
    if (initiatedBy) query.initiatedBy = initiatedBy;

    // Get paginated results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 1000);

    const [conversations, total, summary] = await Promise.all([
      ConversationLedger.find(query)
        .populate('contact', 'name phone')
        .populate('template', 'name displayName category')
        .populate('campaign', 'name')
        .populate('initiatedByUser', 'name email')
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ConversationLedger.countDocuments(query),
      getConversationSummary(workspaceId, startDate, endDate, query)
    ]);

    // Format for CSV if requested
    if (format === 'csv') {
      const csv = generateConversationsCSV(conversations, summary);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="conversations_${startDate}_${endDate}.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        conversations,
        summary,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        filters: {
          startDate,
          endDate,
          category,
          source,
          initiatedBy
        }
      }
    });

  } catch (error) {
    logger.error('[Reports] getConversationsReport failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate conversations report',
      code: 'REPORT_ERROR'
    });
  }
};

/**
 * GET /api/v1/reports/billing-usage
 * Get billing usage report with breakdowns
 * 
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 * - groupBy: day | week | month (default: day)
 * - format: json | csv
 */
exports.getBillingUsageReport = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const {
      startDate,
      endDate,
      groupBy = 'day',
      format = 'json'
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        code: 'MISSING_DATE_RANGE'
      });
    }

    // Get date grouping format
    const dateFormat = {
      day: { year: '$year', month: '$month', day: '$dayOfMonth' },
      week: { year: '$year', week: '$week' },
      month: { year: '$year', month: '$month' }
    }[groupBy];

    // Aggregate by period and category
    const workspaceObjId = new mongoose.Types.ObjectId(workspaceId);
    const usageByPeriod = await ConversationLedger.aggregate([
      {
        $match: {
          workspace: workspaceObjId,
          startedAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          billable: true
        }
      },
      {
        $group: {
          _id: {
            period: {
              $dateToString: {
                format: groupBy === 'day' ? '%Y-%m-%d' : 
                        groupBy === 'week' ? '%Y-W%V' : '%Y-%m',
                date: '$startedAt'
              }
            },
            category: '$category'
          },
          count: { $sum: 1 },
          messages: { $sum: '$messageCount' }
        }
      },
      {
        $group: {
          _id: '$_id.period',
          total: { $sum: '$count' },
          totalMessages: { $sum: '$messages' },
          byCategory: {
            $push: {
              category: '$_id.category',
              count: '$count',
              messages: '$messages'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get totals
    const totals = await ConversationLedger.aggregate([
      {
        $match: {
          workspace: workspaceObjId,
          startedAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          billable: true
        }
      },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: '$messageCount' },
          marketing: { $sum: { $cond: [{ $eq: ['$category', 'MARKETING'] }, 1, 0] } },
          utility: { $sum: { $cond: [{ $eq: ['$category', 'UTILITY'] }, 1, 0] } },
          authentication: { $sum: { $cond: [{ $eq: ['$category', 'AUTHENTICATION'] }, 1, 0] } },
          service: { $sum: { $cond: [{ $eq: ['$category', 'SERVICE'] }, 1, 0] } },
          businessInitiated: { $sum: { $cond: [{ $eq: ['$initiatedBy', 'BUSINESS'] }, 1, 0] } },
          userInitiated: { $sum: { $cond: [{ $eq: ['$initiatedBy', 'USER'] }, 1, 0] } }
        }
      }
    ]);

    // Get current quota status (with fallback if not configured)
    let quotaStatus = null;
    try {
      quotaStatus = await getQuotaStatusForUI(workspaceId);
    } catch (quotaError) {
      logger.warn('[Reports] Could not get quota status:', quotaError.message);
      quotaStatus = { used: 0, limit: 0, percentage: 0, warning: false };
    }

    const report = {
      period: { startDate, endDate },
      groupBy,
      usage: usageByPeriod.map(p => ({
        period: p._id,
        total: p.total,
        totalMessages: p.totalMessages,
        byCategory: p.byCategory.reduce((acc, c) => {
          acc[c.category.toLowerCase()] = { count: c.count, messages: c.messages };
          return acc;
        }, {})
      })),
      totals: totals[0] || {
        totalConversations: 0,
        totalMessages: 0,
        marketing: 0,
        utility: 0,
        authentication: 0,
        service: 0,
        businessInitiated: 0,
        userInitiated: 0
      },
      quota: quotaStatus
    };

    if (format === 'csv') {
      const csv = generateBillingUsageCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="billing_usage_${startDate}_${endDate}.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('[Reports] getBillingUsageReport failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate billing usage report',
      code: 'REPORT_ERROR'
    });
  }
};

/**
 * GET /api/v1/reports/campaigns
 * Get campaign performance report
 * 
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 * - status: draft | scheduled | sending | completed | failed (optional)
 * - format: json | csv
 */
exports.getCampaignsReport = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const {
      startDate,
      endDate,
      status,
      format = 'json',
      page = 1,
      limit = 50
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        code: 'MISSING_DATE_RANGE'
      });
    }

    // Build query
    const query = {
      workspace: workspaceId,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    // Get campaigns with stats
    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .populate('template', 'name displayName category')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Campaign.countDocuments(query)
    ]);

    // Enrich with message stats
    const enrichedCampaigns = await Promise.all(
      campaigns.map(async (campaign) => {
        const messageStats = await CampaignMessage.aggregate([
          { $match: { campaign: campaign._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);

        const stats = {
          total: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0
        };

        messageStats.forEach(s => {
          stats[s._id] = s.count;
          stats.total += s.count;
        });

        // Calculate rates
        stats.deliveryRate = stats.sent > 0 
          ? Math.round((stats.delivered / stats.sent) * 100) 
          : 0;
        stats.readRate = stats.delivered > 0 
          ? Math.round((stats.read / stats.delivered) * 100) 
          : 0;
        stats.failureRate = stats.total > 0 
          ? Math.round((stats.failed / stats.total) * 100) 
          : 0;

        return {
          ...campaign,
          messageStats: stats
        };
      })
    );

    // Calculate totals
    const totals = enrichedCampaigns.reduce((acc, c) => {
      acc.totalCampaigns += 1;
      acc.totalMessages += c.messageStats.total;
      acc.totalSent += c.messageStats.sent;
      acc.totalDelivered += c.messageStats.delivered;
      acc.totalRead += c.messageStats.read;
      acc.totalFailed += c.messageStats.failed;
      return acc;
    }, {
      totalCampaigns: 0,
      totalMessages: 0,
      totalSent: 0,
      totalDelivered: 0,
      totalRead: 0,
      totalFailed: 0
    });

    totals.avgDeliveryRate = totals.totalSent > 0 
      ? Math.round((totals.totalDelivered / totals.totalSent) * 100) 
      : 0;
    totals.avgReadRate = totals.totalDelivered > 0 
      ? Math.round((totals.totalRead / totals.totalDelivered) * 100) 
      : 0;

    if (format === 'csv') {
      const csv = generateCampaignsCSV(enrichedCampaigns, totals);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="campaigns_${startDate}_${endDate}.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        campaigns: enrichedCampaigns,
        totals,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        filters: {
          startDate,
          endDate,
          status
        }
      }
    });

  } catch (error) {
    logger.error('[Reports] getCampaignsReport failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate campaigns report',
      code: 'REPORT_ERROR'
    });
  }
};

/**
 * GET /api/v1/reports/quota
 * Get current quota status
 */
exports.getQuotaReport = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const quotaStatus = await getQuotaStatusForUI(workspaceId);

    res.json({
      success: true,
      data: quotaStatus
    });

  } catch (error) {
    logger.error('[Reports] getQuotaReport failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quota status',
      code: 'QUOTA_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get conversation summary stats
 */
async function getConversationSummary(workspaceId, startDate, endDate, baseQuery) {
  const summary = await ConversationLedger.aggregate([
    {
      $match: {
        ...baseQuery,
        workspace: new mongoose.Types.ObjectId(workspaceId)
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        billable: { $sum: { $cond: ['$billable', 1, 0] } },
        totalMessages: { $sum: '$messageCount' },
        byCategory: {
          $push: '$category'
        },
        bySource: {
          $push: '$source'
        },
        byInitiator: {
          $push: '$initiatedBy'
        }
      }
    }
  ]);

  if (summary.length === 0) {
    return {
      total: 0,
      billable: 0,
      totalMessages: 0,
      byCategory: {},
      bySource: {},
      byInitiator: {}
    };
  }

  const result = summary[0];

  // Count occurrences
  const countOccurrences = (arr) => {
    return arr.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  };

  return {
    total: result.total,
    billable: result.billable,
    totalMessages: result.totalMessages,
    byCategory: countOccurrences(result.byCategory),
    bySource: countOccurrences(result.bySource),
    byInitiator: countOccurrences(result.byInitiator)
  };
}

/**
 * Generate CSV for conversations report
 */
function generateConversationsCSV(conversations, summary) {
  const headers = [
    'ID',
    'Phone Number',
    'Contact Name',
    'Category',
    'Initiated By',
    'Source',
    'Template',
    'Campaign',
    'Started At',
    'Expires At',
    'Messages',
    'Billable'
  ];

  const rows = conversations.map(c => [
    c._id,
    c.phoneNumber,
    c.contact?.name || '',
    c.category,
    c.initiatedBy,
    c.source,
    c.templateName || '',
    c.campaignName || '',
    c.startedAt,
    c.expiresAt,
    c.messageCount,
    c.billable ? 'Yes' : 'No'
  ]);

  // Add summary row
  rows.push([]);
  rows.push(['Summary']);
  rows.push(['Total Conversations', summary.total]);
  rows.push(['Billable Conversations', summary.billable]);
  rows.push(['Total Messages', summary.totalMessages]);
  rows.push([]);
  rows.push(['By Category']);
  Object.entries(summary.byCategory).forEach(([k, v]) => {
    rows.push([k, v]);
  });

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Generate CSV for billing usage report
 */
function generateBillingUsageCSV(report) {
  const headers = [
    'Period',
    'Total Conversations',
    'Total Messages',
    'Marketing',
    'Utility',
    'Authentication',
    'Service'
  ];

  const rows = report.usage.map(u => [
    u.period,
    u.total,
    u.totalMessages,
    u.byCategory.marketing?.count || 0,
    u.byCategory.utility?.count || 0,
    u.byCategory.authentication?.count || 0,
    u.byCategory.service?.count || 0
  ]);

  // Add totals
  rows.push([]);
  rows.push(['TOTALS']);
  rows.push([
    'Total',
    report.totals.totalConversations,
    report.totals.totalMessages,
    report.totals.marketing,
    report.totals.utility,
    report.totals.authentication,
    report.totals.service
  ]);
  rows.push([]);
  rows.push(['Quota Status']);
  rows.push(['Used', report.quota.used]);
  rows.push(['Limit', report.quota.limit]);
  rows.push(['Percentage', `${report.quota.percentage}%`]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Generate CSV for campaigns report
 */
function generateCampaignsCSV(campaigns, totals) {
  const headers = [
    'ID',
    'Name',
    'Template',
    'Category',
    'Status',
    'Total Recipients',
    'Sent',
    'Delivered',
    'Read',
    'Failed',
    'Delivery Rate',
    'Read Rate',
    'Created At',
    'Completed At'
  ];

  const rows = campaigns.map(c => [
    c._id,
    c.name,
    c.template?.name || '',
    c.template?.category || '',
    c.status,
    c.messageStats.total,
    c.messageStats.sent,
    c.messageStats.delivered,
    c.messageStats.read,
    c.messageStats.failed,
    `${c.messageStats.deliveryRate}%`,
    `${c.messageStats.readRate}%`,
    c.createdAt,
    c.completedAt || ''
  ]);

  // Add totals
  rows.push([]);
  rows.push(['TOTALS']);
  rows.push([
    '',
    `${totals.totalCampaigns} campaigns`,
    '',
    '',
    '',
    totals.totalMessages,
    totals.totalSent,
    totals.totalDelivered,
    totals.totalRead,
    totals.totalFailed,
    `${totals.avgDeliveryRate}%`,
    `${totals.avgReadRate}%`,
    '',
    ''
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
