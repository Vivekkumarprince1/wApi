const express = require('express');
const { body } = require('express-validator');
const {
  signup,
  login,
  me,
  logout,
  updateProfile,
  sendSignupOTP,
  verifySignupOTP,
  sendLoginOTP,
  verifyLoginOTP,
  googleOAuthLogin,
  getGoogleDebug,
  getGoogleAuthUrl,
  googleOAuthCallback,
  facebookOAuthLogin,
  sendEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword
} = require('../controllers/authController');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');

const router = express.Router();

// OTP-based authentication
router.post('/send-signup-otp', [body('email').isEmail()], validate, sendSignupOTP);
router.post('/verify-signup-otp', [
  body('email').isEmail(),
  body('otp').notEmpty(),
  body('name').notEmpty(),
  body('password').isLength({ min: 6 }),
  body('businessName').optional().isString(),
  body('industry').optional().isString(),
  body('companySize').optional().isString(),
  body('annualRevenue').optional().isString(),
  body('website').optional().isString(),
  body('description').optional().isString(),
  body('companyLocation').optional().isString(),
  body('certificationType').optional().isIn(['gst', 'msme', 'pan', 'other']),
  body('certificationNumber').optional().isString(),
  body('phone').optional().isString()
], validate, verifySignupOTP);
router.post('/send-login-otp', [body('email').isEmail()], validate, sendLoginOTP);
router.post('/verify-login-otp', [body('email').isEmail(), body('otp').notEmpty()], validate, verifyLoginOTP);

// Traditional email/password authentication
router.post('/signup', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty(),
  body('businessName').optional().isString(),
  body('industry').optional().isString(),
  body('companySize').optional().isString(),
  body('annualRevenue').optional().isString(),
  body('website').optional().isString(),
  body('description').optional().isString(),
  body('companyLocation').optional().isString(),
  body('certificationType').optional().isIn(['gst', 'msme', 'pan', 'other']),
  body('certificationNumber').optional().isString(),
  body('phone').optional().isString()
], validate, signup);
router.post('/login', [body('email').isEmail(), body('password').notEmpty()], validate, login);

// Protected routes
router.get('/me', auth, me);
router.post('/google/login', [body('token').notEmpty()], validate, googleOAuthLogin);
router.get('/google/debug', getGoogleDebug);
router.get('/google/auth-url', getGoogleAuthUrl);
router.get('/google/callback', googleOAuthCallback);
router.post('/facebook/login', [body('accessToken').notEmpty()], validate, facebookOAuthLogin);
router.post('/logout', auth, logout);
router.put('/update-profile', auth, updateProfile);

// Email verification routes
router.post('/send-email-verification', auth, sendEmailVerification);
router.post('/verify-email', auth, [body('otp').notEmpty()], validate, verifyEmail);

// Password reset (token-based, expiring)
router.post('/request-password-reset', [body('email').isEmail()], validate, requestPasswordReset);
router.post('/reset-password', [body('token').notEmpty(), body('newPassword').isLength({ min: 6 })], validate, resetPassword);

module.exports = router;
