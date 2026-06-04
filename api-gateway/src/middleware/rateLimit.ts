import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs?: number; // Default: 15 minutes
  max?: number;      // Default: 100 requests per window
  keyGenerator?: (req: Request) => string;
}

interface RateLimitRecord {
  timestamps: number[];
}

export const rateLimit = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const maxRequests = options.max || 100;
  const keyGenerator = options.keyGenerator || ((req: Request) => req.ip || 'unknown');

  // In-memory store for rate limiting (sliding window)
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired timestamps to prevent memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60 * 1000).unref(); // Run cleanup every minute, unref so it does not block Node exit

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = Date.now();
      const key = keyGenerator(req);
      
      let record = store.get(key);
      if (!record) {
        record = { timestamps: [] };
        store.set(key, record);
      }

      // Filter out timestamps outside the window
      record.timestamps = record.timestamps.filter((timestamp) => now - timestamp < windowMs);

      const current = record.timestamps.length + 1;

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current).toString(),
        'X-RateLimit-Reset': (now + windowMs).toString(),
      });

      if (current > maxRequests) {
        const correlationId = req.headers['x-correlation-id'] || 'unknown';
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

      // Record this request timestamp
      record.timestamps.push(now);
      next();
    } catch (err) {
      console.error('[RateLimit Error]:', err);
      // On internal error, allow request to proceed so rate limiter failure doesn't block users
      next();
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
  keyGenerator: (req: Request) => {
    // Authenticated calls carry JWT. The gateway proxy middleware will run after this rate limiter
    // or rate limiter will check auth token if parsed.
    // For general API rate limit we fallback to IP
    return `api:${req.ip || 'unknown'}`;
  },
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
