import { Router } from 'express';
import { conversationController } from '../controllers/conversationController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authenticate, conversationController.getInbox);
router.get('/bootstrap', authenticate, conversationController.getBootstrapData);
router.post('/:conversationId/read', authenticate, conversationController.markAsRead);

export default router;
