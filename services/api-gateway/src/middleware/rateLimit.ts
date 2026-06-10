import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

// Create a single Redis client for rate limiting
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('[RateLimit Redis Client Error]:', err);
});

interface RateLimitOptions {
  windowMs?: number; // Default: 15 minutes
  max?: number;      // Default: 100 requests per window
  keyGenerator?: (req: Request) => string;
}

export const rateLimit = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const maxRequests = options.max || 100;
  const keyGenerator = options.keyGenerator || ((req: Request) => req.ip || 'unknown');

  return async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] || 'unknown';
    const key = `rate:${keyGenerator(req)}`;

    try {
      const now = Date.now();
      const clearBefore = now - windowMs;

      // Sliding window log using Redis sorted sets (ZADD, ZREMRANGEBYSCORE, ZCARD, EXPIRE)
      const pipeline = redis.multi();
      pipeline.zadd(key, now, now);
      pipeline.zremrangebyscore(key, 0, clearBefore);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      // Check results for errors. In ioredis exec() returns array of [err, result]
      const cardResult = results[2];
      if (cardResult[0]) {
        throw cardResult[0];
      }

      const current = cardResult[1] as number;

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
        'X-RateLimit-Reset': (now + windowMs).toString(),
      });

      if (current > maxRequests) {
        console.warn(`[RateLimit] Limit exceeded for key: ${key}. Path: ${req.path}. Current: ${current}, Max: ${maxRequests}. (Correlation ID: ${correlationId})`);
        
        return res.status(429).set({
          'Retry-After': Math.ceil(windowMs / 1000).toString(),
        }).json({
          success: false,
          error: 'Too many requests',
          errorCode: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000),
          correlationId,
        });
      }

      next();
    } catch (err: any) {
      console.error('[RateLimit Error]:', err);
      // Fail-closed security control: Block traffic if rate limit verification fails
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Rate limiting validation failed. Service temporarily unavailable.',
        correlationId,
      });
    }
  };
};

/**
 * Stricter rate limit for authentication endpoints (100 attempts per 15 minutes)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req: Request) => {
    const body = req.body || {};
    const identifier = body.email || body.phone || req.ip || 'unknown';
    return `auth:${identifier}`;
  },
});

/**
 * General API rate limit for gateway endpoints (1000 requests per minute)
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: (req: Request) => `api:${req.ip || 'unknown'}`,
});

/**
 * Bulk operations can be expensive and fan out into background work. Keep this
 * separate from the general API limiter so imports/sends cannot starve the API.
 */
export const bulkRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req: Request) => `bulk:${req.header('x-user-id') || req.ip || 'unknown'}`,
});
