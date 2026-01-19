/**
 * BSP Per-Workspace Rate Limiter
 * 
 * Enforces rate limits at the workspace/tenant level for the BSP multi-tenant model.
 * This prevents any single tenant from overwhelming the shared parent WABA.
 * 
 * Rate limits are enforced at multiple levels:
 * 1. Per-second burst limit (prevents flooding)
 * 2. Daily message limit (billing/quota)
 * 3. Monthly message limit (billing/quota)
 * 4. API requests per minute (protects backend)
 * 5. Template submissions per day (Meta limits)
 * 
 * Like Interakt, limits are based on the workspace's plan tier.
 */

const Workspace = require('../models/Workspace');
const bspConfig = require('../config/bspConfig');

// In-memory rate tracking (use Redis for production clusters)
const rateLimitStore = {
  messages: new Map(),    // Per-second message rate
  api: new Map(),         // API requests per minute
  templates: new Map()    // Template submissions per day
};

// Cleanup interval
const CLEANUP_INTERVAL = 60000; // 1 minute

/**
 * ═══════════════════════════════════════════════════════════════════
 * MESSAGE RATE LIMITER
 * Enforces per-second, daily, and monthly message limits
 * ═══════════════════════════════════════════════════════════════════
 */
function createBspMessageRateLimiter() {
  return async (req, res, next) => {
    try {
      if (!req.user?.workspace) {
        return next();
      }
      
      const workspaceId = req.user.workspace.toString();
      
      // Get workspace with BSP config
      const workspace = await Workspace.findById(workspaceId)
        .select('plan bspManaged bspRateLimits bspUsage bspPhoneStatus')
        .lean();
      
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
          code: 'WORKSPACE_NOT_FOUND'
        });
      }
      
      // Skip rate limiting for non-BSP workspaces (backward compatibility)
      if (!workspace.bspManaged) {
        return next();
      }
      
      // Check if phone is rate limited by Meta
      if (workspace.bspPhoneStatus === 'RATE_LIMITED') {
        return res.status(429).json({
          success: false,
          message: 'Your WhatsApp number is rate limited by Meta. Please wait and try again.',
          code: 'META_RATE_LIMITED',
          retryAfter: 3600 // 1 hour
        });
      }
      
      const plan = workspace.plan || 'free';
      
      // Get rate limits (custom overrides or plan-based)
      const messagesPerSecond = workspace.bspRateLimits?.messagesPerSecond ||
        bspConfig.getRateLimit(plan, 'messagesPerSecond');
      const dailyLimit = workspace.bspRateLimits?.dailyMessageLimit ||
        bspConfig.getRateLimit(plan, 'dailyMessageLimit');
      const monthlyLimit = workspace.bspRateLimits?.monthlyMessageLimit ||
        bspConfig.getRateLimit(plan, 'monthlyMessageLimit');
      
      // ═══════════════════════════════════════════════════════════════════
      // CHECK PER-SECOND RATE (Sliding Window)
      // ═══════════════════════════════════════════════════════════════════
      
      const now = Date.now();
      const secondKey = `${workspaceId}:msg:${Math.floor(now / 1000)}`;
      
      if (!rateLimitStore.messages.has(secondKey)) {
        rateLimitStore.messages.set(secondKey, { count: 0, timestamp: now });
      }
      
      const secondWindow = rateLimitStore.messages.get(secondKey);
      secondWindow.count++;
      
      if (secondWindow.count > messagesPerSecond) {
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded: max ${messagesPerSecond} messages/second for ${plan} plan`,
          code: 'RATE_LIMIT_EXCEEDED',
          limit: messagesPerSecond,
          current: secondWindow.count,
          retryAfter: 1,
          limitType: 'per_second'
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // CHECK DAILY LIMIT
      // ═══════════════════════════════════════════════════════════════════
      
      const dailyUsage = workspace.bspUsage?.messagesToday || 0;
      
      if (dailyUsage >= dailyLimit) {
        // Calculate time until midnight reset
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const retryAfter = Math.ceil((midnight - now) / 1000);
        
        return res.status(429).json({
          success: false,
          message: `Daily message limit reached: ${dailyLimit} messages/day for ${plan} plan`,
          code: 'DAILY_LIMIT_EXCEEDED',
          limit: dailyLimit,
          current: dailyUsage,
          retryAfter,
          limitType: 'daily',
          resetAt: midnight.toISOString()
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // CHECK MONTHLY LIMIT
      // ═══════════════════════════════════════════════════════════════════
      
      const monthlyUsage = workspace.bspUsage?.messagesThisMonth || 0;
      
      if (monthlyUsage >= monthlyLimit) {
        // Calculate time until month reset
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
        nextMonth.setHours(0, 0, 0, 0);
        const retryAfter = Math.ceil((nextMonth - now) / 1000);
        
        return res.status(429).json({
          success: false,
          message: `Monthly message limit reached: ${monthlyLimit} messages/month for ${plan} plan`,
          code: 'MONTHLY_LIMIT_EXCEEDED',
          limit: monthlyLimit,
          current: monthlyUsage,
          retryAfter,
          limitType: 'monthly',
          resetAt: nextMonth.toISOString(),
          upgradeUrl: '/dashboard/settings/billing'
        });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // ATTACH RATE LIMIT HEADERS
      // ═══════════════════════════════════════════════════════════════════
      
      res.set('X-RateLimit-Limit-PerSecond', messagesPerSecond.toString());
      res.set('X-RateLimit-Remaining-PerSecond', Math.max(0, messagesPerSecond - secondWindow.count).toString());
      res.set('X-RateLimit-Limit-Daily', dailyLimit.toString());
      res.set('X-RateLimit-Remaining-Daily', Math.max(0, dailyLimit - dailyUsage).toString());
      res.set('X-RateLimit-Limit-Monthly', monthlyLimit.toString());
      res.set('X-RateLimit-Remaining-Monthly', Math.max(0, monthlyLimit - monthlyUsage).toString());
      
      next();
    } catch (err) {
      console.error('[BSP RateLimiter] Error:', err.message);
      next(err);
    }
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * API RATE LIMITER
 * Enforces API requests per minute per workspace
 * ═══════════════════════════════════════════════════════════════════
 */
function createBspApiRateLimiter() {
  return async (req, res, next) => {
    try {
      if (!req.user?.workspace) {
        return next();
      }
      
      const workspaceId = req.user.workspace.toString();
      
      const workspace = await Workspace.findById(workspaceId)
        .select('plan bspManaged bspRateLimits')
        .lean();
      
      if (!workspace || !workspace.bspManaged) {
        return next();
      }
      
      const plan = workspace.plan || 'free';
      const apiLimit = workspace.bspRateLimits?.apiRequestsPerMinute ||
        bspConfig.getRateLimit(plan, 'apiRequestsPerMinute');
      
      const now = Date.now();
      const minuteKey = `${workspaceId}:api:${Math.floor(now / 60000)}`;
      
      if (!rateLimitStore.api.has(minuteKey)) {
        rateLimitStore.api.set(minuteKey, { count: 0, timestamp: now });
      }
      
      const minuteWindow = rateLimitStore.api.get(minuteKey);
      minuteWindow.count++;
      
      if (minuteWindow.count > apiLimit) {
        const retryAfter = Math.ceil((60000 - (now % 60000)) / 1000);
        
        return res.status(429).json({
          success: false,
          message: `API rate limit exceeded: max ${apiLimit} requests/minute for ${plan} plan`,
          code: 'API_RATE_LIMIT_EXCEEDED',
          limit: apiLimit,
          current: minuteWindow.count,
          retryAfter
        });
      }
      
      res.set('X-RateLimit-Limit', apiLimit.toString());
      res.set('X-RateLimit-Remaining', Math.max(0, apiLimit - minuteWindow.count).toString());
      res.set('X-RateLimit-Reset', (Math.floor(now / 60000) * 60000 + 60000).toString());
      
      next();
    } catch (err) {
      console.error('[BSP API RateLimiter] Error:', err.message);
      next(err);
    }
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * TEMPLATE SUBMISSION RATE LIMITER
 * Enforces daily template submission limits per workspace
 * ═══════════════════════════════════════════════════════════════════
 */
function createBspTemplateRateLimiter() {
  return async (req, res, next) => {
    try {
      if (!req.user?.workspace) {
        return next();
      }
      
      const workspaceId = req.user.workspace.toString();
      
      const workspace = await Workspace.findById(workspaceId)
        .select('plan bspManaged bspRateLimits bspUsage')
        .lean();
      
      if (!workspace || !workspace.bspManaged) {
        return next();
      }
      
      const plan = workspace.plan || 'free';
      const templateLimit = workspace.bspRateLimits?.templateSubmissionsPerDay ||
        bspConfig.getRateLimit(plan, 'templateSubmissionsPerDay');
      
      const todaySubmissions = workspace.bspUsage?.templateSubmissionsToday || 0;
      
      if (todaySubmissions >= templateLimit) {
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const retryAfter = Math.ceil((midnight - Date.now()) / 1000);
        
        return res.status(429).json({
          success: false,
          message: `Template submission limit reached: max ${templateLimit} templates/day for ${plan} plan`,
          code: 'TEMPLATE_LIMIT_EXCEEDED',
          limit: templateLimit,
          current: todaySubmissions,
          retryAfter,
          resetAt: midnight.toISOString()
        });
      }
      
      next();
    } catch (err) {
      console.error('[BSP Template RateLimiter] Error:', err.message);
      next(err);
    }
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * QUOTA CHECK MIDDLEWARE
 * Returns current usage without blocking (for UI display)
 * ═══════════════════════════════════════════════════════════════════
 */
async function getBspQuotaStatus(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId)
      .select('plan bspManaged bspRateLimits bspUsage bspPhoneStatus bspQualityRating')
      .lean();
    
    if (!workspace || !workspace.bspManaged) {
      return null;
    }
    
    const plan = workspace.plan || 'free';
    
    const limits = {
      messagesPerSecond: workspace.bspRateLimits?.messagesPerSecond ||
        bspConfig.getRateLimit(plan, 'messagesPerSecond'),
      dailyMessageLimit: workspace.bspRateLimits?.dailyMessageLimit ||
        bspConfig.getRateLimit(plan, 'dailyMessageLimit'),
      monthlyMessageLimit: workspace.bspRateLimits?.monthlyMessageLimit ||
        bspConfig.getRateLimit(plan, 'monthlyMessageLimit'),
      templateSubmissionsPerDay: workspace.bspRateLimits?.templateSubmissionsPerDay ||
        bspConfig.getRateLimit(plan, 'templateSubmissionsPerDay')
    };
    
    const usage = {
      messagesToday: workspace.bspUsage?.messagesToday || 0,
      messagesThisMonth: workspace.bspUsage?.messagesThisMonth || 0,
      templateSubmissionsToday: workspace.bspUsage?.templateSubmissionsToday || 0
    };
    
    return {
      plan,
      limits,
      usage,
      percentages: {
        daily: Math.round((usage.messagesToday / limits.dailyMessageLimit) * 100),
        monthly: Math.round((usage.messagesThisMonth / limits.monthlyMessageLimit) * 100),
        templates: Math.round((usage.templateSubmissionsToday / limits.templateSubmissionsPerDay) * 100)
      },
      status: {
        phoneStatus: workspace.bspPhoneStatus,
        qualityRating: workspace.bspQualityRating
      },
      warnings: generateWarnings(usage, limits)
    };
  } catch (err) {
    console.error('[BSP Quota] Error getting status:', err.message);
    return null;
  }
}

/**
 * Generate warnings based on usage
 */
function generateWarnings(usage, limits) {
  const warnings = [];
  
  const dailyPercent = (usage.messagesToday / limits.dailyMessageLimit) * 100;
  const monthlyPercent = (usage.messagesThisMonth / limits.monthlyMessageLimit) * 100;
  
  if (dailyPercent >= 90) {
    warnings.push({
      type: 'daily_limit',
      severity: dailyPercent >= 100 ? 'critical' : 'warning',
      message: `Daily message limit ${dailyPercent >= 100 ? 'reached' : 'almost reached'} (${Math.round(dailyPercent)}%)`
    });
  }
  
  if (monthlyPercent >= 80) {
    warnings.push({
      type: 'monthly_limit',
      severity: monthlyPercent >= 100 ? 'critical' : 'warning',
      message: `Monthly message limit ${monthlyPercent >= 100 ? 'reached' : 'at ' + Math.round(monthlyPercent) + '%'}`
    });
  }
  
  return warnings;
}

// Periodic cleanup of stale rate limit entries
setInterval(() => {
  const now = Date.now();
  const maxAge = 120000; // 2 minutes
  
  for (const [key, value] of rateLimitStore.messages.entries()) {
    if (now - value.timestamp > maxAge) {
      rateLimitStore.messages.delete(key);
    }
  }
  
  for (const [key, value] of rateLimitStore.api.entries()) {
    if (now - value.timestamp > maxAge) {
      rateLimitStore.api.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

module.exports = {
  createBspMessageRateLimiter,
  createBspApiRateLimiter,
  createBspTemplateRateLimiter,
  getBspQuotaStatus
};
