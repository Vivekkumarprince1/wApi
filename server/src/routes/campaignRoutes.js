const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck } = require('../middlewares/planCheck');
const { 
  createCampaign, 
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  enqueueCampaign,
  pauseCampaign,
  resumeCampaign
} = require('../controllers/campaignController');

const router = express.Router();
router.use(auth);

router.get('/stats', getCampaignStats);
router.post('/', planCheck('campaigns', 1), createCampaign);
router.get('/', listCampaigns);
router.get('/:id', getCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// ✅ Campaign lifecycle endpoints
router.post('/:id/start', enqueueCampaign);
router.post('/:id/enqueue', enqueueCampaign); // Alias for compatibility
router.post('/:id/pause', pauseCampaign);
router.post('/:id/resume', resumeCampaign);

module.exports = router;
