import { Router } from 'express';
import { body } from 'express-validator';
import { adsController } from '../controllers/adsController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { requirePermission } from '../middlewares/permissionMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('marketing.view'), adsController.listAds);

router.post('/', 
  requirePermission('marketing.manage'),
  validate([
    body('name').notEmpty().isString(),
    body('platform').isIn(['facebook', 'instagram', 'google'])
  ]),
  adsController.createAd
);

router.get('/:id', requirePermission('marketing.view'), adsController.getAd);

router.put('/:id', 
  requirePermission('marketing.manage'),
  validate([
    body('name').optional().isString(),
    body('status').optional().isIn(['active', 'paused', 'archived'])
  ]),
  adsController.updateAd
);

router.delete('/:id', requirePermission('marketing.manage'), adsController.deleteAd);

export default router;
