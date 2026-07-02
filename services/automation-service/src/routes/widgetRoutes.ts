import { Router } from 'express';
import { widgetController } from '../controllers/widgetController';
import { authenticate } from '../middleware/auth';

const router = Router();

const paths = ['', '/api/v1/widget'];

for (const p of paths) {
  router.get(`${p}/public/:widgetId/config`, widgetController.getPublicConfig);
  router.post(`${p}/public/:widgetId/events`, widgetController.trackPublicEvent);
  router.get(`${p}/config`, authenticate, widgetController.getConfig);
  router.post(`${p}/config`, authenticate, widgetController.updateConfig);
  router.get(`${p}/embed`, authenticate, widgetController.getEmbedCode);
}

export default router;
