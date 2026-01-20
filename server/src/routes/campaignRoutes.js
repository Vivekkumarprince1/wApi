/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN ROUTES - Stage 3 Implementation
 * 
 * REST API routes for campaign management following Interakt's architecture.
 * 
 * Routes:
 * - GET    /api/campaigns          - List campaigns
 * - POST   /api/campaigns          - Create campaign
 * - GET    /api/campaigns/stats    - Get campaign statistics
 * - GET    /api/campaigns/:id      - Get single campaign
 * - PUT    /api/campaigns/:id      - Update campaign
 * - DELETE /api/campaigns/:id      - Delete campaign
 * - POST   /api/campaigns/:id/start   - Start campaign execution
 * - POST   /api/campaigns/:id/pause   - Pause running campaign
 * - POST   /api/campaigns/:id/resume  - Resume paused campaign
 * - GET    /api/campaigns/:id/progress - Get campaign progress
 * - GET    /api/campaigns/:id/summary  - Get campaign summary
 * - GET    /api/campaigns/:id/messages - Get campaign messages
 * 
 * STAGE 1 REQUIREMENT: Phone must be CONNECTED before creating/running campaigns.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck } = require('../middlewares/planCheck');
const { requirePhoneActivation, softPhoneActivationCheck } = require('../middlewares/phoneActivation');

// Use the new V2 controller
const { 
  createCampaign, 
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  startCampaign,
  enqueueCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignProgress,
  getCampaignSummary,
  getCampaignMessages
} = require('../controllers/campaignControllerV2');

const router = express.Router();
router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════════
// READ OPERATIONS (Soft check - adds stage1 status to response)
// ═══════════════════════════════════════════════════════════════════════════════

// Campaign listing and stats
router.get('/stats', softPhoneActivationCheck, getCampaignStats);
router.get('/', softPhoneActivationCheck, listCampaigns);

// Single campaign details
router.get('/:id', softPhoneActivationCheck, getCampaign);
router.get('/:id/progress', softPhoneActivationCheck, getCampaignProgress);
router.get('/:id/summary', softPhoneActivationCheck, getCampaignSummary);
router.get('/:id/messages', softPhoneActivationCheck, getCampaignMessages);

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS (Require Stage 1 complete - phone CONNECTED)
// ═══════════════════════════════════════════════════════════════════════════════

// Create campaign - requires plan limit check
router.post('/', requirePhoneActivation, planCheck('campaigns', 1), createCampaign);

// Update campaign (only draft/scheduled campaigns)
router.put('/:id', requirePhoneActivation, updateCampaign);

// Delete campaign
router.delete('/:id', requirePhoneActivation, deleteCampaign);

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN LIFECYCLE (Require Stage 1 complete)
// ═══════════════════════════════════════════════════════════════════════════════

// Start campaign execution
router.post('/:id/start', requirePhoneActivation, startCampaign);
router.post('/:id/enqueue', requirePhoneActivation, enqueueCampaign); // Alias for start

// Pause running campaign
router.post('/:id/pause', requirePhoneActivation, pauseCampaign);

// Resume paused campaign
router.post('/:id/resume', requirePhoneActivation, resumeCampaign);

module.exports = router;
