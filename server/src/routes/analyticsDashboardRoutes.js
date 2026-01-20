/**
 * Analytics Dashboard Routes - Stage 5
 * 
 * Comprehensive analytics API:
 * - GET /api/v1/analytics/dashboard/overview       - Dashboard overview metrics
 * - GET /api/v1/analytics/dashboard/conversations  - Conversation analytics
 * - GET /api/v1/analytics/dashboard/agents         - Agent performance analytics
 * - GET /api/v1/analytics/dashboard/campaigns      - Campaign analytics
 * - GET /api/v1/analytics/dashboard/campaigns/:id  - Single campaign detail
 * - GET /api/v1/analytics/dashboard/templates      - Template analytics
 * - GET /api/v1/analytics/dashboard/templates/:id/trend - Template performance trend
 * - GET /api/v1/analytics/dashboard/billing        - Billing preview
 * - GET /api/v1/analytics/dashboard/messages       - Message analytics
 * - GET /api/v1/analytics/dashboard/reply-rates    - Reply rate analytics
 */

const express = require('express');
const auth = require('../middlewares/auth');
const analyticsDashboardController = require('../controllers/analyticsDashboardController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /overview
 * Query params: startDate, endDate, period (day|week|month)
 */
router.get('/overview', analyticsDashboardController.getOverview);

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /conversations
 * Detailed conversation analytics
 * Query params: startDate, endDate, groupBy (day|hour|status|source)
 */
router.get('/conversations', analyticsDashboardController.getConversationAnalytics);

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /agents
 * Agent performance metrics
 * Query params: startDate, endDate, agentId (optional for single agent)
 */
router.get('/agents', analyticsDashboardController.getAgentAnalytics);

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /campaigns
 * Campaign analytics list
 * Query params: startDate, endDate, status, sortBy
 */
router.get('/campaigns', analyticsDashboardController.getCampaignAnalytics);

/**
 * GET /campaigns/:campaignId
 * Single campaign detailed analytics
 */
router.get('/campaigns/:campaignId', analyticsDashboardController.getCampaignDetail);

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /templates
 * Template usage analytics
 * Query params: startDate, endDate, sortBy (usage|success|replies)
 */
router.get('/templates', analyticsDashboardController.getTemplateAnalytics);

/**
 * GET /templates/:templateId/trend
 * Template performance trend over time
 * Query params: startDate, endDate, period (day|week)
 */
router.get('/templates/:templateId/trend', analyticsDashboardController.getTemplateTrend);

// ═══════════════════════════════════════════════════════════════════════════
// BILLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /billing
 * Billing preview based on conversation ledger
 * Query params: startDate, endDate
 */
router.get('/billing', analyticsDashboardController.getBillingPreview);

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /messages
 * Message volume and delivery analytics
 * Query params: startDate, endDate, groupBy (day|hour|type)
 */
router.get('/messages', analyticsDashboardController.getMessageAnalytics);

// ═══════════════════════════════════════════════════════════════════════════
// REPLY RATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /reply-rates
 * Reply rate analytics (templates that get replies)
 * Query params: startDate, endDate, templateId (optional)
 */
router.get('/reply-rates', analyticsDashboardController.getReplyRateAnalytics);

module.exports = router;
