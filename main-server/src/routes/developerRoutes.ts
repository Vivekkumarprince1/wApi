import { Router } from 'express';
import { workspaceController } from '../controllers/workspaceController';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/settings', workspaceController.getDeveloperSettings);
router.patch('/settings', authorizeRole(['owner', 'admin']), workspaceController.updateDeveloperSettings);
router.get('/keys', workspaceController.getApiKeys);

export default router;
