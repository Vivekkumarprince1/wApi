const redis = require('redis');
const { logger } = require('../utils/logger');

/**
 * PHONE THROUGHPUT RATE LIMITER
 * 
 * Risk: Customer can spam messages and violate Meta's throughput limits (80 messages/sec per phone)
 * Solution: Track messages per phone number per workspace, enforce plan-based limits
 * 
 * Implementation:
 * - Per phone number, per workspace tracking
 * - Different limits for each plan (starter, pro, enterprise)
 * - Sliding window: count messages in last 60 seconds
 * - Hard limit: Return 429 Too Many Requests
 * 
 * Meta Limits:
 * - 80 messages/sec maximum
 * - Typical plan: starter (10/sec), pro (30/sec), enterprise (80/sec)
 */

class PhoneThroughputLimiter {
  constructor(redisClient) {
    this.redis = redisClient;
    this.planLimits = {
      free: { messagesPerSecond: 1, burstSize: 2 },
      starter: { messagesPerSecond: 10, burstSize: 20 },
      pro: { messagesPerSecond: 30, burstSize: 60 },
      enterprise: { messagesPerSecond: 80, burstSize: 160 },
    };
  }

  /**
   * Check if phone can send message
   * Returns: { allowed: boolean, remaining: number, resetAt: timestamp }
   */
  async checkLimit(workspaceId, phoneNumberId, plan = 'starter') {
    if (!this.redis) {
      logger.warn('[PhoneThroughputLimiter] Redis not available, skipping limit check');
      return { allowed: true, remaining: Infinity };
    }

    try {
      const key = `phone-throughput:${workspaceId}:${phoneNumberId}`;
      const limit = this.planLimits[plan] || this.planLimits.starter;

      // Get current count
      const current = await this.redis.incr(key);

      // Set expiry on first increment
      if (current === 1) {
        await this.redis.expire(key, 1); // 1-second window
      }

      // Get time until reset
      const ttl = await this.redis.ttl(key);

      if (current <= limit.messagesPerSecond) {
        return {
          allowed: true,
          remaining: limit.messagesPerSecond - current,
          resetAt: Date.now() + ttl * 1000,
        };
      }

      // Exceeded limit
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + ttl * 1000,
        limit: limit.messagesPerSecond,
        current,
      };
    } catch (error) {
      logger.error('[PhoneThroughputLimiter] checkLimit failed:', error);
      // On Redis error, allow request (fail-open)
      return { allowed: true, remaining: Infinity };
    }
  }

  /**
   * Reset limit for phone (admin action)
   */
  async resetLimit(workspaceId, phoneNumberId) {
    if (!this.redis) {
      logger.warn('[PhoneThroughputLimiter] Redis not available');
      return;
    }

    try {
      const key = `phone-throughput:${workspaceId}:${phoneNumberId}`;
      await this.redis.del(key);

      logger.info('[PhoneThroughputLimiter] Limit reset:', {
        workspaceId,
        phoneNumberId,
      });
    } catch (error) {
      logger.error('[PhoneThroughputLimiter] resetLimit failed:', error);
    }
  }

  /**
   * Get current usage for phone
   */
  async getUsage(workspaceId, phoneNumberId) {
    if (!this.redis) {
      return { current: 0, remaining: Infinity };
    }

    try {
      const key = `phone-throughput:${workspaceId}:${phoneNumberId}`;
      const current = await this.redis.get(key);
      const ttl = await this.redis.ttl(key);

      return {
        current: parseInt(current || 0),
        ttl: Math.max(0, ttl),
        resetAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
      };
    } catch (error) {
      logger.error('[PhoneThroughputLimiter] getUsage failed:', error);
      return { current: 0, remaining: Infinity };
    }
  }
}

module.exports = PhoneThroughputLimiter;
