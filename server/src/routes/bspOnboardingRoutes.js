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
const { body } = require('express-validator');
const router = express.Router();
const authenticate = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  startBspOnboarding,
  registerPhoneForAppEndpoint,
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

// Connect business app / register new number
router.post(
  '/register-phone',
  authenticate,
  [
    body('connectionType').optional().isIn(['business_app', 'new_number']),
    body('region').optional().isString().trim().matches(/^[A-Za-z]{2,10}$/),
    body('appId').optional().isString().trim().notEmpty(),
    body('businessName').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('contactEmail').optional().isEmail()
  ],
  validate,
  registerPhoneForAppEndpoint
);

// Complete onboarding after callback
router.post('/complete', authenticate, completeOnboarding);

// Trigger manual WABA sync
router.post('/sync', authenticate, triggerSync);

// Disconnect WhatsApp
router.post('/disconnect', authenticate, disconnect);

module.exports = router;
