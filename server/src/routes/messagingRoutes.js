/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MESSAGING ROUTES
 * 
 * Routes for sending WhatsApp messages (templates, text, media).
 * All routes are workspace-scoped and require authentication.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck } = require('../middlewares/planCheck');
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
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a template message to a single recipient
 * POST /api/v1/messages/template
 */
router.post(
  '/template',
  planCheck('messages', 1),
  sendTemplateMessage
);

/**
 * Send template to multiple recipients (bulk)
 * POST /api/v1/messages/template/bulk
 */
router.post(
  '/template/bulk',
  planCheck('messages', 1),
  sendTemplateBulk
);

/**
 * Preview template with variables (without sending)
 * POST /api/v1/messages/template/preview
 */
router.post('/template/preview', previewTemplate);

/**
 * Send template to a specific contact
 * POST /api/v1/messages/template/contact/:contactId
 */
router.post(
  '/template/contact/:contactId',
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
 */
router.get('/templates', listSendableTemplates);

/**
 * Get template info for sending (variables required, preview)
 * GET /api/v1/messages/template/:id
 */
router.get('/template/:id', getTemplateForSending);

module.exports = router;
