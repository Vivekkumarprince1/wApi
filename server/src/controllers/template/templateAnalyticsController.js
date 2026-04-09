const { Template, Message } = require('../../models');
const templateCampaignService = require('../../services/template/templateCampaignAnalyticsService');
const analyticsService = require('../../services/analytics/analyticsAggregationService');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');

/**
 * Get workspace-wide template analytics summary and trend
 * GET /api/v1/templates/analytics/workspace
 */
exports.getWorkspaceAnalytics = async (req, res, next) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // 1. Get status counts and quality breakdown from Template model
    const [statusCounts, qualityBreakdownAgg] = await Promise.all([
      Template.getStatusCounts(workspaceId),
      Template.aggregate([
        { $match: { workspace: new mongoose.Types.ObjectId(workspaceId), status: { $ne: 'DELETED' } } },
        { $group: { _id: '$qualityScore', count: { $sum: 1 } } }
      ])
    ]);

    const qualityBreakdown = qualityBreakdownAgg.reduce((acc, curr) => {
      acc[curr._id || 'UNKNOWN'] = curr.count;
      return acc;
    }, { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 });

    // 2. Get message metrics for the period
    const messageMetrics = await analyticsService.computeMessageMetrics(workspaceId, start, end);

    // 3. Get message trend (simplifying to aggregate Message directly for now)
    const messagesTrend = await Message.aggregate([
      {
        $match: {
          workspace: new mongoose.Types.ObjectId(workspaceId),
          direction: 'outbound',
          type: 'template',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } }
    ]);

    const totalTemplates = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    const analytics = {
      summary: {
        totalTemplates,
        approvedTemplates: statusCounts.APPROVED || 0,
        rejectedTemplates: statusCounts.REJECTED || 0,
        pendingTemplates: statusCounts.PENDING || 0,
        totalMessages: messageMetrics.totalOutbound,
        deliveryRate: messageMetrics.deliveryRate,
        qualityGreen: qualityBreakdown.GREEN,
        qualityYellow: qualityBreakdown.YELLOW,
        qualityRed: qualityBreakdown.RED
      },
      qualityBreakdown,
      messagesTrend
    };

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('[TemplateAnalytics] getWorkspaceAnalytics failed:', error);
    next(error);
  }
};

/**
 * Get top performing templates
 * GET /api/v1/templates/analytics/top-performers
 */
exports.getTopPerformingTemplates = async (req, res, next) => {
  try {
    const workspaceId = req.user.workspace;
    const limit = parseInt(req.query.limit) || 10;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await templateCampaignService.getTemplateAnalytics(
      workspaceId,
      start,
      end,
      { limit, sortBy: 'delivered' }
    );

    // Transform for frontend: { _id, name, stats: { sentCount, deliveryRate }, qualityScore: { score } }
    const templates = result.templates.map(t => ({
      _id: t.templateId ? String(t.templateId) : `temp-${Math.random()}`,
      name: t.name,
      stats: {
        sentCount: t.metrics.totalSent,
        deliveryRate: t.metrics.deliveryRate,
        readRate: t.metrics.readRate
      },
      qualityScore: { score: t.qualityScore || 'UNKNOWN' }
    }));

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error('[TemplateAnalytics] getTopPerformingTemplates failed:', error);
    next(error);
  }
};

/**
 * Get low performing templates
 * GET /api/v1/templates/analytics/low-performers
 */
exports.getLowPerformingTemplates = async (req, res, next) => {
  try {
    const workspaceId = req.user.workspace;
    const limit = parseInt(req.query.limit) || 10;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await templateCampaignService.getTemplateAnalytics(
      workspaceId,
      start,
      end,
      { limit, sortBy: 'failed' }
    );

    const templates = result.templates.map(t => ({
      _id: t.templateId ? String(t.templateId) : `temp-${Math.random()}`,
      name: t.name,
      stats: {
        sentCount: t.metrics.totalSent,
        failureRate: 100 - t.metrics.deliveryRate
      },
      qualityScore: { score: t.qualityScore || 'UNKNOWN' }
    }));

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error('[TemplateAnalytics] getLowPerformingTemplates failed:', error);
    next(error);
  }
};

/**
 * Get behavioral insights (Heatmap & Best Time)
 * GET /api/v1/templates/analytics/behavioral
 */
exports.getTemplateBehavioralInsights = async (req, res, next) => {
  try {
    const workspaceId = req.user.workspace;
    const { templateId, days = 30 } = req.query;

    const result = await templateCampaignService.getBehavioralInsights(
      workspaceId,
      templateId,
      parseInt(days)
    );

    res.json(result);
  } catch (error) {
    logger.error('[TemplateAnalytics] getTemplateBehavioralInsights failed:', error);
    next(error);
  }
};

/**
 * Export analytics report
 */
exports.exportAnalyticsReport = async (req, res, next) => {
  try {
    const workspaceId = req.user.workspace;
    const { format = 'json' } = req.query;
    
    // For now, just return a success message or the raw JSON
    res.json({
      success: true,
      message: `Export as ${format.toUpperCase()} triggered.`,
      url: '#' // Placeholder
    });
  } catch (error) {
    next(error);
  }
};
