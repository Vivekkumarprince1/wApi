/**
 * =============================================================================
 * BSP ONBOARDING ROUTES - INTERAKT PARENTAL MODEL (HARDENED)
 * =============================================================================
 * 
 * All routes for BSP WhatsApp onboarding:
 * 
 * POST   /api/v1/onboarding/bsp/start           - Start ESB flow
 * GET    /api/v1/onboarding/bsp/callback        - OAuth callback (no auth)
 * POST   /api/v1/onboarding/bsp/complete        - Complete onboarding
 * GET    /api/v1/onboarding/bsp/status          - Get connection status
 * GET    /api/v1/onboarding/bsp/stage1-status   - Get Stage 1 completion status
 * POST   /api/v1/onboarding/bsp/sync            - Trigger manual sync
 * POST   /api/v1/onboarding/bsp/disconnect      - Disconnect WhatsApp
 * GET    /api/v1/onboarding/bsp/config          - Get BSP config for frontend
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth');
const {
  startBspOnboarding,
  handleCallback,
  completeOnboarding,
  getStatus,
  disconnect,
  getConfig,
  getStage1StatusEndpoint,
  triggerSync
} = require('../controllers/bspOnboardingController');

// =============================================================================
// PUBLIC ROUTES (No auth required)
// =============================================================================

// OAuth callback from Meta - must be public
router.get('/callback', handleCallback);

// =============================================================================
// PROTECTED ROUTES (Auth required)
// =============================================================================

// Get BSP config (check if configured)
router.get('/config', authenticate, getConfig);

// Get onboarding status
router.get('/status', authenticate, getStatus);

// Get Stage 1 completion status (for feature gating)
router.get('/stage1-status', authenticate, getStage1StatusEndpoint);

// Start BSP onboarding flow
router.post('/start', authenticate, startBspOnboarding);

// Complete onboarding after callback
router.post('/complete', authenticate, completeOnboarding);

// Trigger manual WABA sync
router.post('/sync', authenticate, triggerSync);

// Disconnect WhatsApp
router.post('/disconnect', authenticate, disconnect);

module.exports = router;
