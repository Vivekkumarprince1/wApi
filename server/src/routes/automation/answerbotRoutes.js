const express = require('express');
const router = express.Router({ mergeParams: true });
const answerBotController = require('../../controllers/automation/answerbotController');
const { requireFeature } = require('../../middlewares/infrastructure/featureGate');

/**
 * AnswerBot Routes
 * Base URL: /api/automation/answerbot/:workspaceId
 * Auth middleware is applied by parent router (automationRoutes)
 */

router.use(requireFeature('ANSWERBOT'));

/**
 * POST /api/automation/answerbot/:workspaceId/generate
 * Generate FAQs from website URL
 */
router.post('/:workspaceId/generate', answerBotController.generateFAQs);

/**
 * GET /api/automation/answerbot/:workspaceId/faqs
 * Get all FAQs with optional filters (status, source)
 */
router.get('/:workspaceId/faqs', answerBotController.getFAQs);

/**
 * POST /api/automation/answerbot/:workspaceId/approve
 * Approve FAQs for use in auto-replies
 */
router.post('/:workspaceId/approve', answerBotController.approveFAQs);

/**
 * DELETE /api/automation/answerbot/:workspaceId/faqs/:faqId
 * Delete a FAQ
 */
router.delete('/:workspaceId/faqs/:faqId', answerBotController.deleteFAQ);

/**
 * GET /api/automation/answerbot/:workspaceId/sources
 * Get list of crawled websites
 */
router.get('/:workspaceId/sources', answerBotController.getSources);

/**
 * POST /api/automation/answerbot/:workspaceId/sources
 * Add a new KB Source (URL, text, document)
 */
router.post('/:workspaceId/sources', answerBotController.addSource);

/**
 * GET /api/automation/answerbot/:workspaceId/settings
 * Get bot persona and fallback config
 */
router.get('/:workspaceId/settings', answerBotController.getSettings);

/**
 * PUT /api/automation/answerbot/:workspaceId/settings
 * Update bot persona and fallback config
 */
router.put('/:workspaceId/settings', answerBotController.updateSettings);

module.exports = router;
