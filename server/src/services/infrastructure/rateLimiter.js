const IORedis = require('ioredis');
const { redisUrl } = require('../config');

const redis = new IORedis(redisUrl);

const EXPIRY_SECONDS = 60; // 1 minute window

/**
 * Check if workspace has exceeded rate limit
 * @param {string} workspaceId 
 * @param {number} limit - Messages per minute
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
async function checkWorkspaceRateLimit(workspaceId, limit = 1000) {
  const key = `ratelimit:workspace:${workspaceId}`;
  
  // Use a simple counter with expiration
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, EXPIRY_SECONDS);
  }
  
  if (current > limit) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl };
  }
  
  return { allowed: true, remaining: limit - current };
}

/**
 * Identify if a campaign should be paused based on error rates or specific Meta errors
 * @param {string} campaignId
 * @param {string} errorCode
 */
async function trackCampaignErrors(campaignId, errorCode) {
  // If we see too many 429s or 500s, specific logic can go here
  if (errorCode === '131056' || errorCode === '131048') { // Spam rate limit
     // Logic to trigger campaign pause
  }
}

module.exports = {
  checkWorkspaceRateLimit,
  trackCampaignErrors
};
