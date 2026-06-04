import { Router } from 'express';
import { 
  getTickets, 
  createTicket, 
  updateTicket, 
  getMacros, 
  createMacro, 
  updateMacro, 
  deleteMacro, 
  getDashboardOverview, 
  getAdvancedChatAnalytics, 
  getMessageTrends, 
  getTemplatePerformance,
  getAgentPerformance,
  getGeneralMetrics,
  getMessageMetrics
} from '../controllers/supportController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Tickets
router.get('/api/v1/support/tickets', authenticate, getTickets);
router.get('/support/tickets', authenticate, getTickets);
router.get('/tickets', authenticate, getTickets);

router.post('/api/v1/support/tickets', authenticate, createTicket);
router.post('/support/tickets', authenticate, createTicket);
router.post('/tickets', authenticate, createTicket);

router.put('/api/v1/support/tickets/:id', authenticate, updateTicket);
router.put('/support/tickets/:id', authenticate, updateTicket);
router.put('/tickets/:id', authenticate, updateTicket);

// Macros
router.get('/api/v1/support/macros', authenticate, getMacros);
router.get('/support/macros', authenticate, getMacros);
router.get('/macros', authenticate, getMacros);

router.post('/api/v1/support/macros', authenticate, createMacro);
router.post('/support/macros', authenticate, createMacro);
router.post('/macros', authenticate, createMacro);

router.patch('/api/v1/support/macros/:id', authenticate, updateMacro);
router.put('/api/v1/support/macros/:id', authenticate, updateMacro);
router.patch('/support/macros/:id', authenticate, updateMacro);
router.put('/support/macros/:id', authenticate, updateMacro);
router.patch('/macros/:id', authenticate, updateMacro);
router.put('/macros/:id', authenticate, updateMacro);

router.delete('/api/v1/support/macros/:id', authenticate, deleteMacro);
router.delete('/support/macros/:id', authenticate, deleteMacro);
router.delete('/macros/:id', authenticate, deleteMacro);

// Analytics & Dashboard Overview
router.get('/api/v1/analytics/dashboard/overview', authenticate, getDashboardOverview);
router.get('/analytics/dashboard/overview', authenticate, getDashboardOverview);

router.get('/api/v1/analytics/chat/advanced', authenticate, getAdvancedChatAnalytics);
router.get('/analytics/chat/advanced', authenticate, getAdvancedChatAnalytics);

router.get('/api/v1/analytics/messages/trends', authenticate, getMessageTrends);
router.get('/analytics/messages/trends', authenticate, getMessageTrends);

router.get('/api/v1/analytics/templates/performance', authenticate, getTemplatePerformance);
router.get('/analytics/templates/performance', authenticate, getTemplatePerformance);

router.get('/api/v1/analytics/agents/performance', authenticate, getAgentPerformance);
router.get('/analytics/agents/performance', authenticate, getAgentPerformance);

// General metrics
// /messages must be registered before the bare /metrics handlers (exact-path, but kept first for clarity)
router.get('/api/v1/metrics/messages', authenticate, getMessageMetrics);
router.get('/metrics/messages', authenticate, getMessageMetrics);
router.get('/api/v1/metrics', authenticate, getGeneralMetrics);
router.get('/metrics', authenticate, getGeneralMetrics);
router.get('/', authenticate, getGeneralMetrics); // under mount `/api/v1/metrics`

export default router;
