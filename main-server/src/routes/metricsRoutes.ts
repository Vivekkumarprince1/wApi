import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/messages', authenticate, analyticsController.getMessageMetrics);

export default router;
