/**
 * Workspace-Level Rate Limiting
 * Prevents noisy neighbor problem
 * Per-workspace limits based on plan
 */

const Workspace = require('../models/Workspace');

const LIMITS_BY_PLAN = {
  free: { points: 100, duration: 60 },       // 100 req/min
  basic: { points: 500, duration: 60 },      // 500 req/min
  premium: { points: 2000, duration: 60 },   // 2000 req/min
  enterprise: { points: 10000, duration: 60 }
};

const MESSAGE_LIMITS_BY_PLAN = {
  free: { points: 10, duration: 1 },        // 10 msg/sec
  basic: { points: 50, duration: 1 },       // 50 msg/sec
  premium: { points: 200, duration: 1 },    // 200 msg/sec
  enterprise: { points: 1000, duration: 1 }
};

/**
 * Create workspace-scoped rate limiter
 * Uses in-memory counter with workspace ID as key
 */
function createWorkspaceRateLimiter(limitType = 'api') {
  // In-memory store for dev (use Redis in production)
  const counters = new Map();
  const CLEANUP_INTERVAL = 60000; // Cleanup every minute

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of counters.entries()) {
      if (now - data.resetTime > 65000) {
        counters.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);

  return async (req, res, next) => {
    try {
      if (!req.user?.workspace) return next();

      const workspace = await Workspace.findById(req.user.workspace)
        .select('plan')
        .lean();

      if (!workspace) {
        return res.status(403).json({
          success: false,
          message: 'Workspace not found',
          code: 'WORKSPACE_NOT_FOUND'
        });
      }

      const plan = workspace.plan || 'free';
      const limits = limitType === 'messaging'
        ? MESSAGE_LIMITS_BY_PLAN[plan]
        : LIMITS_BY_PLAN[plan];

      const workspaceId = req.user.workspace.toString();
      const now = Date.now();
      const windowId = `${workspaceId}:${limitType}:${Math.floor(now / (limits.duration * 1000))}`;

      // Initialize or get counter
      if (!counters.has(windowId)) {
        counters.set(windowId, {
          count: 0,
          resetTime: now
        });
      }

      const counter = counters.get(windowId);
      counter.count++;

      // Check limit
      if (counter.count > limits.points) {
        const retryAfter = Math.ceil((counter.resetTime + limits.duration * 1000 - now) / 1000);

        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded for plan: ${plan}`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
          limit: limits.points,
          current: counter.count,
          plan,
          window: `${limits.duration}s`
        });
      }

      // Attach rate limit info to response
      res.set('X-RateLimit-Limit', limits.points.toString());
      res.set('X-RateLimit-Remaining', (limits.points - counter.count).toString());
      res.set('X-RateLimit-Reset', (counter.resetTime + limits.duration * 1000).toString());

      next();
    } catch (err) {
      console.error('[WorkspaceRateLimit] Error:', err.message);
      next(); // Don't block on rate limit errors
    }
  };
}

/**
 * Check throughput for specific phone number
 * Meta has tier-based limits per phone
 */
async function checkPhoneThroughput(phoneNumberId, quality_rating = 'UNKNOWN') {
  const tierMap = {
    'HIGH': 'tier_3',     // 400 msg/sec
    'MEDIUM': 'tier_2',   // 160 msg/sec
    'LOW': 'tier_1',      // 80 msg/sec
    'UNKNOWN': 'tier_1'
  };

  const tier = tierMap[quality_rating] || 'tier_1';

  const limits = {
    tier_1: { perSecond: 80, perMinute: 1000, perHour: 10000 },
    tier_2: { perSecond: 160, perMinute: 2000, perHour: 100000 },
    tier_3: { perSecond: 400, perMinute: 5000, perHour: 500000 }
  };

  return {
    tier,
    limits: limits[tier],
    quality_rating
  };
}

module.exports = {
  createWorkspaceRateLimiter,
  checkPhoneThroughput,
  LIMITS_BY_PLAN,
  MESSAGE_LIMITS_BY_PLAN
};
