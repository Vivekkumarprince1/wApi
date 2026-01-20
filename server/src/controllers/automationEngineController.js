/**
 * Automation Controller - Stage 6 Automation Engine
 * 
 * API endpoints for:
 * - Rule CRUD
 * - Execution logs
 * - Testing/dry-run
 * - Engine control
 */

const AutomationRule = require('../models/AutomationRule');
const AutomationExecution = require('../models/AutomationExecution');
const automationEngine = require('../services/automationEngine');
const safetyGuards = require('../services/automationSafetyGuards');
const { automationEvents } = require('../services/automationEventEmitter');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// RULE CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/automation/rules
 * List all automation rules for workspace
 */
exports.listRules = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { enabled, trigger, page = 1, limit = 50 } = req.query;
    
    const query = { 
      workspace: workspaceId,
      deletedAt: null
    };
    
    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }
    
    if (trigger) {
      query.$or = [
        { 'trigger.event': trigger },
        { legacyTrigger: trigger }
      ];
    }
    
    const total = await AutomationRule.countDocuments(query);
    const rules = await AutomationRule.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
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
    logger.error('[AutomationController] listRules failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list automation rules',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * GET /api/v1/automation/rules/:ruleId
 * Get single automation rule
 */
exports.getRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId } = req.params;
    
    const rule = await AutomationRule.findOne({
      _id: ruleId,
      workspace: workspaceId,
      deletedAt: null
    }).populate('createdBy', 'name email');
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }
    
    // Get execution stats
    const stats = await AutomationExecution.getRuleStats(ruleId, 7);
    
    res.json({
      success: true,
      data: {
        rule,
        stats
      }
    });
    
  } catch (error) {
    logger.error('[AutomationController] getRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get automation rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * POST /api/v1/automation/rules
 * Create a new automation rule
 */
exports.createRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { name, description, trigger, conditions, actions, rateLimit, priority, enabled } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Rule name is required',
        code: 'MISSING_NAME'
      });
    }
    
    if (!trigger || !trigger.event) {
      return res.status(400).json({
        success: false,
        error: 'Trigger event is required',
        code: 'MISSING_TRIGGER'
      });
    }
    
    if (!actions || actions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one action is required',
        code: 'MISSING_ACTIONS'
      });
    }
    
    // Check workspace rule limit (if applicable)
    const existingCount = await AutomationRule.countDocuments({
      workspace: workspaceId,
      deletedAt: null
    });
    
    // TODO: Check plan limits
    
    const rule = await AutomationRule.create({
      workspace: workspaceId,
      name,
      description,
      trigger,
      conditions: conditions || [],
      actions,
      rateLimit: rateLimit || {},
      priority: priority || 0,
      enabled: enabled !== false,
      createdBy: userId
    });
    
    logger.info(`[AutomationController] Rule created: ${rule._id}`, {
      workspaceId,
      ruleName: name,
      trigger: trigger.event
    });
    
    res.status(201).json({
      success: true,
      data: rule
    });
    
  } catch (error) {
    logger.error('[AutomationController] createRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create automation rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * PUT /api/v1/automation/rules/:ruleId
 * Update an automation rule
 */
exports.updateRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { ruleId } = req.params;
    const updates = req.body;
    
    const rule = await AutomationRule.findOne({
      _id: ruleId,
      workspace: workspaceId,
      deletedAt: null
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }
    
    // Apply updates
    const allowedFields = ['name', 'description', 'trigger', 'conditions', 'actions', 'rateLimit', 'priority', 'enabled'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        rule[field] = updates[field];
      }
    }
    
    rule.updatedBy = userId;
    await rule.save();
    
    logger.info(`[AutomationController] Rule updated: ${ruleId}`);
    
    res.json({
      success: true,
      data: rule
    });
    
  } catch (error) {
    logger.error('[AutomationController] updateRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update automation rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/automation/rules/:ruleId
 * Soft delete an automation rule
 */
exports.deleteRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId } = req.params;
    
    const rule = await AutomationRule.findOneAndUpdate(
      {
        _id: ruleId,
        workspace: workspaceId,
        deletedAt: null
      },
      {
        deletedAt: new Date(),
        enabled: false
      },
      { new: true }
    );
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }
    
    logger.info(`[AutomationController] Rule deleted: ${ruleId}`);
    
    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
    
  } catch (error) {
    logger.error('[AutomationController] deleteRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete automation rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * PATCH /api/v1/automation/rules/:ruleId/toggle
 * Toggle rule enabled/disabled
 */
exports.toggleRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId } = req.params;
    const { enabled } = req.body;
    
    const rule = await AutomationRule.findOneAndUpdate(
      {
        _id: ruleId,
        workspace: workspaceId,
        deletedAt: null
      },
      { enabled: enabled },
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
      data: { enabled: rule.enabled }
    });
    
  } catch (error) {
    logger.error('[AutomationController] toggleRule failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle automation rule',
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
    const { 
      ruleId, 
      status, 
      contactId, 
      conversationId,
      startDate,
      endDate,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const query = { workspace: workspaceId };
    
    if (ruleId) query.rule = ruleId;
    if (status) query.status = status;
    if (contactId) query.contact = contactId;
    if (conversationId) query.conversation = conversationId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const total = await AutomationExecution.countDocuments(query);
    const logs = await AutomationExecution.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('rule', 'name trigger.event')
      .populate('contact', 'phone name')
      .lean();
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    logger.error('[AutomationController] getLogs failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get automation logs',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * GET /api/v1/automation/logs/:executionId
 * Get single execution details
 */
exports.getLogDetail = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { executionId } = req.params;
    
    const execution = await AutomationExecution.findOne({
      _id: executionId,
      workspace: workspaceId
    })
      .populate('rule', 'name description trigger conditions actions')
      .populate('contact', 'phone name email tags')
      .populate('conversation', 'status assignedTo');
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
        code: 'EXECUTION_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: execution
    });
    
  } catch (error) {
    logger.error('[AutomationController] getLogDetail failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution details',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * GET /api/v1/automation/logs/stats
 * Get execution statistics
 */
exports.getLogStats = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Overall stats
    const overallStats = await AutomationExecution.aggregate([
      {
        $match: {
          workspace: workspaceId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Daily breakdown
    const dailyStats = await AutomationExecution.aggregate([
      {
        $match: {
          workspace: workspaceId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);
    
    // Skip reason breakdown
    const skipReasons = await AutomationExecution.getSkipReasonBreakdown(workspaceId, parseInt(days));
    
    // Top rules by execution
    const topRules = await AutomationExecution.aggregate([
      {
        $match: {
          workspace: workspaceId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$rule',
          total: { $sum: 1 },
          successful: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } }
        }
      },
      {
        $sort: { total: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'automationrules',
          localField: '_id',
          foreignField: '_id',
          as: 'rule'
        }
      },
      {
        $unwind: '$rule'
      },
      {
        $project: {
          ruleName: '$rule.name',
          total: 1,
          successful: 1,
          successRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$successful', '$total'] }, 100] },
              0
            ]
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        period: { startDate, endDate: new Date(), days: parseInt(days) },
        overall: Object.fromEntries(overallStats.map(s => [s._id.toLowerCase(), s.count])),
        daily: dailyStats,
        skipReasons,
        topRules
      }
    });
    
  } catch (error) {
    logger.error('[AutomationController] getLogStats failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution statistics',
      code: 'AUTOMATION_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTING & DRY RUN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/automation/test
 * Test/dry-run a rule
 */
exports.testRule = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { ruleId, contactId, conversationId, messageContent, metadata } = req.body;
    
    if (!ruleId) {
      return res.status(400).json({
        success: false,
        error: 'Rule ID is required',
        code: 'MISSING_RULE_ID'
      });
    }
    
    const result = await automationEngine.testRule(ruleId, {
      workspaceId,
      contactId,
      conversationId,
      metadata: {
        ...metadata,
        message: messageContent ? { content: messageContent, type: 'text' } : undefined
      }
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('[AutomationController] testRule failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test rule',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * POST /api/v1/automation/simulate
 * Simulate an event and see which rules would fire
 */
exports.simulateEvent = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { eventType, contactId, conversationId, metadata } = req.body;
    
    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'Event type is required',
        code: 'MISSING_EVENT_TYPE'
      });
    }
    
    const result = await automationEngine.simulateEvent({
      workspaceId,
      type: eventType,
      contactId,
      conversationId,
      timestamp: new Date(),
      metadata
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('[AutomationController] simulateEvent failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate event',
      code: 'AUTOMATION_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CONTROL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/automation/status
 * Get automation engine status
 */
exports.getStatus = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    
    const engineStatus = automationEngine.getEngineStatus();
    const workspaceEnabled = await safetyGuards.isWorkspaceAutomationEnabled(workspaceId);
    
    // Get workspace rule count
    const ruleCount = await AutomationRule.countDocuments({
      workspace: workspaceId,
      deletedAt: null
    });
    
    const enabledRuleCount = await AutomationRule.countDocuments({
      workspace: workspaceId,
      enabled: true,
      deletedAt: null
    });
    
    res.json({
      success: true,
      data: {
        engine: engineStatus,
        workspace: {
          automationEnabled: workspaceEnabled,
          totalRules: ruleCount,
          enabledRules: enabledRuleCount
        }
      }
    });
    
  } catch (error) {
    logger.error('[AutomationController] getStatus failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get automation status',
      code: 'AUTOMATION_ERROR'
    });
  }
};

/**
 * POST /api/v1/automation/workspace/toggle
 * Toggle workspace automation on/off
 */
exports.toggleWorkspaceAutomation = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { enabled } = req.body;
    
    // Update workspace settings
    const Workspace = require('../models/Workspace');
    await Workspace.findByIdAndUpdate(workspaceId, {
      'settings.automationEnabled': enabled
    });
    
    // Clear cache
    safetyGuards.clearWorkspaceCache(workspaceId);
    
    if (enabled) {
      automationEvents.enableWorkspace(workspaceId);
    } else {
      automationEvents.disableWorkspace(workspaceId);
    }
    
    logger.info(`[AutomationController] Workspace automation ${enabled ? 'enabled' : 'disabled'}`, { workspaceId });
    
    res.json({
      success: true,
      data: { enabled }
    });
    
  } catch (error) {
    logger.error('[AutomationController] toggleWorkspaceAutomation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle workspace automation',
      code: 'AUTOMATION_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// AVAILABLE TRIGGERS & ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/automation/triggers
 * Get list of available triggers
 */
exports.getTriggers = async (req, res) => {
  res.json({
    success: true,
    data: [
      { event: 'conversation.created', label: 'New conversation started', category: 'Conversation' },
      { event: 'customer.message.received', label: 'Customer sends a message', category: 'Message' },
      { event: 'first.agent.reply', label: 'Agent sends first reply', category: 'Message' },
      { event: 'conversation.closed', label: 'Conversation closed', category: 'Conversation' },
      { event: 'conversation.reopened', label: 'Conversation reopened', category: 'Conversation' },
      { event: 'sla.breached', label: 'SLA breach detected', category: 'SLA' },
      { event: 'contact.created', label: 'New contact created', category: 'Contact' },
      { event: 'contact.tag.added', label: 'Tag added to contact', category: 'Contact' },
      { event: 'conversation.assigned', label: 'Conversation assigned', category: 'Conversation' },
      { event: 'deal.stage.changed', label: 'Deal stage changed', category: 'CRM' },
      { event: 'campaign.message.delivered', label: 'Campaign message delivered', category: 'Campaign' },
      { event: 'campaign.message.read', label: 'Campaign message read', category: 'Campaign' },
      { event: 'campaign.message.replied', label: 'Customer replied to campaign', category: 'Campaign' }
    ]
  });
};

/**
 * GET /api/v1/automation/actions
 * Get list of available actions
 */
exports.getActions = async (req, res) => {
  res.json({
    success: true,
    data: [
      { type: 'send_template_message', label: 'Send template message', category: 'Messaging', requiresWindow: false },
      { type: 'send_text_message', label: 'Send text message', category: 'Messaging', requiresWindow: true },
      { type: 'send_media_message', label: 'Send media message', category: 'Messaging', requiresWindow: true },
      { type: 'assign_conversation', label: 'Assign conversation', category: 'Conversation' },
      { type: 'add_tag', label: 'Add tag to contact', category: 'Contact' },
      { type: 'remove_tag', label: 'Remove tag from contact', category: 'Contact' },
      { type: 'create_deal', label: 'Create deal', category: 'CRM' },
      { type: 'move_pipeline_stage', label: 'Move deal to stage', category: 'CRM' },
      { type: 'notify_agent', label: 'Notify agent', category: 'Notification' },
      { type: 'notify_webhook', label: 'Send webhook', category: 'Integration' },
      { type: 'update_contact', label: 'Update contact fields', category: 'Contact' },
      { type: 'add_note', label: 'Add internal note', category: 'Conversation' },
      { type: 'close_conversation', label: 'Close conversation', category: 'Conversation' },
      { type: 'delay', label: 'Wait/Delay', category: 'Flow' }
    ]
  });
};
