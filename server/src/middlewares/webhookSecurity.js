/**
 * =============================================================================
 * WEBHOOK SIGNATURE VERIFICATION MIDDLEWARE - META COMPLIANCE
 * =============================================================================
 * 
 * X-Hub-Signature-256 verification for incoming Meta webhooks.
 * 
 * REQUIREMENTS:
 * 1. Verify HMAC-SHA256 signature on ALL webhook requests
 * 2. Reject invalid signatures with 403
 * 3. Log security events for audit
 * 4. Respond within 20 seconds (we target <2 seconds)
 * 
 * This middleware MUST be applied before the webhook handler.
 */

const crypto = require('crypto');
const bspConfig = require('../config/bspConfig');
const WebhookLog = require('../models/WebhookLog');

// =============================================================================
// CONFIGURATION
// =============================================================================

// Skip verification in test mode (not recommended for production)
const SKIP_VERIFICATION = process.env.SKIP_WEBHOOK_SIGNATURE === 'true';

// Max age for webhook timestamps (prevent replay attacks)
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

/**
 * Verify X-Hub-Signature-256 header
 * @param {string|Buffer} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header value
 * @param {string} secret - App secret for HMAC
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  // Parse signature header (format: sha256=<hash>)
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    console.error('[WebhookSecurity] Invalid signature format');
    return false;
  }

  const providedHash = parts[1];

  // Compute expected hash
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedHash, 'utf-8'),
      Buffer.from(expectedHash, 'utf-8')
    );
  } catch (error) {
    console.error('[WebhookSecurity] Signature comparison failed:', error.message);
    return false;
  }
}

// =============================================================================
// RAW BODY CAPTURE MIDDLEWARE
// =============================================================================

/**
 * Middleware to capture raw body for signature verification
 * Must be used BEFORE json parser for webhook routes
 */
function captureRawBody(req, res, next) {
  let data = '';
  
  req.setEncoding('utf8');
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    
    // Also parse JSON
    try {
      req.body = JSON.parse(data || '{}');
    } catch (e) {
      req.body = {};
    }
    
    next();
  });
  
  req.on('error', (error) => {
    console.error('[WebhookSecurity] Body capture error:', error.message);
    next(error);
  });
}

// =============================================================================
// VERIFICATION MIDDLEWARE
// =============================================================================

/**
 * Webhook signature verification middleware
 * Verifies X-Hub-Signature-256 and rejects invalid requests
 */
async function verifyWebhookSignature(req, res, next) {
  const startTime = Date.now();
  const signatureHeader = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-delivery-id'] || null;

  // Skip verification if explicitly disabled (development only)
  if (SKIP_VERIFICATION) {
    console.warn('[WebhookSecurity] ⚠️ Signature verification SKIPPED (dev mode)');
    return next();
  }

  // Get app secret
  const appSecret = bspConfig.appSecret || process.env.META_APP_SECRET;
  
  if (!appSecret) {
    console.error('[WebhookSecurity] ❌ No app secret configured - cannot verify webhooks');
    
    // Log the failure
    try {
      await WebhookLog.create({
        deliveryId,
        payload: req.body,
        verified: false,
        signatureHeader,
        error: 'No app secret configured',
        processed: false,
        bspRouted: false,
        securityEvent: 'CONFIG_ERROR'
      });
    } catch (logErr) {
      console.error('[WebhookSecurity] Failed to log:', logErr.message);
    }

    // In production, reject. In dev, warn and continue
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Webhook verification not configured' });
    }
    
    console.warn('[WebhookSecurity] ⚠️ Continuing without verification (non-production)');
    return next();
  }

  // Check for signature header
  if (!signatureHeader) {
    console.error('[WebhookSecurity] ❌ Missing X-Hub-Signature-256 header');
    
    // Log security event
    try {
      await WebhookLog.create({
        deliveryId,
        payload: req.body,
        verified: false,
        signatureHeader: null,
        error: 'Missing signature header',
        processed: false,
        bspRouted: false,
        securityEvent: 'MISSING_SIGNATURE'
      });
    } catch (logErr) {
      console.error('[WebhookSecurity] Failed to log:', logErr.message);
    }

    return res.status(403).json({ error: 'Missing signature' });
  }

  // Get raw body for verification
  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error('[WebhookSecurity] ❌ Missing raw body for signature verification');
    return res.status(400).json({ error: 'Missing raw body' });
  }

  // Verify signature
  const isValid = verifySignature(rawBody, signatureHeader, appSecret);

  if (!isValid) {
    console.error('[WebhookSecurity] ❌ Invalid signature');
    console.error('[WebhookSecurity] Header:', signatureHeader.substring(0, 20) + '...');
    
    // Log security event (potential attack)
    try {
      await WebhookLog.create({
        deliveryId,
        payload: req.body,
        verified: false,
        signatureHeader: signatureHeader.substring(0, 50), // Truncate for security
        error: 'Invalid signature',
        processed: false,
        bspRouted: false,
        securityEvent: 'INVALID_SIGNATURE',
        sourceIp: req.ip || req.connection?.remoteAddress
      });
    } catch (logErr) {
      console.error('[WebhookSecurity] Failed to log:', logErr.message);
    }

    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Signature verified
  const verificationTime = Date.now() - startTime;
  console.log(`[WebhookSecurity] ✅ Signature verified in ${verificationTime}ms`);

  // Attach verification info to request
  req.webhookVerified = true;
  req.webhookVerifiedAt = new Date();
  req.deliveryId = deliveryId;

  next();
}

// =============================================================================
// REPLAY PROTECTION (OPTIONAL)
// =============================================================================

const { getRedis } = require('../config/redis');

// TTL for replay protection (Meta delivery IDs)
const REPLAY_TTL_SECONDS = 300; // 5 minutes

/**
 * Check for replay attacks using delivery ID
 * @param {string} deliveryId - X-Delivery-ID header
 * @returns {boolean} - True if this is a replay
 */
async function isReplayAttack(deliveryId) {
  if (!deliveryId) return false;

  try {
    const redis = getRedis();
    const key = `webhook:delivery:${deliveryId}`;
    const result = await redis.set(key, Date.now().toString(), {
      NX: true,
      EX: REPLAY_TTL_SECONDS
    });

    if (result !== 'OK') {
      console.warn('[WebhookSecurity] ⚠️ Potential replay attack:', deliveryId);
      return true;
    }

    return false;
  } catch (err) {
    // Fail open if Redis is unavailable, but log for visibility
    console.warn('[WebhookSecurity] Replay protection unavailable:', err.message);
    return false;
  }
}

/**
 * Middleware to check for replay attacks
 */
async function replayProtection(req, res, next) {
  const deliveryId = req.headers['x-delivery-id'];

  if (deliveryId && await isReplayAttack(deliveryId)) {
    console.error('[WebhookSecurity] ❌ Replay attack detected:', deliveryId);
    return res.status(403).json({ error: 'Duplicate delivery' });
  }

  next();
}

// =============================================================================
// COMBINED MIDDLEWARE
// =============================================================================

/**
 * Complete webhook security middleware stack
 * Combines signature verification and replay protection
 */
const webhookSecurityMiddleware = [
  captureRawBody,
  verifyWebhookSignature,
  replayProtection
];

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  verifySignature,
  captureRawBody,
  verifyWebhookSignature,
  replayProtection,
  isReplayAttack,
  webhookSecurityMiddleware
};
