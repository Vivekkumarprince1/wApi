/**
 * =============================================================================
 * WEBHOOK ROUTES - GUPSHUP
 * =============================================================================
 * 
 * Single webhook endpoint for all tenants (BSP model like Interakt).
 * 
 * SECURITY:
 * - Source IP allowlist
 * - Replay attack protection
 * - Fast response (<2 seconds) with async processing via queue
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { handler, verify } = require('../../controllers/bsp/gupshupWebhookController');
const { 
  verifyWebhookIp,
  replayProtection 
} = require('../../middlewares/infrastructure/webhookSecurity');

const router = express.Router();

// Higher limit for provider webhooks (avoid throttling)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(webhookLimiter);

// =============================================================================
// WEBHOOK HEALTH (GET)
// =============================================================================
router.get('/gupshup', verify);

// =============================================================================
// WEBHOOK HANDLER (POST)
// =============================================================================
router.post('/gupshup', 
  verifyWebhookIp,
  replayProtection,
  handler                   // Process webhook (responds quickly, queues for async)
);

router.get('/whatsapp', verify);
router.post('/whatsapp', verifyWebhookIp, replayProtection, handler);

module.exports = router;
