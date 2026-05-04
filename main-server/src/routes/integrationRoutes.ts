import { Router } from 'express';
import { body } from 'express-validator';
import { integrationController } from '../controllers/integrationController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { requirePermission } from '../middlewares/permissionMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('integrations.view'), integrationController.listIntegrations);

// Specific integrations must be registered before generic /:type aliases.
router.post('/petpooja/connect', requirePermission('integrations.manage'), integrationController.connectPetpooja);

router.post('/:type/connect', 
  requirePermission('integrations.manage'),
  validate([
    body('apiKey').optional().isString(),
    body('credentials').optional().isObject()
  ]),
  integrationController.connect
);
router.post('/:type/sync', requirePermission('integrations.manage'), integrationController.syncIntegration);

router.delete('/:id', requirePermission('integrations.manage'), integrationController.disconnect);

// Google Specific
router.get('/google/auth-url', requirePermission('integrations.manage'), integrationController.getGoogleAuthUrl);
router.get('/google/status', requirePermission('integrations.view'), integrationController.getGoogleStatus);
router.get('/google/callback', integrationController.googleCallback);
router.get('/google/config', requirePermission('integrations.view'), integrationController.getGoogleConfig);
router.post('/google/config', requirePermission('integrations.manage'), integrationController.saveGoogleConfig);
router.get('/google/spreadsheets', requirePermission('integrations.view'), integrationController.listGoogleSpreadsheets);
router.get('/google/spreadsheets/:id/sheets', requirePermission('integrations.view'), integrationController.listGoogleSheets);
router.get('/google/spreadsheets/:id/columns', requirePermission('integrations.view'), integrationController.listGoogleColumns);

export default router;
