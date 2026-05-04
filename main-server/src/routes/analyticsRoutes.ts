import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/dashboard/overview', authenticate, analyticsController.getDashboardOverview);
router.get('/chat/advanced', authenticate, analyticsController.getAdvancedChatAnalytics);
router.get('/messages/trends', authenticate, analyticsController.getMessageTrends);
router.get('/templates/performance', authenticate, analyticsController.getTemplatePerformance);
router.get('/agents/performance', authenticate, analyticsController.getAgentPerformance);

export default router;
