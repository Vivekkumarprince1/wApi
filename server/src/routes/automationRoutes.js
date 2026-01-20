/**
 * Automation Routes - Stage 6
 * 
 * Automation engine API:
 * - POST   /api/v1/automation/rules                    - Create rule
 * - GET    /api/v1/automation/rules                    - List rules
 * - GET    /api/v1/automation/rules/:ruleId            - Get single rule
 * - PUT    /api/v1/automation/rules/:ruleId            - Update rule
 * - DELETE /api/v1/automation/rules/:ruleId            - Delete rule
 * - PATCH  /api/v1/automation/rules/:ruleId/enable     - Enable/disable rule
 * - GET    /api/v1/automation/logs                     - Get execution logs
 * - GET    /api/v1/automation/logs/:logId              - Get single log
 * - GET    /api/v1/automation/stats                    - Get execution stats
 * - GET    /api/v1/automation/failures                 - Get failure analysis
 * - POST   /api/v1/automation/test                     - Test rule (dry-run)
 * - GET    /api/v1/automation/status                   - Get automation status
 * - PATCH  /api/v1/automation/workspace/enable         - Enable/disable workspace automation
 * - PATCH  /api/v1/automation/kill-switch              - Global kill-switch (admin only)
 */

const express = require('express');
const auth = require('../middlewares/auth');
const automationController = require('../controllers/automationController');
const answerBotRoutes = require('./answerbotRoutes');

const router = express.Router();

// All routes require authentication
router.use(auth);

// AnswerBot routes (nested under /api/v1/automation/answerbot)
router.use('/answerbot', answerBotRoutes);

// ═══════════════════════════════════════════════════════════════════════════
// RULE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Get all rules
router.get('/rules', automationController.getRules);

// Create rule
router.post('/rules', automationController.createRule);

// Get single rule
router.get('/rules/:ruleId', automationController.getRule);

// Update rule
router.put('/rules/:ruleId', automationController.updateRule);

// Delete rule
router.delete('/rules/:ruleId', automationController.deleteRule);

// Enable/disable rule
router.patch('/rules/:ruleId/enable', automationController.toggleRuleEnabled);

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION LOGS
// ═══════════════════════════════════════════════════════════════════════════

// Get execution logs
router.get('/logs', automationController.getLogs);

// Get single log
router.get('/logs/:logId', automationController.getLog);

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

// Get execution stats
router.get('/stats', automationController.getStats);

// Get failure analysis
router.get('/failures', automationController.getFailures);

// ═══════════════════════════════════════════════════════════════════════════
// TESTING
// ═══════════════════════════════════════════════════════════════════════════

// Test rule (dry-run)
router.post('/test', automationController.testRule);

// ═══════════════════════════════════════════════════════════════════════════
// STATUS & CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

// Get automation status
router.get('/status', automationController.getStatus);

// Enable/disable workspace automation
router.patch('/workspace/enable', automationController.toggleWorkspaceAutomation);

// Global kill-switch (admin only)
router.patch('/kill-switch', automationController.toggleGlobalKillSwitch);

module.exports = router;
