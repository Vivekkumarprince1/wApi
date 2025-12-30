const crypto = require('crypto');

/**
 * In-memory idempotency cache
 * In production, replace with Redis or database
 */
const idempotencyCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate idempotency key from request data
 * @param {string} operation - Operation name (e.g., 'esb_callback')
 * @param {object} data - Request data
 * @returns {string} - Idempotency key
 */
function generateIdempotencyKey(operation, data) {
  const dataString = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return `${operation}:${hash}`;
}

/**
 * Check if operation already processed
 * @param {string} key - Idempotency key
 * @returns {object|null} - Cached result or null
 */
function checkIdempotency(key) {
  const cached = idempotencyCache.get(key);
  
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    idempotencyCache.delete(key);
    return null;
  }
  
  return cached.result;
}

/**
 * Store idempotent operation result
 * @param {string} key - Idempotency key
 * @param {object} result - Operation result
 */
function storeIdempotencyResult(key, result) {
  idempotencyCache.set(key, {
    result,
    timestamp: Date.now()
  });
}

/**
 * Cleanup expired cache entries (call periodically)
 */
function cleanupIdempotencyCache() {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      idempotencyCache.delete(key);
    }
  }
}

// Cleanup every hour
setInterval(cleanupIdempotencyCache, 60 * 60 * 1000);

module.exports = {
  generateIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
  cleanupIdempotencyCache
};
