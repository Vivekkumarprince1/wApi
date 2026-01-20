/**
 * =============================================================================
 * WEBHOOK ROUTES - META COMPLIANT
 * =============================================================================
 * 
 * Single webhook endpoint for all tenants (BSP model like Interakt).
 * 
 * SECURITY:
 * - X-Hub-Signature-256 verification on all POST requests
 * - Replay attack protection
 * - Fast response (<2 seconds) with async processing via queue
 */

const express = require('express');
const { handler, verify } = require('../controllers/metaWebhookController');
const { 
  captureRawBody, 
  verifyWebhookSignature, 
  replayProtection 
} = require('../middlewares/webhookSecurity');

const router = express.Router();

// =============================================================================
// WEBHOOK VERIFICATION (GET)
// =============================================================================
// Meta sends GET request to verify webhook URL
// No signature verification needed for GET
router.get('/meta', verify);

// =============================================================================
// WEBHOOK HANDLER (POST)
// =============================================================================
// Meta sends POST for all events (messages, status, etc.)
// SECURITY: Full signature verification before processing
router.post('/meta', 
  captureRawBody,           // Capture raw body for signature verification
  verifyWebhookSignature,   // Verify X-Hub-Signature-256
  replayProtection,         // Prevent replay attacks
  handler                   // Process webhook (responds quickly, queues for async)
);

// =============================================================================
// LEGACY ROUTES (for backwards compatibility)
// =============================================================================
router.get('/whatsapp', verify);
router.post('/whatsapp', 
  captureRawBody,
  verifyWebhookSignature,
  replayProtection,
  handler
);

module.exports = router;
