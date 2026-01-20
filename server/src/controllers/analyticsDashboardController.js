/**
 * Analytics Dashboard Controller - Stage 5
 * 
 * Comprehensive analytics API endpoints:
 * - /analytics/overview - Dashboard overview metrics
 * - /analytics/conversations - Conversation analytics
 * - /analytics/agents - Agent performance metrics
 * - /analytics/campaigns - Campaign analytics
 * - /analytics/templates - Template usage analytics
 * - /analytics/billing-preview - Billing preview for current period
 */

const analyticsService = require('../services/analyticsAggregationService');
const templateCampaignService = require('../services/templateCampaignAnalyticsService');
const { logger } = require('../utils/logger');

/**
 * GET /api/v1/analytics/overview
 * Dashboard overview with key metrics
 */
exports.getOverview = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = getDateRange(req.query);
    
    const overview = await analyticsService.getAnalyticsOverview(
      workspaceId,
      startDate,
      endDate
    );
    
    res.json({
      success: true,
      data: overview
    });
    
  } catch (error) {
    logger.error('[Analytics] getOverview failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/conversations
 * Detailed conversation analytics
 */
exports.getConversationAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = getDateRange(req.query);
    
    const [metrics, responseMetrics] = await Promise.all([
      analyticsService.computeConversationMetrics(workspaceId, startDate, endDate),
      analyticsService.computeResponseTimeMetrics(workspaceId, startDate, endDate)
    ]);
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        volume: metrics,
        responseTime: responseMetrics
      }
    });
    
  } catch (error) {
    logger.error('[Analytics] getConversationAnalytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/agents
 * Agent performance analytics
 */
exports.getAgentAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = getDateRange(req.query);
    
    const agents = await analyticsService.getAgentAnalytics(
      workspaceId,
      startDate,
      endDate
    );
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        agents
      }
    });
    
  } catch (error) {
    logger.error('[Analytics] getAgentAnalytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/campaigns
 * Campaign performance analytics
 */
exports.getCampaignAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = getDateRange(req.query);
    const { status, limit } = req.query;
    
    const analytics = await templateCampaignService.getCampaignAnalytics(
      workspaceId,
      startDate,
      endDate,
      { status, limit: parseInt(limit) || 20 }
    );
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    logger.error('[Analytics] getCampaignAnalytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/campaigns/:campaignId
 * Detailed campaign performance
 */
exports.getCampaignDetail = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const detail = await templateCampaignService.getCampaignDetail(campaignId);
    
    res.json({
      success: true,
      data: detail
    });
    
  } catch (error) {
    logger.error('[Analytics] getCampaignDetail failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign detail',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/templates
 * Template usage analytics
 */
exports.getTemplateAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = getDateRange(req.query);
    const { sortBy, limit } = req.query;
    
    const analytics = await templateCampaignService.getTemplateAnalytics(
      workspaceId,
      startDate,
      endDate,
      { sortBy, limit: parseInt(limit) || 20 }
    );
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    logger.error('[Analytics] getTemplateAnalytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/templates/:templateId/trend
 * Template performance trend over time
 */
exports.getTemplateTrend = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { templateId } = req.params;
    const { startDate, endDate } = getDateRange(req.query);
    const { groupBy = 'day' } = req.query;
    
    const trend = await templateCampaignService.getTemplatePerformanceTrend(
      workspaceId,
      templateId,
      startDate,
      endDate,
      groupBy
    );
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        groupBy,
        trend
      }
    });
    
  } catch (error) {
    logger.error('[Analytics] getTemplateTrend failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template trend',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/billing-preview
 * Current billing period preview
 */
exports.getBillingPreview = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    
    const preview = await analyticsService.getBillingPreview(workspaceId);
    
    res.json({
      success: true,
      data: preview
    });
    
  } catch (error) {
    logger.error('[Analytics] getBillingPreview failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get billing preview',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/messages
 * Message volume and delivery analytics
 */
exports.getMessageAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = getDateRange(req.query);
    
    const metrics = await analyticsService.computeMessageMetrics(
      workspaceId,
      startDate,
      endDate
    );
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        ...metrics
      }
    });
    
  } catch (error) {
    logger.error('[Analytics] getMessageAnalytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get message analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
};

/**
 * GET /api/v1/analytics/reply-rates
 * Reply rate analytics by source
 */
exports.getReplyRateAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate } = getDateRange(req.query);
    
    const replyRates = await templateCampaignService.getReplyRateAnalytics(
      workspaceId,
      startDate,
      endDate
    );
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        replyRates
      }
    });
    
  } catch (error) {
    logger.error('[Analytics] getReplyRateAnalytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reply rate analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse date range from query params
 * Defaults to last 30 days
 */
function getDateRange(query) {
  const { startDate, endDate, days } = query;
  
  if (startDate && endDate) {
    return {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };
  }
  
  // Default to last N days
  const numDays = parseInt(days) || 30;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - numDays);
  
  return {
    startDate: start,
    endDate: end
  };
}
