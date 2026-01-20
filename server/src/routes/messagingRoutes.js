/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MESSAGING ROUTES
 * 
 * Routes for sending WhatsApp messages (templates, text, media).
 * All routes are workspace-scoped and require authentication.
 * 
 * STAGE 1 REQUIREMENT: Phone must be CONNECTED before sending messages.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck } = require('../middlewares/planCheck');
const { requirePhoneActivation } = require('../middlewares/phoneActivation');
const {
  sendTemplateMessage,
  sendTemplateBulk,
  listSendableTemplates,
  getTemplateForSending,
  previewTemplate,
  sendTemplateToContact,
  getTemplateStats
} = require('../controllers/templateSendingController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE SENDING ROUTES
// All sending routes require Stage 1 completion (phone CONNECTED)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a template message to a single recipient
 * POST /api/v1/messages/template
 * REQUIRES: Phone activation (Stage 1 complete)
 */
router.post(
  '/template',
  requirePhoneActivation,
  planCheck('messages', 1),
  sendTemplateMessage
);

/**
 * Send template to multiple recipients (bulk)
 * POST /api/v1/messages/template/bulk
 * REQUIRES: Phone activation (Stage 1 complete)
 */
router.post(
  '/template/bulk',
  requirePhoneActivation,
  planCheck('messages', 1),
  sendTemplateBulk
);

/**
 * Preview template with variables (without sending)
 * POST /api/v1/messages/template/preview
 * No activation required - preview only
 */
router.post('/template/preview', previewTemplate);

/**
 * Send template to a specific contact
 * POST /api/v1/messages/template/contact/:contactId
 * REQUIRES: Phone activation (Stage 1 complete)
 */
router.post(
  '/template/contact/:contactId',
  requirePhoneActivation,
  planCheck('messages', 1),
  sendTemplateToContact
);

/**
 * Get template send statistics
 * GET /api/v1/messages/template/stats
 */
router.get('/template/stats', getTemplateStats);

/**
 * List templates available for sending (approved only)
 * GET /api/v1/messages/templates
 * No activation required - read only
 */
router.get('/templates', listSendableTemplates);

/**
 * Get template info for sending (variables required, preview)
 * GET /api/v1/messages/template/:id
 */
router.get('/template/:id', getTemplateForSending);

module.exports = router;
