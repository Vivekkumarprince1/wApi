import { Router } from 'express';
import * as AutomationEngineController from '../controllers/AutomationEngineController';
import { authenticate, internalAuth } from '../middleware/auth';

const router = Router();

// Dashboard & Management (User Protected)
router.get('/engine/rules', authenticate, AutomationEngineController.getRules);
router.get('/engine/rules/:id', authenticate, AutomationEngineController.getRuleById);
router.post('/engine/rules', authenticate, AutomationEngineController.createRule);
router.patch('/engine/rules/:id', authenticate, AutomationEngineController.updateRule);
router.put('/engine/rules/:id', authenticate, AutomationEngineController.updateRule);
router.patch('/engine/rules/:id/toggle', authenticate, AutomationEngineController.toggleRule);
router.delete('/engine/rules/:id', authenticate, AutomationEngineController.deleteRule);

router.get('/engine/stats', authenticate, AutomationEngineController.getStats);
router.get('/engine/executions', authenticate, AutomationEngineController.getExecutionLogs);
router.get('/hub/summary', authenticate, AutomationEngineController.getAutomationHubSummary);

// Monolith Triggers (Internal Secret Protected)
router.post('/engine/trigger-inbound', internalAuth, AutomationEngineController.handleInboundTrigger);
router.post('/engine/trigger-event', internalAuth, AutomationEngineController.handleEventTrigger);
router.delete('/internal/purge/:workspaceId', internalAuth, AutomationEngineController.purgeWorkspaceData);

export default router;
