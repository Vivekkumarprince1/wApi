import { Router } from 'express';
import { onboardingController } from '../controllers/onboardingController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/status', authenticate, onboardingController.getStatus);
router.get('/verification-status', authenticate, onboardingController.getStatus);
router.post('/business-info', authenticate, onboardingController.saveBusinessInfo);
router.post('/business-verification', authenticate, onboardingController.verifyBusiness);
router.post('/complete', authenticate, onboardingController.completeOnboarding);

// BSP Routes
router.get('/bsp/status', authenticate, onboardingController.bspStatus);
router.get('/bsp/stage1-status', authenticate, onboardingController.bspStatus);
router.post('/bsp/start', authenticate, onboardingController.bspStart);
router.post('/bsp/sync', authenticate, onboardingController.bspSync);
router.post('/bsp/register-phone', authenticate, onboardingController.bspRegisterPhone);
router.post('/bsp/complete', authenticate, onboardingController.bspComplete);
router.post('/bsp/disconnect', authenticate, onboardingController.bspDisconnect);
router.get('/bsp/runtime-profile', authenticate, onboardingController.bspRuntimeProfile);
router.get('/bsp/callback', onboardingController.bspCallback);

export default router;
