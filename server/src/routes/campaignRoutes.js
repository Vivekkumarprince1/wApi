const express = require('express');
const auth = require('../middlewares/auth');
const { 
  createCampaign, 
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  enqueueCampaign 
} = require('../controllers/campaignController');

const router = express.Router();
router.use(auth);

router.get('/stats', getCampaignStats);
router.post('/', createCampaign);
router.get('/', listCampaigns);
router.get('/:id', getCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.post('/:id/enqueue', enqueueCampaign);
router.post('/:id/start', enqueueCampaign); // Alias for compatibility

module.exports = router;
