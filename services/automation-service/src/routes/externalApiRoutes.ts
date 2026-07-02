import { Router } from 'express';
import { externalApiController } from '../controllers/externalApiController';
import { authenticateExternalApiKey } from '../middleware/externalApiAuth';

const router = Router();

const paths = ['/external', '/api/v1/external'];

for (const p of paths) {
  router.post(`${p}/otp/send`, authenticateExternalApiKey, externalApiController.sendOtp);
  router.post(`${p}/otp/verify`, authenticateExternalApiKey, externalApiController.verifyOtp);
  router.post(`${p}/messages/template`, authenticateExternalApiKey, externalApiController.sendTemplate);
}

export default router;
