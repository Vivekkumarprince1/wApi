const Workspace = require('../models/Workspace');

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    messagesDaily: 1000,
    messagesMonthly: 30000,
    templates: 5,
    campaigns: 5,
    contacts: 1000,
    automations: 3
  },
  basic: {
    messagesDaily: 10000,
    messagesMonthly: 300000,
    templates: 25,
    campaigns: 10,
    contacts: 10000,
    automations: 10
  },
  premium: {
    messagesDaily: 100000,
    messagesMonthly: 3000000,
    templates: 100,
    campaigns: -1, // unlimited
    contacts: 100000,
    automations: 50
  },
  enterprise: {
    messagesDaily: -1, // unlimited
    messagesMonthly: -1, // unlimited
    templates: -1,
    campaigns: -1,
    contacts: -1,
    automations: -1
  }
};

// Get current usage and limits for the workspace
async function getUsageAndLimits(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const plan = workspace.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    const usage = {
      messages: workspace.usage.messages || 0,
      messagesDaily: workspace.usage.messagesDaily || 0,
      messagesThisMonth: workspace.usage.messagesThisMonth || 0,
      templates: workspace.usage.templates || 0,
      campaigns: workspace.usage.campaigns || 0,
      contacts: workspace.usage.contacts || 0,
      automations: workspace.usage.automations || 0,
      lastResetDate: workspace.usage.lastResetDate,
      lastMonthlyResetDate: workspace.usage.lastMonthlyResetDate
    };

    // Calculate percentage used for each resource
    const percentages = {};
    for (const [key, limit] of Object.entries(limits)) {
      if (limit === -1) {
        percentages[key] = 0; // unlimited
      } else {
        const current = usage[key] || 0;
        percentages[key] = Math.min(100, Math.round((current / limit) * 100));
      }
    }

    return res.json({
      plan,
      limits,
      usage,
      percentages,
      warnings: {
        messagesDaily: percentages.messagesDaily >= 80,
        messagesMonthly: percentages.messagesMonthly >= 80,
        templates: percentages.templates >= 80,
        campaigns: percentages.campaigns >= 80,
        contacts: percentages.contacts >= 80,
        automations: percentages.automations >= 80
      }
    });
  } catch (err) {
    next(err);
  }
}

// Reset daily/monthly counters (admin only)
async function resetUsageCounters(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { type } = req.body; // 'daily' or 'monthly'

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (type === 'daily') {
      workspace.usage.messagesDaily = 0;
      workspace.usage.lastResetDate = new Date();
    } else if (type === 'monthly') {
      workspace.usage.messagesThisMonth = 0;
      workspace.usage.lastMonthlyResetDate = new Date();
    } else {
      return res.status(400).json({ message: 'Invalid reset type. Use "daily" or "monthly"' });
    }

    await workspace.save();

    return res.json({
      success: true,
      message: `${type} counters reset successfully`,
      usage: workspace.usage
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsageAndLimits,
  resetUsageCounters
};
