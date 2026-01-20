/**
 * Agent Rate Limiting Service - Stage 4 Hardening
 * 
 * Soft rate limiting for agent messages (safety, not billing):
 * - Per agent: X messages / minute
 * - On exceed: temporarily block, show clear UI error
 */

const Workspace = require('../models/Workspace');

// In-memory rate limit tracking (per agent per workspace)
// Structure: { `${workspaceId}:${agentId}`: { count: number, windowStart: Date } }
const rateLimitStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > 120000) { // 2 minutes old
      rateLimitStore.delete(key);
    }
  }
}, 300000);

/**
 * Check if agent can send a message
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} agentId 
 * @returns {Object} { allowed: boolean, remaining: number, retryAfter: number }
 */
async function checkAgentRateLimit(workspaceId, agentId) {
  try {
    // Get workspace settings
    const workspace = await Workspace.findById(workspaceId)
      .select('inboxSettings')
      .lean();

    // If rate limiting disabled, always allow
    if (!workspace?.inboxSettings?.agentRateLimitEnabled) {
      return { allowed: true, remaining: Infinity };
    }

    const maxPerMinute = workspace.inboxSettings.agentMessagesPerMinute || 30;
    const key = `${workspaceId}:${agentId}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || (now - entry.windowStart) > windowMs) {
      // New window
      entry = {
        count: 0,
        windowStart: now
      };
      rateLimitStore.set(key, entry);
    }

    // Check if over limit
    if (entry.count >= maxPerMinute) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        message: `Rate limit exceeded. Please wait ${retryAfter} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED'
      };
    }

    // Increment and allow
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: maxPerMinute - entry.count,
      usedThisMinute: entry.count
    };

  } catch (err) {
    console.error('[RateLimit] Error checking rate limit:', err.message);
    // On error, allow (fail open for safety)
    return { allowed: true, remaining: -1, error: err.message };
  }
}

/**
 * Get current rate limit status for an agent
 */
async function getAgentRateLimitStatus(workspaceId, agentId) {
  try {
    const workspace = await Workspace.findById(workspaceId)
      .select('inboxSettings')
      .lean();

    if (!workspace?.inboxSettings?.agentRateLimitEnabled) {
      return {
        enabled: false,
        message: 'Rate limiting is disabled'
      };
    }

    const maxPerMinute = workspace.inboxSettings.agentMessagesPerMinute || 30;
    const key = `${workspaceId}:${agentId}`;
    const now = Date.now();
    const windowMs = 60000;

    const entry = rateLimitStore.get(key);

    if (!entry || (now - entry.windowStart) > windowMs) {
      return {
        enabled: true,
        limit: maxPerMinute,
        used: 0,
        remaining: maxPerMinute,
        resetsIn: 60
      };
    }

    const resetsIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);

    return {
      enabled: true,
      limit: maxPerMinute,
      used: entry.count,
      remaining: Math.max(0, maxPerMinute - entry.count),
      resetsIn
    };

  } catch (err) {
    console.error('[RateLimit] Error getting status:', err.message);
    return { enabled: false, error: err.message };
  }
}

/**
 * Reset rate limit for an agent (admin action)
 */
function resetAgentRateLimit(workspaceId, agentId) {
  const key = `${workspaceId}:${agentId}`;
  rateLimitStore.delete(key);
  console.log(`[RateLimit] Reset rate limit for agent ${agentId}`);
  return { success: true };
}

/**
 * Get all rate-limited agents in a workspace
 */
async function getRateLimitedAgents(workspaceId) {
  const workspace = await Workspace.findById(workspaceId)
    .select('inboxSettings')
    .lean();

  if (!workspace?.inboxSettings?.agentRateLimitEnabled) {
    return [];
  }

  const maxPerMinute = workspace.inboxSettings.agentMessagesPerMinute || 30;
  const now = Date.now();
  const windowMs = 60000;
  const limited = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    if (!key.startsWith(`${workspaceId}:`)) continue;
    if ((now - entry.windowStart) > windowMs) continue;
    
    if (entry.count >= maxPerMinute) {
      const agentId = key.split(':')[1];
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      
      limited.push({
        agentId,
        used: entry.count,
        limit: maxPerMinute,
        retryAfter
      });
    }
  }

  return limited;
}

module.exports = {
  checkAgentRateLimit,
  getAgentRateLimitStatus,
  resetAgentRateLimit,
  getRateLimitedAgents
};
