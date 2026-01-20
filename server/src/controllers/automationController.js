/**
 * Automation Controller - Stage 6
 * 
 * API endpoints for automation rule management and monitoring:
 * - Rule CRUD
 * - Enable/disable rules
 * - View execution logs
 * - Test rules (dry-run)
 * - Kill-switch control
 */

const AutomationRule = require('../models/AutomationRule');
const AutomationExecution = require('../models/AutomationExecution');
const AutomationAuditLog = require('../models/AutomationAuditLog');
const automationEngine = require('../services/automationEngine');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// RULE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/automation/rules
 * Get all automation rules for workspace
 */
exports.getRules = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { enabled, trigger, page = 1, limit = 50 } = req.query;

    let query = { workspaceId };

    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }

    if (trigger) {
      query['trigger.type'] = trigger;
    }

    const total = await AutomationRule.countDocuments(query);
    const rules = await AutomationRule
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: {
        rules,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('[Automation] getRules failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rules',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * GET /api/v1/automation/rules/:ruleId
 * Get single rule with execution history
 */
exports.getRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId } = req.params;

    const rule = await AutomationRule.findOne({
      _id: ruleId,
      workspaceId
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }

    // Get recent executions
    const recentExecutions = await AutomationExecution
      .find({ ruleId })
      .sort({ executedAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        rule,
        recentExecutions
      }
    });
  } catch (error) {
    logger.error('[Automation] getRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * POST /api/v1/automation/rules
 * Create new automation rule
 */
exports.createRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { name, trigger, conditions, actions, rateLimit, enabled } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Rule name is required',
        code: 'MISSING_NAME'
      });
    }

    if (!trigger || !trigger.type) {
      return res.status(400).json({
        success: false,
        error: 'Trigger type is required',
        code: 'MISSING_TRIGGER'
      });
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one action is required',
        code: 'MISSING_ACTIONS'
      });
    }

    const rule = new AutomationRule({
      workspaceId,
      name,
      trigger,
      conditions: conditions || [],
      actions,
      rateLimit: rateLimit || { perHour: 100, perContact: 10 },
      enabled: enabled !== false,
      createdBy: userId
    });

    await rule.save();

    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    logger.error('[Automation] createRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * PUT /api/v1/automation/rules/:ruleId
 * Update automation rule
 */
exports.updateRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId } = req.params;
    const updates = req.body;

    const rule = await AutomationRule.findOneAndUpdate(
      { _id: ruleId, workspaceId },
      updates,
      { new: true, runValidators: true }
    );

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    logger.error('[Automation] updateRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/automation/rules/:ruleId
 * Delete automation rule
 */
exports.deleteRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId } = req.params;

    const rule = await AutomationRule.findOneAndDelete({
      _id: ruleId,
      workspaceId
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    logger.error('[Automation] deleteRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * PATCH /api/v1/automation/rules/:ruleId/enable
 * Enable/disable a rule
 */
exports.toggleRuleEnabled = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'enabled property is required',
        code: 'MISSING_FIELD'
      });
    }

    const rule = await AutomationRule.findOneAndUpdate(
      { _id: ruleId, workspaceId },
      { enabled },
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: rule,
      message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    logger.error('[Automation] toggleRuleEnabled failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION LOGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/automation/logs
 * Get automation execution logs
 */
exports.getLogs = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId, conversationId, status, triggerType, page = 1, limit = 50 } = req.query;

    const options = {
      ruleId,
      conversationId,
      status,
      triggerType,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await AutomationAuditLog.getLogs(workspaceId, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[Automation] getLogs failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get logs',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * GET /api/v1/automation/logs/:logId
 * Get single execution log
 */
exports.getLog = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { logId } = req.params;

    const log = await AutomationAuditLog.findOne({
      _id: logId,
      workspaceId
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log not found',
        code: 'LOG_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    logger.error('[Automation] getLog failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get log',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * GET /api/v1/automation/stats
 * Get automation execution statistics
 */
exports.getStats = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId, days = 7 } = req.query;

    const stats = await AutomationAuditLog.getExecutionStats(workspaceId, {
      ruleId,
      days: parseInt(days)
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('[Automation] getStats failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * GET /api/v1/automation/failures
 * Get failure analysis
 */
exports.getFailures = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId, days = 7 } = req.query;

    const analysis = await AutomationAuditLog.getFailureAnalysis(workspaceId, {
      ruleId,
      days: parseInt(days)
    });

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    logger.error('[Automation] getFailures failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get failure analysis',
      code: 'AUTOMATION_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/automation/test
 * Test rule execution (dry-run on specific conversation)
 */
exports.testRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId, conversationId, dryRun = true } = req.body;

    if (!ruleId) {
      return res.status(400).json({
        success: false,
        error: 'ruleId is required',
        code: 'MISSING_RULE_ID'
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required',
        code: 'MISSING_CONVERSATION_ID'
      });
    }

    const rule = await AutomationRule.findOne({
      _id: ruleId,
      workspaceId
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }

    // Test the rule
    const result = await automationEngine.testRule(rule, conversationId, dryRun);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[Automation] testRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// KILL-SWITCH & CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/automation/status
 * Get automation engine status
 */
exports.getStatus = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;

    const status = {
      workspaceId,
      isEnabled: automationEngine.isWorkspaceEnabled(workspaceId),
      globalKillSwitch: automationEngine.getGlobalKillSwitchStatus(),
      enabledRulesCount: await AutomationRule.countDocuments({
        workspaceId,
        enabled: true
      }),
      totalRulesCount: await AutomationRule.countDocuments({ workspaceId }),
      todayExecutions: await AutomationExecution.countDocuments({
        workspaceId,
        executedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      })
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('[Automation] getStatus failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * PATCH /api/v1/automation/workspace/enable
 * Enable/disable automation for entire workspace
 */
exports.toggleWorkspaceAutomation = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'enabled property is required',
        code: 'MISSING_FIELD'
      });
    }

    automationEngine.setWorkspaceEnabled(workspaceId, enabled);

    res.json({
      success: true,
      message: `Automation ${enabled ? 'enabled' : 'disabled'} for workspace`
    });
  } catch (error) {
    logger.error('[Automation] toggleWorkspaceAutomation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle automation',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * PATCH /api/v1/automation/kill-switch
 * Global kill-switch (admin only)
 */
exports.toggleGlobalKillSwitch = async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.role || !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can toggle global kill-switch',
        code: 'FORBIDDEN'
      });
    }

    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'enabled property is required',
        code: 'MISSING_FIELD'
      });
    }

    automationEngine.setGlobalKillSwitch(!enabled); // Invert: enabled=false means kill-switch is ON

    res.json({
      success: true,
      message: `Global kill-switch ${enabled ? 'disabled' : 'enabled'}`
    });
  } catch (error) {
    logger.error('[Automation] toggleGlobalKillSwitch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle kill-switch',
      code: 'AUTOMATION_ERROR'
    });
  }
};
