import { Router } from 'express';
import * as CampaignController from '../controllers/CampaignController';
import { authenticate, internalAuth } from '../middleware/auth';

const router = Router();

router.get('/campaigns', authenticate, CampaignController.listCampaigns);
router.post('/campaigns/create', authenticate, CampaignController.createCampaign);
router.get('/campaigns/:id', authenticate, CampaignController.getCampaignById);
router.put('/campaigns/:id', authenticate, CampaignController.updateCampaign);
router.delete('/campaigns/:id', authenticate, CampaignController.deleteCampaign);
router.post('/campaigns/:id/lifecycle', authenticate, CampaignController.lifecycleAction);
router.get('/campaigns/:id/messages', authenticate, CampaignController.getMessages);
router.get('/campaigns/:id/export', authenticate, CampaignController.exportCsv);
router.post('/campaigns/:id/retarget', authenticate, CampaignController.retargetCampaign);
router.post('/bulk/messages/send', authenticate, CampaignController.createBulkCampaign);
router.get('/bulk/status/:id', authenticate, CampaignController.getBulkCampaignStatus);
router.delete('/internal/purge/:workspaceId', internalAuth, CampaignController.purgeWorkspaceData);

export default router;
