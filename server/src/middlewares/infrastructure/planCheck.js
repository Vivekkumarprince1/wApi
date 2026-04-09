const { Workspace } = require('../../models');

/**
 * Token Expiry Check Middleware
 * Prevents API calls when system user token is expired
 */
async function checkTokenExpiry(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(403).json({
        message: 'Workspace not found',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    // Check if ESB flow is completed (has tokens)
    if (workspace.esbFlow?.status === 'completed' && workspace.esbFlow?.systemUserTokenExpiry) {
      const now = new Date();
      const tokenExpiry = new Date(workspace.esbFlow.systemUserTokenExpiry);

      if (now > tokenExpiry) {
        return res.status(403).json({
          message: 'WhatsApp Business Account token has expired. Please reconnect your account.',
          code: 'TOKEN_EXPIRED',
          action: 'reconnect_account'
        });
      }
    }

    next();
  } catch (err) {
    console.error('Token expiry check error:', err);
    return res.status(500).json({
      message: 'Error checking token expiry',
      code: 'TOKEN_CHECK_ERROR'
    });
  }
}

// Migration Note: hardcoded PLAN_LIMITS removed in favor of DB Plan resolution.

/**
 * Enhanced Plan Check Middleware
 * Enforces plan limits BEFORE allowing resource usage
 * Supports: messages, templates, campaigns, contacts, automations
 */
function planCheck(resource = 'messages', amount = 1) {
  return async (req, res, next) => {
    try {
      const { Plan, Workspace } = require('../../models');
      const workspace = await Workspace.findById(req.user.workspace);

      if (!workspace) {
        return res.status(403).json({
          message: 'Workspace not found',
          code: 'WORKSPACE_NOT_FOUND'
        });
      }

      // Check if usage tracking exists
      if (!workspace.usage) {
        workspace.usage = {
          contacts: 0,
          messagesMonthly: 0,
          messagesDaily: 0,
          templates: 0,
          campaigns: 0,
          automations: 0,
          lastResetDate: new Date(),
          lastMonthlyResetDate: new Date()
        };
      }

      // 1. Resolve Plan from DB
      let plan = null;
      if (workspace.plan && /^[0-9a-fA-F]{24}$/.test(workspace.plan.toString())) {
        plan = await Plan.findById(workspace.plan).lean();
      }

      // Fallback to Starter plan if not found
      if (!plan) {
        plan = await Plan.findOne({ slug: 'starter' }).lean();
      }

      if (!plan) {
        // Absolute fallback if seeding is missing
        plan = {
          name: 'Starter',
          limits: { 
            maxContacts: 1000, 
            maxMessagesPerMonth: 10000, 
            maxAutomations: 2, 
            maxTemplates: 10 
          }
        };
      }

      // Reset counters logic...
      const today = new Date().toDateString();
      const lastReset = workspace.usage.lastResetDate ? new Date(workspace.usage.lastResetDate).toDateString() : null;
      if (lastReset !== today) {
        workspace.usage.messagesDaily = 0;
        workspace.usage.lastResetDate = new Date();
      }

      const thisMonth = new Date().getMonth();
      const lastMonthlyReset = workspace.usage.lastMonthlyResetDate ? new Date(workspace.usage.lastMonthlyResetDate).getMonth() : null;
      if (lastMonthlyReset !== thisMonth) {
        workspace.usage.messagesMonthly = 0;
        workspace.usage.lastMonthlyResetDate = new Date();
      }

      // 2. Enforce Limits...
      let limit = -1;
      let currentUsage = 0;
      let limitType = resource;

      const limits = plan.limits || {};

      switch (resource) {
        case 'messages':
        case 'messaging':
          limit = limits.maxMessagesPerMonth || -1;
          currentUsage = workspace.usage.messagesMonthly || 0;
          limitType = 'monthly messages';
          break;

        case 'templates':
          limit = limits.maxTemplates || -1;
          currentUsage = workspace.usage.templates || 0;
          break;

        case 'campaigns':
          // Often campaigns are a feature, but can be a limit
          limit = limits.maxCampaigns || -1;
          currentUsage = workspace.usage.campaigns || 0;
          break;

        case 'contacts':
          limit = limits.maxContacts || -1;
          currentUsage = workspace.usage.contacts || 0;
          break;

        case 'automations':
          limit = limits.maxAutomations || -1;
          currentUsage = workspace.usage.automations || 0;
          break;

        default:
          limit = -1;
      }

      // Unlimited check
      if (limit === -1) {
        req.remainingQuota = 999999;
        return next();
      }

      // Check if adding 'amount' would exceed limit
      if (currentUsage + amount > limit) {
        return res.status(402).json({
          success: false,
          message: `Plan limit exceeded for ${limitType}. Current: ${currentUsage}/${limit}.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit,
          current: currentUsage,
          upgradeRequired: true
        });
      }

      // Save usage if reset occurred
      if (workspace.isModified('usage')) {
        await workspace.save();
      }

      // Add quota data to request
      req.remainingQuota = limit - currentUsage;
      next();
    } catch (err) {
      console.error('[PlanCheck] Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error checking plan limits',
        code: 'PLAN_CHECK_ERROR'
      });
    }
  };
}

/**
 * Quick check for bulk operations
 * Returns error immediately if bulk amount exceeds remaining quota
 */
function bulkPlanCheck(resource = 'messages') {
  return async (req, res, next) => {
    try {
      const workspace = await Workspace.findById(req.user.workspace);

      if (!workspace) {
        return res.status(403).json({ message: 'Workspace not found' });
      }

      // Determine bulk size from request
      let bulkSize = 0;
      if (req.body.contactIds && Array.isArray(req.body.contactIds)) {
        bulkSize = req.body.contactIds.length;
      } else if (req.body.contacts && Array.isArray(req.body.contacts)) {
        bulkSize = req.body.contacts.length;
      } else if (req.body.recipients && Array.isArray(req.body.recipients)) {
        bulkSize = req.body.recipients.length;
      }

      // Use enhanced planCheck with bulk amount
      return planCheck(resource, bulkSize)(req, res, next);
    } catch (err) {
      console.error('Bulk plan check error:', err);
      return res.status(500).json({ message: 'Error checking plan limits' });
    }
  };
}

module.exports = {
  planCheck,
  bulkPlanCheck,
  checkTokenExpiry
};
