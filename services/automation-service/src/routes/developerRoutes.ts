import { Router } from 'express';
import { developerController } from '../controllers/developerController';
import { authenticate } from '../middleware/auth';

const router = Router();

const paths = ['', '/api/v1/developer'];

for (const p of paths) {
  router.get(`${p}/settings`, authenticate, developerController.getDeveloperSettings);
  router.patch(`${p}/settings`, authenticate, developerController.updateDeveloperSettings);
  router.get(`${p}/keys`, authenticate, developerController.getApiKeys);
  router.post(`${p}/keys`, authenticate, developerController.createApiKey);
  router.delete(`${p}/keys/:id`, authenticate, developerController.revokeApiKey);
}

export default router;
