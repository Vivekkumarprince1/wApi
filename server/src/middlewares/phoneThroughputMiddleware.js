const PhoneThroughputLimiter = require('../services/phoneThroughputLimiter');
const Workspace = require('../models/Workspace');
const { logger } = require('../utils/logger');

/**
 * Middleware: Enforce phone throughput limits
 * Checks: per-phone-per-workspace rate limits based on plan
 */

let limiter = null;

/**
 * Initialize limiter with Redis client
 */
function initializePhoneThroughputMiddleware(redisConnection) {
  limiter = new PhoneThroughputLimiter(redisConnection);
  logger.info('[PhoneThroughputMiddleware] Initialized with Redis');
}

/**
 * Middleware: Check phone throughput limit
 */
async function checkPhoneThroughput(req, res, next) {
  try {
    if (!limiter) {
      logger.warn('[PhoneThroughputMiddleware] Limiter not initialized, skipping');
      return next();
    }

    const workspaceId = req.user.workspace;
    const { phoneNumberId } = req.body;

    if (!phoneNumberId) {
      return next(); // No phone ID, skip
    }

    // Get workspace plan
    const workspace = await Workspace.findById(workspaceId).select('plan phoneNumbers');
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const plan = workspace.plan || 'starter';

    // Check limit
    const checkResult = await limiter.checkLimit(workspaceId, phoneNumberId, plan);

    if (!checkResult.allowed) {
      logger.warn('[PhoneThroughputMiddleware] Rate limit exceeded:', {
        workspaceId,
        phoneNumberId,
        plan,
        limit: checkResult.limit,
        current: checkResult.current,
      });

      return res.status(429).json({
        error: 'Phone throughput limit exceeded',
        plan,
        limit: checkResult.limit,
        remaining: 0,
        resetAt: new Date(checkResult.resetAt),
      });
    }

    // Add to response headers for client awareness
    res.set('X-RateLimit-Remaining', checkResult.remaining.toString());
    res.set('X-RateLimit-Reset', new Date(checkResult.resetAt).toISOString());

    next();
  } catch (error) {
    logger.error('[PhoneThroughputMiddleware] Error:', error);
    next(); // Fail-open: allow request on error
  }
}

module.exports = {
  initializePhoneThroughputMiddleware,
  checkPhoneThroughput,
};
