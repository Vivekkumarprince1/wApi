const express = require('express');
const auth = require('../middlewares/auth');
const rbac = require('../middlewares/rbac');
const conversationBillingService = require('../services/conversationBillingService');
const Conversation = require('../models/Conversation');
const { logger } = require('../utils/logger');

const router = express.Router();
router.use(auth);

/**
 * GET /api/v1/billing/conversations/current-month
 * Get billing metrics for current month
 * Only managers+ can access
 */
router.get(
  '/conversations/current-month',
  rbac.requirePermission('billing.view'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user.workspace;
      const metrics = await conversationBillingService.getCurrentMonthConversations(
        workspaceId
      );

      return res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('[BillingController] getCurrentMonthConversations failed:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/billing/conversations/metrics
 * Get billing metrics for date range
 * Query params: startDate, endDate (ISO format)
 */
router.get(
  '/conversations/metrics',
  rbac.requirePermission('billing.view'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user.workspace;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate required',
        });
      }

      const metrics = await conversationBillingService.getConversationMetrics(
        workspaceId,
        startDate,
        endDate
      );

      return res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('[BillingController] getConversationMetrics failed:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/billing/conversations
 * List all conversations with filters
 * Query params: status, limit, offset
 */
router.get(
  '/conversations',
  rbac.requirePermission('billing.view'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user.workspace;
      const { status = 'active', limit = 50, offset = 0 } = req.query;

      const result = await conversationBillingService.listConversations(workspaceId, {
        status,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[BillingController] listConversations failed:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/billing/conversations/calculate-billing
 * Calculate billing amount for period
 * Body: { plan, startDate, endDate }
 */
router.post(
  '/conversations/calculate-billing',
  rbac.requirePermission('billing.view'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user.workspace;
      const { plan = 'starter', startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate required',
        });
      }

      const billing = await conversationBillingService.calculateBillingAmount(
        workspaceId,
        plan,
        startDate,
        endDate
      );

      return res.status(200).json({
        success: true,
        data: billing,
      });
    } catch (error) {
      logger.error('[BillingController] calculateBillingAmount failed:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/billing/conversations/close-inactive
 * Admin endpoint: Close conversations inactive for 24h+
 * Only admins can call
 */
router.post(
  '/conversations/close-inactive',
  rbac.requirePermission('admin.manage'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user.workspace;
      const { idleThresholdHours = 24 } = req.body;

      const count = await conversationBillingService.closeInactiveConversations(
        workspaceId,
        idleThresholdHours
      );

      return res.status(200).json({
        success: true,
        data: {
          closedConversations: count,
          idleThresholdHours,
        },
      });
    } catch (error) {
      logger.error('[BillingController] closeInactiveConversations failed:', error);
      next(error);
    }
  }
);

module.exports = router;
