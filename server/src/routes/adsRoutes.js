const express = require('express');
const router = express.Router();
const adsController = require('../controllers/adsController');
const auth = require('../middlewares/auth');

// ✅ All routes require authentication
router.use(auth);

/**
 * ✅ GET /ads/check-eligibility
 * Check if workspace can create ads (prerequisites & plan)
 */
router.get('/check-eligibility', adsController.checkAdsEligibility);

/**
 * ✅ POST /ads
 * Create new ad campaign
 * Body: { name, objective, budget, currency, scheduleStart, scheduleEnd, 
 *         targeting, template, welcomeMessage, ctaText }
 */
router.post('/', adsController.createAd);

/**
 * ✅ GET /ads
 * List all ads for workspace
 * Query: { status?, page?, limit? }
 */
router.get('/', adsController.listAds);

/**
 * ✅ GET /ads/:id
 * Get single ad details
 */
router.get('/:id', adsController.getAd);

/**
 * ✅ PUT /ads/:id
 * Update ad (only draft status)
 * Body: { name?, budget?, targeting?, welcomeMessage?, ctaText? }
 */
router.put('/:id', adsController.updateAd);

/**
 * ✅ POST /ads/:id/pause
 * Pause ad (manual or auto)
 * Body: { reason? }
 */
router.post('/:id/pause', adsController.pauseAd);

/**
 * ✅ POST /ads/:id/resume
 * Resume paused ad
 */
router.post('/:id/resume', adsController.resumeAd);

/**
 * ✅ DELETE /ads/:id
 * Delete ad
 */
router.delete('/:id', adsController.deleteAd);

/**
 * ✅ GET /ads/:id/analytics
 * Get ad performance analytics
 */
router.get('/:id/analytics', adsController.getAdAnalytics);

module.exports = router;
