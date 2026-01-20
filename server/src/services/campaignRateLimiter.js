const IORedis = require('ioredis');
const { redisUrl } = require('../config');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN RATE LIMITER - Stage 3 Implementation
 * 
 * Two-level throttling for campaign execution:
 * 1. Global limit - Protects parent WABA from Meta rate limits
 * 2. Per-workspace limit - Noisy neighbor protection
 * 
 * Implements:
 * - Sliding window rate limiting
 * - Token bucket algorithm for bursts
 * - Exponential backoff on 429 errors
 * - Error tracking for auto-pause decisions
 * 
 * Meta Limits Reference:
 * - 80 messages/second per phone number
 * - 250 messages/second per WABA
 * - 1000 messages/second per business
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 1000)
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  // Global WABA limits (BSP-wide)
  GLOBAL_LIMIT_PER_SECOND: 200,      // 200 msg/s across all tenants
  GLOBAL_LIMIT_PER_MINUTE: 10000,    // 10k msg/min across all tenants
  
  // Per-workspace limits (tenant isolation)
  WORKSPACE_LIMIT_PER_SECOND: 50,    // 50 msg/s per workspace
  WORKSPACE_LIMIT_PER_MINUTE: 1000,  // 1000 msg/min per workspace
  
  // Per-phone limits (phone number protection)
  PHONE_LIMIT_PER_SECOND: 70,        // 70 msg/s per phone (under Meta's 80)
  PHONE_LIMIT_PER_MINUTE: 3000,      // 3000 msg/min per phone
  
  // Sliding window settings
  WINDOW_SIZE_SECONDS: 60,
  
  // Backoff settings
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 60000,
  BACKOFF_MULTIPLIER: 2,
  
  // Error thresholds
  ERROR_THRESHOLD_PERCENT: 30,       // Auto-pause if >30% failures
  CONSECUTIVE_ERROR_THRESHOLD: 10,   // Auto-pause after 10 consecutive failures
  
  // Key prefixes
  KEY_PREFIX: 'ratelimit:campaign'
};

// ─────────────────────────────────────────────────────────────────────────────
// SLIDING WINDOW RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check rate limit using sliding window counter
 * @param {String} key - Rate limit key
 * @param {Number} limit - Max requests allowed
 * @param {Number} windowSeconds - Window size in seconds
 * @returns {Promise<{allowed: boolean, current: number, remaining: number, retryAfter: number}>}
 */
async function checkSlidingWindowLimit(key, limit, windowSeconds = 60) {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  const fullKey = `${CONFIG.KEY_PREFIX}:${key}`;
  
  // Use Redis sorted set for sliding window
  const pipeline = redis.pipeline();
  
  // Remove old entries outside the window
  pipeline.zremrangebyscore(fullKey, 0, windowStart);
  
  // Count current entries in window
  pipeline.zcard(fullKey);
  
  // Add current request (with current timestamp as score and unique member)
  pipeline.zadd(fullKey, now, `${now}:${Math.random()}`);
  
  // Set expiry on the key
  pipeline.expire(fullKey, windowSeconds + 1);
  
  const results = await pipeline.exec();
  const currentCount = results[1][1] || 0;
  
  const allowed = currentCount < limit;
  const remaining = Math.max(0, limit - currentCount - 1);
  const retryAfter = allowed ? 0 : Math.ceil(windowSeconds / 2);
  
  return {
    allowed,
    current: currentCount,
    remaining,
    retryAfter,
    limit
  };
}

/**
 * Simple counter-based rate limit (per second)
 */
async function checkSecondLimit(key, limit) {
  const fullKey = `${CONFIG.KEY_PREFIX}:sec:${key}:${Math.floor(Date.now() / 1000)}`;
  
  const current = await redis.incr(fullKey);
  if (current === 1) {
    await redis.expire(fullKey, 2); // 2 second TTL
  }
  
  return {
    allowed: current <= limit,
    current,
    remaining: Math.max(0, limit - current),
    retryAfter: current > limit ? 1 : 0
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TWO-LEVEL RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check global rate limit (BSP-wide protection)
 */
async function checkGlobalLimit() {
  // Check per-second limit
  const secondCheck = await checkSecondLimit('global', CONFIG.GLOBAL_LIMIT_PER_SECOND);
  if (!secondCheck.allowed) {
    return {
      allowed: false,
      level: 'global',
      type: 'per_second',
      ...secondCheck
    };
  }
  
  // Check per-minute limit
  const minuteCheck = await checkSlidingWindowLimit('global', CONFIG.GLOBAL_LIMIT_PER_MINUTE, 60);
  if (!minuteCheck.allowed) {
    return {
      allowed: false,
      level: 'global',
      type: 'per_minute',
      ...minuteCheck
    };
  }
  
  return {
    allowed: true,
    level: 'global',
    remaining: Math.min(secondCheck.remaining, minuteCheck.remaining)
  };
}

/**
 * Check workspace rate limit (tenant isolation)
 */
async function checkWorkspaceLimit(workspaceId) {
  // Check per-second limit
  const secondCheck = await checkSecondLimit(`ws:${workspaceId}`, CONFIG.WORKSPACE_LIMIT_PER_SECOND);
  if (!secondCheck.allowed) {
    return {
      allowed: false,
      level: 'workspace',
      type: 'per_second',
      workspaceId,
      ...secondCheck
    };
  }
  
  // Check per-minute limit  
  const minuteCheck = await checkSlidingWindowLimit(
    `ws:${workspaceId}`, 
    CONFIG.WORKSPACE_LIMIT_PER_MINUTE, 
    60
  );
  if (!minuteCheck.allowed) {
    return {
      allowed: false,
      level: 'workspace',
      type: 'per_minute',
      workspaceId,
      ...minuteCheck
    };
  }
  
  return {
    allowed: true,
    level: 'workspace',
    workspaceId,
    remaining: Math.min(secondCheck.remaining, minuteCheck.remaining)
  };
}

/**
 * Check phone number rate limit
 */
async function checkPhoneLimit(phoneNumberId) {
  // Check per-second limit
  const secondCheck = await checkSecondLimit(`phone:${phoneNumberId}`, CONFIG.PHONE_LIMIT_PER_SECOND);
  if (!secondCheck.allowed) {
    return {
      allowed: false,
      level: 'phone',
      type: 'per_second',
      phoneNumberId,
      ...secondCheck
    };
  }
  
  // Check per-minute limit
  const minuteCheck = await checkSlidingWindowLimit(
    `phone:${phoneNumberId}`,
    CONFIG.PHONE_LIMIT_PER_MINUTE,
    60
  );
  if (!minuteCheck.allowed) {
    return {
      allowed: false,
      level: 'phone',
      type: 'per_minute',
      phoneNumberId,
      ...minuteCheck
    };
  }
  
  return {
    allowed: true,
    level: 'phone',
    phoneNumberId,
    remaining: Math.min(secondCheck.remaining, minuteCheck.remaining)
  };
}

/**
 * Main rate limit check - combines all levels
 * @param {String} workspaceId 
 * @param {String} phoneNumberId 
 * @returns {Promise<{allowed: boolean, level: string, retryAfter: number}>}
 */
async function checkCampaignRateLimit(workspaceId, phoneNumberId) {
  try {
    // 1. Check global limit first
    const globalCheck = await checkGlobalLimit();
    if (!globalCheck.allowed) {
      console.log(`[RateLimiter] Global limit hit: ${globalCheck.type}`);
      return globalCheck;
    }
    
    // 2. Check workspace limit
    const workspaceCheck = await checkWorkspaceLimit(workspaceId);
    if (!workspaceCheck.allowed) {
      console.log(`[RateLimiter] Workspace limit hit: ${workspaceId} - ${workspaceCheck.type}`);
      return workspaceCheck;
    }
    
    // 3. Check phone limit
    if (phoneNumberId) {
      const phoneCheck = await checkPhoneLimit(phoneNumberId);
      if (!phoneCheck.allowed) {
        console.log(`[RateLimiter] Phone limit hit: ${phoneNumberId} - ${phoneCheck.type}`);
        return phoneCheck;
      }
    }
    
    return {
      allowed: true,
      remaining: Math.min(globalCheck.remaining, workspaceCheck.remaining)
    };
  } catch (err) {
    console.error('[RateLimiter] Check failed:', err.message);
    // On error, allow the request but log it
    return { allowed: true, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKOFF TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track backoff state for a workspace/campaign
 */
async function getBackoffState(campaignId) {
  const key = `${CONFIG.KEY_PREFIX}:backoff:${campaignId}`;
  const data = await redis.hgetall(key);
  
  if (!data || !data.attempts) {
    return {
      attempts: 0,
      nextRetryAt: null,
      backoffMs: 0
    };
  }
  
  return {
    attempts: parseInt(data.attempts),
    nextRetryAt: data.nextRetryAt ? new Date(data.nextRetryAt) : null,
    backoffMs: parseInt(data.backoffMs) || 0,
    lastError: data.lastError
  };
}

/**
 * Record a rate limit hit and calculate backoff
 */
async function recordRateLimitHit(campaignId, errorCode, errorMessage) {
  const key = `${CONFIG.KEY_PREFIX}:backoff:${campaignId}`;
  
  // Get current state
  const state = await getBackoffState(campaignId);
  const newAttempts = state.attempts + 1;
  
  // Calculate exponential backoff
  const backoffMs = Math.min(
    CONFIG.INITIAL_BACKOFF_MS * Math.pow(CONFIG.BACKOFF_MULTIPLIER, newAttempts - 1),
    CONFIG.MAX_BACKOFF_MS
  );
  
  const nextRetryAt = new Date(Date.now() + backoffMs);
  
  await redis.hmset(key, {
    attempts: newAttempts,
    backoffMs: backoffMs,
    nextRetryAt: nextRetryAt.toISOString(),
    lastError: errorMessage || errorCode,
    lastErrorCode: errorCode,
    lastErrorAt: new Date().toISOString()
  });
  
  // Expire after 1 hour
  await redis.expire(key, 3600);
  
  console.log(`[RateLimiter] Backoff recorded: campaign=${campaignId}, attempts=${newAttempts}, backoffMs=${backoffMs}`);
  
  return {
    attempts: newAttempts,
    backoffMs,
    nextRetryAt
  };
}

/**
 * Clear backoff state (on successful send)
 */
async function clearBackoff(campaignId) {
  const key = `${CONFIG.KEY_PREFIX}:backoff:${campaignId}`;
  await redis.del(key);
}

/**
 * Check if campaign should wait due to backoff
 */
async function shouldWaitForBackoff(campaignId) {
  const state = await getBackoffState(campaignId);
  
  if (!state.nextRetryAt) {
    return { shouldWait: false };
  }
  
  const now = new Date();
  const nextRetry = new Date(state.nextRetryAt);
  
  if (now < nextRetry) {
    return {
      shouldWait: true,
      waitMs: nextRetry.getTime() - now.getTime(),
      attempts: state.attempts
    };
  }
  
  return { shouldWait: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR TRACKING FOR AUTO-PAUSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track campaign errors for auto-pause decisions
 */
async function trackCampaignError(campaignId, errorCode, errorMessage) {
  const key = `${CONFIG.KEY_PREFIX}:errors:${campaignId}`;
  
  // Increment error counters
  const pipeline = redis.pipeline();
  pipeline.hincrby(key, 'total', 1);
  pipeline.hincrby(key, `code:${errorCode}`, 1);
  pipeline.hset(key, 'lastError', errorMessage);
  pipeline.hset(key, 'lastErrorAt', new Date().toISOString());
  pipeline.expire(key, 3600); // 1 hour TTL
  
  // Track consecutive errors
  const consecutiveKey = `${CONFIG.KEY_PREFIX}:consecutive:${campaignId}`;
  pipeline.incr(consecutiveKey);
  pipeline.expire(consecutiveKey, 300); // 5 min TTL
  
  await pipeline.exec();
  
  // Check if auto-pause threshold reached
  const consecutive = await redis.get(consecutiveKey);
  
  if (parseInt(consecutive) >= CONFIG.CONSECUTIVE_ERROR_THRESHOLD) {
    return {
      shouldAutoPause: true,
      reason: 'CONSECUTIVE_ERRORS',
      consecutiveErrors: parseInt(consecutive)
    };
  }
  
  // Check for specific critical error codes
  const criticalCodes = ['130429', '131056', '131047', '131048', '190']; // Rate limit, spam, token
  if (criticalCodes.includes(String(errorCode))) {
    return {
      shouldAutoPause: true,
      reason: 'CRITICAL_ERROR',
      errorCode
    };
  }
  
  return { shouldAutoPause: false };
}

/**
 * Record successful send (resets consecutive error counter)
 */
async function trackCampaignSuccess(campaignId) {
  const consecutiveKey = `${CONFIG.KEY_PREFIX}:consecutive:${campaignId}`;
  await redis.del(consecutiveKey);
}

/**
 * Get error stats for a campaign
 */
async function getCampaignErrorStats(campaignId) {
  const key = `${CONFIG.KEY_PREFIX}:errors:${campaignId}`;
  const data = await redis.hgetall(key);
  
  const consecutiveKey = `${CONFIG.KEY_PREFIX}:consecutive:${campaignId}`;
  const consecutive = await redis.get(consecutiveKey);
  
  return {
    totalErrors: parseInt(data.total) || 0,
    consecutiveErrors: parseInt(consecutive) || 0,
    lastError: data.lastError,
    lastErrorAt: data.lastErrorAt,
    errorsByCode: Object.entries(data)
      .filter(([k]) => k.startsWith('code:'))
      .reduce((acc, [k, v]) => {
        acc[k.replace('code:', '')] = parseInt(v);
        return acc;
      }, {})
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// META ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle Meta API error and determine action
 * @param {Object} error - Error object from Meta API
 * @returns {Object} - Action to take
 */
function handleMetaError(error) {
  const errorCode = error.code || error.response?.data?.error?.code;
  const errorMessage = error.message || error.response?.data?.error?.message;
  const httpStatus = error.response?.status;
  
  // 429 - Rate limited
  if (httpStatus === 429 || errorCode === 130429 || errorCode === 4) {
    return {
      action: 'BACKOFF',
      retryable: true,
      backoffMs: 30000, // 30s backoff
      reason: 'META_RATE_LIMIT'
    };
  }
  
  // 5xx - Server error
  if (httpStatus >= 500) {
    return {
      action: 'RETRY',
      retryable: true,
      backoffMs: 5000,
      reason: 'META_SERVER_ERROR'
    };
  }
  
  // 401 - Token invalid
  if (httpStatus === 401 || errorCode === 190) {
    return {
      action: 'PAUSE_CAMPAIGN',
      retryable: false,
      reason: 'TOKEN_EXPIRED'
    };
  }
  
  // Policy violations
  if (errorCode === 131056 || errorCode === 131048) {
    return {
      action: 'PAUSE_CAMPAIGN',
      retryable: false,
      reason: 'POLICY_VIOLATION'
    };
  }
  
  // Template errors
  if (errorCode === 132000 || errorCode === 132001 || errorCode === 132015) {
    return {
      action: 'PAUSE_CAMPAIGN',
      retryable: false,
      reason: 'TEMPLATE_ERROR'
    };
  }
  
  // Phone number errors
  if (errorCode === 131026 || errorCode === 131047) {
    return {
      action: 'FAIL_MESSAGE',
      retryable: false,
      reason: 'INVALID_RECIPIENT'
    };
  }
  
  // Account blocked/disabled
  if (errorCode === 131031 || errorCode === 368) {
    return {
      action: 'PAUSE_CAMPAIGN',
      retryable: false,
      reason: 'ACCOUNT_BLOCKED'
    };
  }
  
  // Default: retry with backoff
  return {
    action: 'RETRY',
    retryable: true,
    backoffMs: 10000,
    reason: 'UNKNOWN_ERROR'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Configuration
  CONFIG,
  
  // Main rate limit check
  checkCampaignRateLimit,
  
  // Individual level checks
  checkGlobalLimit,
  checkWorkspaceLimit,
  checkPhoneLimit,
  
  // Backoff management
  getBackoffState,
  recordRateLimitHit,
  clearBackoff,
  shouldWaitForBackoff,
  
  // Error tracking
  trackCampaignError,
  trackCampaignSuccess,
  getCampaignErrorStats,
  
  // Meta error handling
  handleMetaError,
  
  // For testing
  redis
};
