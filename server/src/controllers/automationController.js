const AutomationRule = require('../models/AutomationRule');
const WorkflowExecution = require('../models/WorkflowExecution');
const Workspace = require('../models/Workspace');

/**
 * ================================================================
 * AUTOMATION/WORKFLOW CONTROLLER
 * ================================================================
 * Full CRUD operations with plan limit enforcement
 */

/**
 * Create workflow
 * POST /api/v1/automations
 */
async function createRule(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { name, description, trigger, condition, actions, dailyExecutionLimit } = req.body;
    
    // ✅ Validate required fields
    if (!name || !trigger || !actions || actions.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, trigger, actions' 
      });
    }
    
    // ✅ Check plan limits - max number of workflows
    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    const maxAutomations = workspaceDoc.limits?.maxAutomations || 3;
    const currentCount = await AutomationRule.countDocuments({ workspace, enabled: true });
    
    if (currentCount >= maxAutomations) {
      return res.status(403).json({ 
        error: `Plan limit exceeded. Maximum ${maxAutomations} workflows allowed.`,
        limit: maxAutomations,
        current: currentCount
      });
    }
    
    // Create workflow
    const rule = await AutomationRule.create({ 
      workspace, 
      name,
      description,
      trigger,
      condition: condition || {},
      actions,
      dailyExecutionLimit,
      createdBy: req.user._id
    });
    
    // Update workspace usage
    if (workspaceDoc.usage) {
      workspaceDoc.usage.automations = (workspaceDoc.usage.automations || 0) + 1;
      await workspaceDoc.save();
    }
    
    res.status(201).json(rule);
  } catch (err) { 
    next(err); 
  }
}

/**
 * List workflows
 * GET /api/v1/automations
 */
async function listRules(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { enabled, trigger } = req.query;
    
    const filter = { workspace };
    if (enabled !== undefined) filter.enabled = enabled === 'true';
    if (trigger) filter.trigger = trigger;
    
    const rules = await AutomationRule.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');
    
    res.json(rules);
  } catch (err) { 
    next(err); 
  }
}

/**
 * Get single workflow
 * GET /api/v1/automations/:id
 */
async function getRule(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;
    
    const rule = await AutomationRule.findOne({ _id: id, workspace })
      .populate('createdBy', 'name email');
    
    if (!rule) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Get execution stats
    const totalExecutions = await WorkflowExecution.countDocuments({ workflow: id });
    const successfulExecutions = await WorkflowExecution.countDocuments({ 
      workflow: id, 
      status: 'completed' 
    });
    const failedExecutions = await WorkflowExecution.countDocuments({ 
      workflow: id, 
      status: 'failed' 
    });
    
    res.json({
      ...rule.toObject(),
      stats: {
        totalExecutions,
        successfulExecutions,
        failedExecutions
      }
    });
  } catch (err) { 
    next(err); 
  }
}

/**
 * Update workflow
 * PUT /api/v1/automations/:id
 */
async function updateRule(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;
    const updates = req.body;
    
    // Don't allow changing workspace
    delete updates.workspace;
    delete updates.createdBy;
    delete updates.executionCount;
    delete updates.successCount;
    delete updates.failureCount;
    
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: id, workspace },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!rule) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json(rule);
  } catch (err) { 
    next(err); 
  }
}

/**
 * Delete workflow
 * DELETE /api/v1/automations/:id
 */
async function deleteRule(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;
    
    const rule = await AutomationRule.findOneAndDelete({ _id: id, workspace });
    
    if (!rule) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Update workspace usage
    const workspaceDoc = await Workspace.findById(workspace);
    if (workspaceDoc && workspaceDoc.usage) {
      workspaceDoc.usage.automations = Math.max(0, (workspaceDoc.usage.automations || 1) - 1);
      await workspaceDoc.save();
    }
    
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) { 
    next(err); 
  }
}

/**
 * Toggle workflow enabled/disabled
 * POST /api/v1/automations/:id/toggle
 */
async function toggleRule(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;
    
    const rule = await AutomationRule.findOne({ _id: id, workspace });
    
    if (!rule) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    rule.enabled = !rule.enabled;
    await rule.save();
    
    res.json(rule);
  } catch (err) { 
    next(err); 
  }
}

/**
 * Get workflow execution history
 * GET /api/v1/automations/:id/executions
 */
async function getExecutions(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;
    const { limit = 50, skip = 0, status } = req.query;
    
    // Verify workflow belongs to workspace
    const rule = await AutomationRule.findOne({ _id: id, workspace });
    if (!rule) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    const filter = { workflow: id };
    if (status) filter.status = status;
    
    const executions = await WorkflowExecution.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('triggerEvent.contactId', 'name phone')
      .populate('triggerEvent.messageId', 'body type');
    
    const total = await WorkflowExecution.countDocuments(filter);
    
    res.json({
      executions,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (err) { 
    next(err); 
  }
}

/**
 * Get workflow analytics
 * GET /api/v1/automations/analytics
 */
async function getAnalytics(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const filter = { workspace };
    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }
    
    // Total workflows
    const totalWorkflows = await AutomationRule.countDocuments(filter);
    const enabledWorkflows = await AutomationRule.countDocuments({ ...filter, enabled: true });
    
    // Execution stats
    const execFilter = { workspace };
    if (Object.keys(dateFilter).length > 0) {
      execFilter.createdAt = dateFilter;
    }
    
    const totalExecutions = await WorkflowExecution.countDocuments(execFilter);
    const successfulExecutions = await WorkflowExecution.countDocuments({ 
      ...execFilter, 
      status: 'completed' 
    });
    const failedExecutions = await WorkflowExecution.countDocuments({ 
      ...execFilter, 
      status: 'failed' 
    });
    
    // Top workflows by execution count
    const topWorkflows = await AutomationRule.find(filter)
      .sort({ executionCount: -1 })
      .limit(10)
      .select('name executionCount successCount failureCount lastExecutedAt');
    
    res.json({
      totalWorkflows,
      enabledWorkflows,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(2) : 0,
      topWorkflows
    });
  } catch (err) { 
    next(err); 
  }
}

module.exports = { 
  createRule, 
  listRules, 
  getRule, 
  updateRule, 
  deleteRule, 
  toggleRule,
  getExecutions,
  getAnalytics
};
