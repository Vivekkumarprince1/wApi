import { Router } from 'express';
import { businessController } from '../controllers/businessController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/info', authenticate, businessController.saveBusinessInfo);
router.post('/verify', authenticate, businessController.verifyBusiness);

export default router;
