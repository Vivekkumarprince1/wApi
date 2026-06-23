/**
 * Rate Limiting Middleware
 * Prevent API abuse with request throttling
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { getSharedRedis } from '../utils/ioredis';

// Reuse the shared Redis client so we don't open yet another connection
// for rate limiting (the shared client also has an error handler wired).
const redis = getSharedRedis();

const RATE_LIMIT_REDIS_TIMEOUT_MS = Number(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS || 750);

async function withRedisTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${RATE_LIMIT_REDIS_TIMEOUT_MS}ms`));
        }, RATE_LIMIT_REDIS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Simple rate limiter using Redis
 */
export const rateLimit = (options: {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response) => void;
} = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const maxRequests = options.max || 100;
  const skipSuccessful = options.skipSuccessfulRequests || false;
  const skipFailed = options.skipFailedRequests || false;
  const keyGenerator = options.keyGenerator || ((req: Request) => req.ip || 'unknown');

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (redis.status !== 'ready') {
        console.warn('[RateLimit] Redis is not ready, bypassing rate limit for:', req.path);
        return next();
      }

      const key = `rate-limit:${keyGenerator(req)}`;
      const current = await withRedisTimeout(redis.incr(key), 'rate-limit incr');

      if (current === 1) {
        // Set expiration on first request
        await withRedisTimeout(redis.expire(key, Math.ceil(windowMs / 1000)), 'rate-limit expire');
      }

      // Store in response for later use
      (res as any).rateLimitInfo = {
        current,
        limit: maxRequests,
        resetTime: Date.now() + windowMs
      };

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
        'X-RateLimit-Reset': (Date.now() + windowMs).toString()
      });

      if (current > maxRequests) {
        res.status(429).set({
          'Retry-After': Math.ceil(windowMs / 1000).toString()
        }).json({
          success: false,
          error: 'Too many requests',
          errorCode: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
        
        if (options.onLimitReached) {
          options.onLimitReached(req, res);
        }
        return;
      }

      next();
    } catch (err) {
      console.error('[RateLimit Error]:', err);
      // On error, allow request to proceed
      next();
    }
  };
};

/**
 * Stricter rate limit for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 attempts
  keyGenerator: (req: Request) => {
    // Use email or phone from body if available
    const body = (req as any).body || {};
    return `auth:${body.email || body.phone || req.ip}`;
  }
});

/**
 * API rate limit for authenticated users
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute for local dev
  keyGenerator: (req: Request) => {
    const authReq = req as AuthRequest;
    return `api:${authReq.user?._id || authReq.ip}`;
  }
});

/**
 * Bulk operation rate limit (more lenient)
 */
export const bulkRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 bulk operations per hour
  keyGenerator: (req: Request) => {
    const authReq = req as AuthRequest;
    return `bulk:${authReq.user?._id || authReq.ip}`;
  }
});

/**
 * Export rate limit (more lenient)
 */
export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour
  keyGenerator: (req: Request) => {
    const authReq = req as AuthRequest;
    return `export:${authReq.user?._id || authReq.ip}`;
  }
});

/**
 * Advanced rate limiter with bypass for admins
 */
export const rateLimitWithBypass = (options: any = {}) => {
  const limitMiddleware = rateLimit(options);

  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    // Bypass for admins
    if (authReq.role === 'owner' || authReq.role === 'admin' || authReq.user?.role === 'super_admin') {
      return next();
    }

    limitMiddleware(req, res, next);
  };
};

/**
 * Distributed rate limiter (for multi-server setups)
 */
export const distributedRateLimit = (options: {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
} = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (redis.status !== 'ready') {
        return next();
      }

      const key = `distributed-rate-limit:${options.keyGenerator?.(req) || req.ip}`;
      const windowMs = options.windowMs || 15 * 60 * 1000;
      const maxRequests = options.max || 100;

      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      const results = await withRedisTimeout(pipeline.exec(), 'distributed-rate-limit pipeline');
      
      const current = (results?.[0]?.[1] as number) || 0;

      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString()
      });

      if (current > maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          errorCode: 'RATE_LIMIT_EXCEEDED'
        });
      }

      next();
    } catch (err) {
      console.error('[DistributedRateLimit Error]:', err);
      next();
    }
  };
};

/**
 * Redis connection health check
 */
export async function checkRateLimitHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (err) {
    console.error('[RateLimit] Redis connection failed:', err);
    return false;
  }
}

/**
 * Get rate limit stats for a user
 */
export async function getRateLimitStats(key: string) {
  try {
    const count = await redis.get(key);
    const ttl = await redis.ttl(key);
    return {
      count: parseInt(count || '0'),
      ttl
    };
  } catch (err) {
    console.error('[RateLimit] Error getting stats:', err);
    return null;
  }
}

/**
 * Reset rate limit for a key
 */
export async function resetRateLimit(key: string) {
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.error('[RateLimit] Error resetting:', err);
    return false;
  }
}
