const IORedis = require('ioredis');
const { redisUrl } = require('../config');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN LOCK SERVICE - Task A
 * 
 * Distributed Redis lock to prevent duplicate campaign execution:
 * - Acquired before starting a campaign
 * - Survives API restarts
 * - Released only when campaign completes/fails
 * - Prevents race conditions in multi-instance deployments
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Dedicated Redis connection for locks
const redis = new IORedis(redisUrl, {
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 5) return null;
    return Math.min(times * 100, 2000);
  }
});

redis.on('error', (err) => {
  console.error('[CampaignLock] Redis error:', err.message);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LOCK_PREFIX = 'campaign:lock:execution:';
const LOCK_TTL_SECONDS = 24 * 60 * 60; // 24 hours max lock duration (safety)
const LOCK_EXTEND_THRESHOLD = 60 * 60; // Extend if < 1 hour remaining

// ─────────────────────────────────────────────────────────────────────────────
// LOCK FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acquire execution lock for a campaign
 * @param {String} campaignId - Campaign ID
 * @param {Object} options - Lock options
 * @returns {Object} { acquired, lockKey, owner, existingOwner }
 */
async function acquireCampaignLock(campaignId, options = {}) {
  const { 
    ownerId = process.pid.toString(),
    ttlSeconds = LOCK_TTL_SECONDS
  } = options;
  
  const lockKey = `${LOCK_PREFIX}${campaignId}`;
  const lockValue = JSON.stringify({
    ownerId,
    acquiredAt: new Date().toISOString(),
    hostname: process.env.HOSTNAME || 'unknown',
    pid: process.pid
  });
  
  try {
    // Try to set lock with NX (only if not exists)
    const result = await redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
    
    if (result === 'OK') {
      console.log(`[CampaignLock] Acquired lock for campaign: ${campaignId}`);
      return {
        acquired: true,
        lockKey,
        owner: ownerId
      };
    }
    
    // Lock exists - check who owns it
    const existingLock = await redis.get(lockKey);
    let existingOwner = null;
    
    if (existingLock) {
      try {
        existingOwner = JSON.parse(existingLock);
      } catch {
        existingOwner = { raw: existingLock };
      }
    }
    
    console.log(`[CampaignLock] Lock already held for campaign: ${campaignId}`, existingOwner);
    
    return {
      acquired: false,
      lockKey,
      owner: null,
      existingOwner,
      reason: 'LOCK_ALREADY_HELD'
    };
  } catch (error) {
    console.error(`[CampaignLock] Error acquiring lock for campaign ${campaignId}:`, error.message);
    return {
      acquired: false,
      lockKey,
      error: error.message,
      reason: 'LOCK_ERROR'
    };
  }
}

/**
 * Release execution lock for a campaign
 * @param {String} campaignId - Campaign ID
 * @param {Object} options - Release options
 * @returns {Object} { released, reason }
 */
async function releaseCampaignLock(campaignId, options = {}) {
  const { ownerId = process.pid.toString(), force = false } = options;
  const lockKey = `${LOCK_PREFIX}${campaignId}`;
  
  try {
    if (force) {
      // Force release (admin override)
      const result = await redis.del(lockKey);
      console.log(`[CampaignLock] Force released lock for campaign: ${campaignId}`);
      return { released: result > 0, forced: true };
    }
    
    // Check ownership before releasing
    const existingLock = await redis.get(lockKey);
    if (!existingLock) {
      return { released: true, reason: 'LOCK_NOT_FOUND' };
    }
    
    let lockData;
    try {
      lockData = JSON.parse(existingLock);
    } catch {
      // Invalid lock data - release it
      await redis.del(lockKey);
      return { released: true, reason: 'INVALID_LOCK_DATA' };
    }
    
    // Verify ownership
    if (lockData.ownerId !== ownerId) {
      console.warn(`[CampaignLock] Cannot release lock - owner mismatch. Expected: ${ownerId}, Actual: ${lockData.ownerId}`);
      return {
        released: false,
        reason: 'OWNER_MISMATCH',
        actualOwner: lockData.ownerId
      };
    }
    
    // Release lock
    const result = await redis.del(lockKey);
    console.log(`[CampaignLock] Released lock for campaign: ${campaignId}`);
    return { released: result > 0 };
  } catch (error) {
    console.error(`[CampaignLock] Error releasing lock for campaign ${campaignId}:`, error.message);
    return {
      released: false,
      error: error.message,
      reason: 'RELEASE_ERROR'
    };
  }
}

/**
 * Check if campaign has an active execution lock
 * @param {String} campaignId - Campaign ID
 * @returns {Object} { locked, lockInfo, ttlRemaining }
 */
async function checkCampaignLock(campaignId) {
  const lockKey = `${LOCK_PREFIX}${campaignId}`;
  
  try {
    const [lockValue, ttl] = await Promise.all([
      redis.get(lockKey),
      redis.ttl(lockKey)
    ]);
    
    if (!lockValue) {
      return { locked: false };
    }
    
    let lockInfo;
    try {
      lockInfo = JSON.parse(lockValue);
    } catch {
      lockInfo = { raw: lockValue };
    }
    
    return {
      locked: true,
      lockInfo,
      ttlRemaining: ttl,
      lockKey
    };
  } catch (error) {
    console.error(`[CampaignLock] Error checking lock for campaign ${campaignId}:`, error.message);
    return {
      locked: false,
      error: error.message
    };
  }
}

/**
 * Extend lock TTL if campaign is still running
 * Called periodically by worker to prevent lock expiry during long campaigns
 * @param {String} campaignId - Campaign ID
 * @param {String} ownerId - Owner ID for verification
 * @returns {Object} { extended, newTtl }
 */
async function extendCampaignLock(campaignId, ownerId = process.pid.toString()) {
  const lockKey = `${LOCK_PREFIX}${campaignId}`;
  
  try {
    // Get current lock and verify ownership
    const existingLock = await redis.get(lockKey);
    if (!existingLock) {
      return { extended: false, reason: 'LOCK_NOT_FOUND' };
    }
    
    let lockData;
    try {
      lockData = JSON.parse(existingLock);
    } catch {
      return { extended: false, reason: 'INVALID_LOCK_DATA' };
    }
    
    if (lockData.ownerId !== ownerId) {
      return { extended: false, reason: 'OWNER_MISMATCH' };
    }
    
    // Extend TTL
    const result = await redis.expire(lockKey, LOCK_TTL_SECONDS);
    
    if (result === 1) {
      console.log(`[CampaignLock] Extended lock for campaign: ${campaignId}`);
      return { extended: true, newTtl: LOCK_TTL_SECONDS };
    }
    
    return { extended: false, reason: 'EXPIRE_FAILED' };
  } catch (error) {
    console.error(`[CampaignLock] Error extending lock for campaign ${campaignId}:`, error.message);
    return { extended: false, error: error.message };
  }
}

/**
 * Get all active campaign locks (for debugging/admin)
 * @returns {Array} List of active locks
 */
async function getAllActiveLocks() {
  try {
    const keys = await redis.keys(`${LOCK_PREFIX}*`);
    
    if (keys.length === 0) {
      return [];
    }
    
    const locks = [];
    for (const key of keys) {
      const [value, ttl] = await Promise.all([
        redis.get(key),
        redis.ttl(key)
      ]);
      
      const campaignId = key.replace(LOCK_PREFIX, '');
      let lockInfo;
      try {
        lockInfo = JSON.parse(value);
      } catch {
        lockInfo = { raw: value };
      }
      
      locks.push({
        campaignId,
        lockKey: key,
        lockInfo,
        ttlRemaining: ttl
      });
    }
    
    return locks;
  } catch (error) {
    console.error('[CampaignLock] Error getting all locks:', error.message);
    return [];
  }
}

/**
 * Force release all locks for a workspace (emergency use)
 * @param {String} workspaceId - Workspace ID (not directly used, for logging)
 * @param {Array} campaignIds - Array of campaign IDs to unlock
 * @returns {Object} { released, failed }
 */
async function forceReleaseWorkspaceLocks(workspaceId, campaignIds) {
  const results = { released: [], failed: [] };
  
  for (const campaignId of campaignIds) {
    const result = await releaseCampaignLock(campaignId, { force: true });
    if (result.released) {
      results.released.push(campaignId);
    } else {
      results.failed.push({ campaignId, reason: result.reason });
    }
  }
  
  console.log(`[CampaignLock] Force released ${results.released.length} locks for workspace: ${workspaceId}`);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core functions
  acquireCampaignLock,
  releaseCampaignLock,
  checkCampaignLock,
  extendCampaignLock,
  
  // Admin functions
  getAllActiveLocks,
  forceReleaseWorkspaceLocks,
  
  // Constants
  LOCK_PREFIX,
  LOCK_TTL_SECONDS,
  LOCK_EXTEND_THRESHOLD,
  
  // Redis instance (for testing)
  redis
};
