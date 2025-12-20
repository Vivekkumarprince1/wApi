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
  // New ESB Flow
  startEmbeddedSignupFlow,
  handleEsbCallback,
  processEsbCallback,
  verifyBusinessAndWABA,
  registerPhoneAndSendOTP,
  verifyPhoneOTP,
  createSystemUserAndToken,
  activateWABA,
  getESBStatus
} = require('../controllers/onboardingController');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');

const router = express.Router();

// All onboarding routes require authentication
router.post('/business-info', auth, saveBusinessInfo);
router.get('/status', auth, getOnboardingStatus);
router.post('/status', auth, updateOnboardingStep);
router.post('/complete', auth, completeOnboarding);

// Meta configuration for Embedded Signup
router.get('/meta/config', auth, getMetaConfig);

// WhatsApp Embedded Signup Flow (Facebook Login based)
router.post('/whatsapp/embedded-signup', auth, [body('accessToken').notEmpty()], validate, handleEmbeddedSignup);
router.post('/whatsapp/complete-signup', auth, [body('phoneNumberId').notEmpty(), body('wabaId').notEmpty()], validate, completeEmbeddedSignup);

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

// Step 1: Start ESB Flow
router.post('/esb/start', auth, startEmbeddedSignupFlow);

// Step 2: Handle OAuth Callback from Meta (No auth needed for redirect)
router.get('/esb/callback', handleEsbCallback);

// Step 2.5: Process callback from frontend (after redirect)
router.post('/esb/process-callback', auth, [
  body('code').notEmpty(),
  body('state').notEmpty()
], validate, processEsbCallback);

// Step 3: Verify Business Account
router.post('/esb/verify-business', auth, [
  body('businessAccountId').notEmpty(),
  body('businessData').notEmpty()
], validate, verifyBusinessAndWABA);

// Step 4: Register Phone Number and Send OTP
router.post('/esb/register-phone', auth, [
  body('phoneNumber').notEmpty()
], validate, registerPhoneAndSendOTP);

// Step 5: Verify Phone OTP
router.post('/esb/verify-otp', auth, [
  body('otpCode').notEmpty().isLength({ min: 6, max: 6 })
], validate, verifyPhoneOTP);

// Step 6: Create System User
router.post('/esb/create-system-user', auth, createSystemUserAndToken);

// Step 7: Activate WABA
router.post('/esb/activate-waba', auth, activateWABA);

// Get ESB Status
router.get('/esb/status', auth, getESBStatus);

module.exports = router;
