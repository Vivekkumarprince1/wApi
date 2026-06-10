import { Router } from 'express';
import * as AutomationEngineController from '../controllers/AutomationEngineController';
import { authenticate, internalAuth } from '../middleware/auth';

const router = Router();

// Dashboard & Management (User Protected)
router.get('/rules', authenticate, AutomationEngineController.getRules);
router.get('/rules/:id', authenticate, AutomationEngineController.getRuleById);
router.post('/rules', authenticate, AutomationEngineController.createRule);
router.patch('/rules/:id', authenticate, AutomationEngineController.updateRule);
router.put('/rules/:id', authenticate, AutomationEngineController.updateRule);
router.patch('/rules/:id/toggle', authenticate, AutomationEngineController.toggleRule);
router.post('/rules/:id/execute', authenticate, AutomationEngineController.executeRuleNow);
router.delete('/rules/:id', authenticate, AutomationEngineController.deleteRule);

router.get('/stats', authenticate, AutomationEngineController.getStats);
router.get('/executions', authenticate, AutomationEngineController.getExecutionLogs);
// Alias: customer-portal calls /automation/engine/logs
router.get('/logs', authenticate, AutomationEngineController.getExecutionLogs);
router.get('/hub/summary', authenticate, AutomationEngineController.getAutomationHubSummary);

// Monolith Triggers (Internal Secret Protected)
router.post('/trigger-inbound', internalAuth, AutomationEngineController.handleInboundTrigger);
router.post('/trigger-event', internalAuth, AutomationEngineController.handleEventTrigger);
router.delete('/internal/purge/:workspaceId', internalAuth, AutomationEngineController.purgeWorkspaceData);

export default router;
