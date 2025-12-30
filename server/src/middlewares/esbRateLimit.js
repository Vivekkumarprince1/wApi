const rateLimit = require('express-rate-limit');

/**
 * ESB Callback Rate Limiter
 * Prevents brute force attempts on ESB callback processing
 */
const esbCallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 10, // Max 10 callback attempts per IP per 15 minutes
  message: 'Too many ESB callback attempts. Please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for successful (already processed) callbacks
    // This allows the frontend to gracefully handle redirects
    if (req.query.callback_received === 'true') {
      return true;
    }
    return false;
  }
});

/**
 * ESB Processing Rate Limiter
 * Prevents spam on ESB process endpoints (stricter limits)
 */
const esbProcessLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minute window
  max: 5, // Max 5 processing attempts per IP per 5 minutes
  message: 'Too many ESB processing attempts. Please try again later.',
  standardHeaders: true,
  keyGenerator: (req, res) => {
    // Rate limit by workspace ID if authenticated, otherwise by IP
    return req.user?.workspace || req.ip;
  }
});

module.exports = {
  esbCallbackLimiter,
  esbProcessLimiter
};
