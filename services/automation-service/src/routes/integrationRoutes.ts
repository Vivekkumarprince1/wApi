import { Router } from 'express';
import { integrationController } from '../controllers/integrationController';
import { authenticate } from '../middleware/auth';

const router = Router();

const paths = ['', '/api/v1/integrations'];

for (const p of paths) {
  router.get(`${p}/`, authenticate, integrationController.listIntegrations);
  router.post(`${p}/connect`, authenticate, integrationController.connect);
  router.post(`${p}/connect/:type`, authenticate, integrationController.connect);
  router.delete(`${p}/:id`, authenticate, integrationController.disconnect);
  router.post(`${p}/:type/sync`, authenticate, integrationController.syncIntegration);

  // Google Sheets specifics
  router.get(`${p}/google/spreadsheets`, authenticate, integrationController.listGoogleSpreadsheets);
  router.get(`${p}/google/status`, authenticate, integrationController.getGoogleStatus);
  router.get(`${p}/google/config`, authenticate, integrationController.getGoogleConfig);
  router.post(`${p}/google/config`, authenticate, integrationController.saveGoogleConfig);
  router.get(`${p}/google/sheets`, authenticate, integrationController.listGoogleSheets);
  router.get(`${p}/google/columns/:id`, authenticate, integrationController.listGoogleColumns);
  router.get(`${p}/google/auth-url`, authenticate, integrationController.getGoogleAuthUrl);
  router.get(`${p}/google/callback`, authenticate, integrationController.googleCallback);

  // Petpooja POS specifics
  router.post(`${p}/petpooja/connect`, authenticate, integrationController.connectPetpooja);
}

export default router;
