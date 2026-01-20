/**
 * Automation Engine Routes - Stage 6
 * 
 * Comprehensive automation API:
 * - Rule CRUD
 * - Execution logs
 * - Testing/dry-run
 * - Engine status
 */

const express = require('express');
const auth = require('../middlewares/auth');
const automationController = require('../controllers/automationEngineController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════
// RULE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// List all automation rules
router.get('/rules', automationController.listRules);

// Get single rule
router.get('/rules/:ruleId', automationController.getRule);

// Create new rule
router.post('/rules', automationController.createRule);

// Update rule
router.put('/rules/:ruleId', automationController.updateRule);

// Delete rule
router.delete('/rules/:ruleId', automationController.deleteRule);

// Toggle rule enabled/disabled
router.patch('/rules/:ruleId/toggle', automationController.toggleRule);

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION LOGS
// ═══════════════════════════════════════════════════════════════════════════

// Get execution logs
router.get('/logs', automationController.getLogs);

// Get execution statistics
router.get('/logs/stats', automationController.getLogStats);

// Get single execution detail
router.get('/logs/:executionId', automationController.getLogDetail);

// ═══════════════════════════════════════════════════════════════════════════
// TESTING & SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

// Test/dry-run a rule
router.post('/test', automationController.testRule);

// Simulate an event
router.post('/simulate', automationController.simulateEvent);

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CONTROL & STATUS
// ═══════════════════════════════════════════════════════════════════════════

// Get automation status
router.get('/status', automationController.getStatus);

// Toggle workspace automation
router.post('/workspace/toggle', automationController.toggleWorkspaceAutomation);

// ═══════════════════════════════════════════════════════════════════════════
// REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════════════

// Get available triggers
router.get('/triggers', automationController.getTriggers);

// Get available actions
router.get('/actions', automationController.getActions);

module.exports = router;
