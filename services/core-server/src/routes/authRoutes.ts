import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { authRateLimit, apiRateLimit } from '../middlewares/rateLimitMiddleware';

const router = Router();

router.post('/login', authRateLimit, authController.login);
router.post('/logout', authController.logout);
router.get('/logout', authController.logout);
router.post('/signup', authRateLimit, authController.signup);
router.post('/verify-signup-otp', authRateLimit, authController.verifySignupOtp);
router.post('/send-otp', authRateLimit, authController.sendOtp);
router.post('/verify-otp', authRateLimit, authController.verifyOtp);
router.post('/otp/send', authRateLimit, authController.sendOtp);
router.post('/otp/verify', authRateLimit, authController.verifyOtp);
router.post('/request-password-reset', authRateLimit, authController.requestPasswordReset);
router.post('/reset-password', authRateLimit, authController.resetPassword);
router.post('/password/reset-request', authRateLimit, authController.requestPasswordReset);
router.post('/password/reset', authRateLimit, authController.resetPassword);
router.get('/invitation/:token', authController.getInvitation);
router.post('/accept-invite', authController.acceptInvitation);
router.get('/google/url', authController.googleUrl);
router.get('/google/auth-url', authController.googleUrl);
router.post('/google/login', authController.googleCallback);
router.get('/google/callback', authController.googleCallback);
router.post('/google/callback', authController.googleCallback);
router.post('/facebook', authController.facebookLogin);
router.post('/facebook/login', authController.facebookLogin);

// Monolith OTP aliases kept for frontend/root-route parity.
router.post('/signup/send-otp', authRateLimit, authController.signup);
router.post('/signup/verify-otp', authRateLimit, authController.verifySignupOtp);
router.post('/login/send-otp', authRateLimit, authController.sendOtp);
router.post('/login/verify-otp', authRateLimit, authController.verifyOtp);
router.post('/resend-signup-otp', authRateLimit, authController.signup);
router.get('/me', apiRateLimit, authenticate, authController.me);
router.patch('/me', apiRateLimit, authenticate, authController.updateMe);
router.get('/session', apiRateLimit, authenticate, authController.me);
router.get('/workspaces', apiRateLimit, authenticate, authController.listWorkspaces);
router.post('/switch-workspace', apiRateLimit, authenticate, authController.switchWorkspace);
router.get('/invitations/pending', apiRateLimit, authenticate, authController.listPendingInvitations);

// Account Management
router.get('/account', authenticate, authController.getAccount);
router.delete('/account', authenticate, authController.deleteAccount);
router.post('/account/delete-request', authRateLimit, authenticate, authController.requestAccountDeletion);
router.post('/account/delete-confirm', authRateLimit, authenticate, authController.confirmAccountDeletion);

// Notifications
router.get('/notifications', apiRateLimit, authenticate, authController.listNotifications);
router.patch('/notifications/:id/read', apiRateLimit, authenticate, authController.markNotificationRead);
router.patch('/notifications/read-all', apiRateLimit, authenticate, authController.markAllNotificationsRead);

// Mobile OTP Aliases
router.post('/mobile/send-otp', authRateLimit, authController.sendOtp);
router.post('/mobile/verify-otp', authRateLimit, authController.verifyOtp);

export default router;
