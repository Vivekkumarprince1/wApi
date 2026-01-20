/**
 * Billing Reports Routes - Stage 5
 * 
 * Routes for exportable billing reports:
 * - GET /conversations - Conversation billing report
 * - GET /billing-usage - Usage breakdown report
 * - GET /campaigns - Campaign performance report
 * - GET /quota - Current quota status
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  getConversationsReport,
  getBillingUsageReport,
  getCampaignsReport,
  getQuotaReport
} = require('../controllers/billingReportsController');

// All routes require authentication
router.use(auth);

/**
 * @route   GET /api/v1/reports/conversations
 * @desc    Get conversation billing report
 * @access  Private
 * 
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 * - category: MARKETING | UTILITY | AUTHENTICATION | SERVICE
 * - source: CAMPAIGN | INBOX | API | AUTOMATION | ANSWERBOT
 * - initiatedBy: BUSINESS | USER
 * - format: json | csv (default: json)
 * - page: number (default: 1)
 * - limit: number (default: 100)
 */
router.get('/conversations', getConversationsReport);

/**
 * @route   GET /api/v1/reports/billing-usage
 * @desc    Get billing usage report with time series breakdown
 * @access  Private
 * 
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 * - groupBy: day | week | month (default: day)
 * - format: json | csv
 */
router.get('/billing-usage', getBillingUsageReport);

/**
 * @route   GET /api/v1/reports/campaigns
 * @desc    Get campaign performance report
 * @access  Private
 * 
 * Query params:
 * - startDate: ISO date (required)
 * - endDate: ISO date (required)
 * - status: draft | scheduled | sending | completed | failed
 * - format: json | csv
 * - page: number (default: 1)
 * - limit: number (default: 50)
 */
router.get('/campaigns', getCampaignsReport);

/**
 * @route   GET /api/v1/reports/quota
 * @desc    Get current quota status
 * @access  Private
 */
router.get('/quota', getQuotaReport);

module.exports = router;
