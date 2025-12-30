const Workspace = require('../models/Workspace');

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

// Centralized plan limits configuration
const PLAN_LIMITS = {
  free: {
    messagesDaily: 1000,
    messagesMonthly: 30000,
    templates: 5,
    campaigns: 5,
    contacts: 1000,
    automations: 3,
    products: 10
  },
  basic: {
    messagesDaily: 10000,
    messagesMonthly: 300000,
    templates: 25,
    campaigns: 10,
    contacts: 10000,
    automations: 10,
    products: 50
  },
  premium: {
    messagesDaily: 100000,
    messagesMonthly: 3000000,
    templates: 100,
    campaigns: -1,
    contacts: 100000,
    automations: 50,
    products: 500
  },
  enterprise: {
    messagesDaily: -1,
    messagesMonthly: -1,
    templates: -1,
    campaigns: -1,
    contacts: -1,
    automations: -1,
    products: -1
  }
};

/**
 * Enhanced Plan Check Middleware
 * Enforces plan limits BEFORE allowing resource usage
 * Supports: messages, templates, campaigns, contacts, automations
 */
function planCheck(resource = 'messages', amount = 1) {
  return async (req, res, next) => {
    try {
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
          messages: 0,
          messagesDaily: 0,
          messagesThisMonth: 0,
          templates: 0,
          campaigns: 0,
          automations: 0,
          lastResetDate: new Date(),
          lastMonthlyResetDate: new Date()
        };
      }

      // Reset daily counter if needed
      const today = new Date().toDateString();
      const lastReset = workspace.usage.lastResetDate ? new Date(workspace.usage.lastResetDate).toDateString() : null;
      if (lastReset !== today) {
        workspace.usage.messagesDaily = 0;
        workspace.usage.lastResetDate = new Date();
        await workspace.save();
      }

      // Reset monthly counter if needed
      const thisMonth = new Date().getMonth();
      const lastMonthlyReset = workspace.usage.lastMonthlyResetDate ? new Date(workspace.usage.lastMonthlyResetDate).getMonth() : null;
      if (lastMonthlyReset !== thisMonth) {
        workspace.usage.messagesThisMonth = 0;
        workspace.usage.lastMonthlyResetDate = new Date();
        await workspace.save();
      }

      // Get plan-based limits
      const plan = workspace.plan || 'free';
      const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      
      // Determine limit based on resource type
      let limit;
      let currentUsage;
      let limitType;

      switch (resource) {
        case 'messages':
        case 'messaging':
          // Check daily messaging limit
          limit = planLimits.messagesDaily;
          currentUsage = workspace.usage.messagesDaily || 0;
          limitType = 'daily messages';
          
          // Enterprise has unlimited (-1)
          if (limit === -1) {
            req.remainingQuota = 999999;
            return next();
          }
          break;

        case 'templates':
          limit = planLimits.templates;
          currentUsage = workspace.usage.templates || 0;
          limitType = 'templates';
          
          if (limit === -1) {
            req.remainingQuota = 999999;
            return next();
          }
          break;

        case 'campaigns':
          limit = planLimits.campaigns;
          currentUsage = workspace.usage.campaigns || 0;
          limitType = 'campaigns';
          
          if (limit === -1) {
            req.remainingQuota = 999999;
            return next();
          }
          break;

        case 'contacts':
          limit = planLimits.contacts;
          currentUsage = workspace.usage.contacts || 0;
          limitType = 'contacts';
          
          if (limit === -1) {
            req.remainingQuota = 999999;
            return next();
          }
          break;

        case 'automations':
          limit = planLimits.automations;
          currentUsage = workspace.usage.automations || 0;
          limitType = 'automations';
          
          if (limit === -1) {
            req.remainingQuota = 999999;
            return next();
          }
          break;

        case 'products':
          limit = planLimits.products;
          currentUsage = workspace.usage.products || 0;
          limitType = 'products';
          
          if (limit === -1) {
            req.remainingQuota = 999999;
            return next();
          }
          break;

        default:
          return res.status(400).json({ 
            message: 'Invalid resource type',
            code: 'INVALID_RESOURCE'
          });
      }

      // Check if adding 'amount' would exceed limit
      if (currentUsage + amount > limit) {
        return res.status(402).json({
          message: `Plan limit exceeded for ${limitType}`,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit: limit,
          current: currentUsage,
          requested: amount,
          plan: workspace.plan,
          upgradeRequired: true
        });
      }

      // Add remaining quota to request for controllers to use
      req.remainingQuota = limit - currentUsage;
      req.planLimit = limit;
      req.currentUsage = currentUsage;

      next();
    } catch (err) {
      console.error('Plan check error:', err);
      return res.status(500).json({ 
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
