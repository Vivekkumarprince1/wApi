import { Router } from 'express';
import { body } from 'express-validator';
import { widgetController } from '../controllers/widgetController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { requirePermission } from '../middlewares/permissionMiddleware';

const router = Router();

router.use(authenticate);

router.get('/config', requirePermission('workspace.view'), widgetController.getConfig);
router.get('/embed', requirePermission('workspace.view'), widgetController.getEmbedCode);

router.post('/config', 
  requirePermission('workspace.manage'),
  validate([
    body('primaryColor').optional().isHexColor(),
    body('welcomeMessage').optional().isString()
  ]),
  widgetController.updateConfig
);

export default router;
