const express = require('express');
const { body } = require('express-validator');
const {
  saveBusinessInfo,
  getOnboardingStatus,
  updateOnboardingStep,
  completeOnboarding,
  connectWhatsApp,
  verifyWhatsAppOTP,
  resendWhatsAppOTP,
  registerWhatsAppNumber,
  getWhatsAppActivationStatus,
  getVerificationStatus,
  checkFeatureAccess,
  getMetaConfig,
  handleEmbeddedSignup,
  completeEmbeddedSignup,
  // New ESB Flow (legacy handlers - BSP-only disables these)
  startEmbeddedSignupFlow,
  handleEsbCallback,
  processEsbCallback,
  processStoredCallback,
  getESBStatus
} = require('../controllers/onboardingController');
const {
  startBspOnboarding,
  handleCallback: handleBspCallback,
  completeOnboarding: completeBspOnboarding,
  getStatus: getBspStatus
} = require('../controllers/bspOnboardingController');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');
const { esbCallbackLimiter, esbProcessLimiter } = require('../middlewares/esbRateLimit');

const router = express.Router();
const BSP_ONLY = process.env.BSP_ONLY !== 'false';

// All onboarding routes require authentication
router.post('/business-info', auth, saveBusinessInfo);
router.get('/status', auth, getOnboardingStatus);
router.post('/status', auth, updateOnboardingStep);
router.post('/complete', auth, completeOnboarding);

// Meta configuration for Embedded Signup
router.get('/meta/config', auth, getMetaConfig);

// WhatsApp Embedded Signup Flow (Legacy - disabled in BSP-only mode)
if (BSP_ONLY) {
  router.post('/whatsapp/embedded-signup', auth, (req, res) => {
    return res.status(410).json({
      success: false,
      message: 'Legacy embedded signup disabled. Use /api/v1/onboarding/bsp instead.',
      code: 'LEGACY_ESB_DISABLED'
    });
  });
  router.post('/whatsapp/complete-signup', auth, (req, res) => {
    return res.status(410).json({
      success: false,
      message: 'Legacy embedded signup disabled. Use /api/v1/onboarding/bsp instead.',
      code: 'LEGACY_ESB_DISABLED'
    });
  });
} else {
  router.post('/whatsapp/embedded-signup', auth, [body('accessToken').notEmpty()], validate, handleEmbeddedSignup);
  router.post('/whatsapp/complete-signup', auth, [body('phoneNumberId').notEmpty(), body('wabaId').notEmpty()], validate, completeEmbeddedSignup);
}

// WhatsApp Manual OTP Flow (DEPRECATED)
// Manual OTP routes removed — ESB (Embedded Signup) flow should be used instead.
// If you need to re-enable for legacy reasons, re-add the corresponding controller handlers.

// Business verification routes
router.get('/verification-status', auth, getVerificationStatus);
router.get('/feature-access', auth, checkFeatureAccess);

// ================================================================
// NEW: EMBEDDED SIGNUP BUSINESS (ESB) FLOW - FULLY AUTOMATED
// ================================================================
// This is the new automated onboarding flow for WhatsApp Business
// All steps require authentication except the callback

// Step 1: Start ESB Flow (GET required by ESB v3, POST kept for compatibility)
router.get('/esb/start', auth, esbProcessLimiter, startBspOnboarding);
router.post('/esb/start', auth, esbProcessLimiter, startBspOnboarding);

// Step 2: Handle OAuth Callback from Meta (No auth needed for redirect)
// Rate limited to prevent brute force attempts
router.get('/esb/callback', esbCallbackLimiter, handleBspCallback);

// Step 2.5: Process stored callback (authenticated - triggered by frontend)
// Rate limited per workspace
router.post('/esb/process-stored-callback', auth, esbProcessLimiter, (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Legacy ESB stored-callback disabled. Use /onboarding/esb/process-callback with code+state.',
    code: 'LEGACY_ESB_DISABLED'
  });
});

// Step 2.5: Complete ESB (required endpoint)
router.post('/esb/complete', auth, esbProcessLimiter, [
  body('code').notEmpty(),
  body('state').notEmpty()
], validate, completeBspOnboarding);

// Step 2.5 (Legacy): Process callback from frontend (after redirect)
// Rate limited per workspace
router.post('/esb/process-callback', auth, esbProcessLimiter, [
  body('code').notEmpty(),
  body('state').notEmpty()
], validate, completeBspOnboarding);

// Get ESB Status
router.get('/esb/status', auth, getBspStatus);

module.exports = router;
