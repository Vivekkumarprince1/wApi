import { Router } from 'express';
import { saveBusinessInfo, verifyBusiness } from '../controllers/businessController.js';
import { businessAuthMiddleware } from '../middleware/businessAuth.js';

const router = Router();

router.post('/business/info', businessAuthMiddleware, saveBusinessInfo);
router.post('/info', businessAuthMiddleware, saveBusinessInfo);
router.post('/business/verify', businessAuthMiddleware, verifyBusiness);
router.post('/verify', businessAuthMiddleware, verifyBusiness);

export default router;
