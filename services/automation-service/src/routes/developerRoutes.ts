import { Router } from 'express';
import { developerController } from '../controllers/developerController';
import { authenticate } from '../middleware/auth';

const router = Router();

const paths = ['', '/api/v1/developer'];

for (const p of paths) {
  router.get(`${p}/settings`, authenticate, developerController.getDeveloperSettings);
  router.patch(`${p}/settings`, authenticate, developerController.updateDeveloperSettings);
  router.get(`${p}/webhooks`, authenticate, developerController.listOutboundWebhooks);
  router.post(`${p}/webhooks`, authenticate, developerController.createOutboundWebhook);
  router.delete(`${p}/webhooks`, authenticate, developerController.clearOutboundWebhooks);
  router.patch(`${p}/webhooks/:id`, authenticate, developerController.updateOutboundWebhook);
  router.delete(`${p}/webhooks/:id`, authenticate, developerController.deleteOutboundWebhook);
  router.get(`${p}/keys`, authenticate, developerController.getApiKeys);
  router.post(`${p}/keys`, authenticate, developerController.createApiKey);
  router.get(`${p}/keys/:id/secret`, authenticate, developerController.revealApiKeySecret);
  router.delete(`${p}/keys/:id`, authenticate, developerController.revokeApiKey);
}

export default router;
