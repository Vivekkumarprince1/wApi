import { Router } from 'express';
import * as InstagramQuickflowController from '../controllers/InstagramQuickflowController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/instagram-quickflows', authenticate, InstagramQuickflowController.getQuickflows);
router.get('/instagram-quickflows/:id', authenticate, InstagramQuickflowController.getQuickflowById);
router.post('/instagram-quickflows', authenticate, InstagramQuickflowController.createQuickflow);
router.patch('/instagram-quickflows/:id/toggle', authenticate, InstagramQuickflowController.toggleQuickflow);
router.patch('/instagram-quickflows/:id', authenticate, InstagramQuickflowController.updateQuickflow);
router.put('/instagram-quickflows/:id', authenticate, InstagramQuickflowController.updateQuickflow);
router.delete('/instagram-quickflows/:id', authenticate, InstagramQuickflowController.deleteQuickflow);

export default router;
