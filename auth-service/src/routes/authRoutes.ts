import { Router } from 'express';
import {
  signup,
  verifySignupOtp,
  login,
  logout,
  sendOtp,
  verifyOtpEndpoint,
  googleUrl,
  googleCallback,
  facebookLogin,
  session,
  me,
  updateMe,
  requestPasswordReset,
  resetPassword,
  getAccount,
  deleteAccount,
  requestDeleteAccount,
  confirmDeleteAccount,
  listWorkspaces,
  switchWorkspace,
  getInvitation,
  acceptInvitation,
  listPendingInvitations,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  verifySession,
  getUserNotifications,
  updateUserNotifications
} from '../controllers/authController.js';
import { businessAuthMiddleware } from '../middleware/businessAuth.js';

const router = Router();

/* --------------------------------- Signup --------------------------------- */
router.post('/signup', signup);
router.post('/verify-signup-otp', verifySignupOtp);

/* ---------------------------------- Login --------------------------------- */
router.post('/login', login);
router.post('/logout', logout);
router.post('/login/send-otp', sendOtp);
router.post('/login/verify-otp', verifyOtpEndpoint);

/* --------------------------------- Generic OTP ---------------------------- */
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtpEndpoint);
// Frontend (lib/api/auth.ts) calls /auth/otp/send and /auth/otp/verify
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtpEndpoint);

/* ------------------------------ Password reset ---------------------------- */
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

/* --------------------------------- Google --------------------------------- */
router.get('/google/url', googleUrl);
router.post('/google/login', googleCallback);
// Frontend google callback page posts /auth/google/callback
router.post('/google/callback', googleCallback);

/* -------------------------------- Facebook -------------------------------- */
router.post('/facebook/login', facebookLogin);
// Frontend (lib/api/auth.ts) facebookLogin() posts /auth/facebook
router.post('/facebook', facebookLogin);

/* --------------------------------- Session -------------------------------- */
router.get('/session', session);
router.get('/me', me);
router.patch('/me', updateMe);

/* -------------------------------- Workspaces ------------------------------ */
router.get('/workspaces', listWorkspaces);
router.post('/switch-workspace', switchWorkspace);

/* ------------------------------- Invitations ------------------------------ */
router.get('/invitation/:token', getInvitation);
router.post('/accept-invite', acceptInvitation);
router.get('/invitations/pending', listPendingInvitations);

/* ------------------------------ Notifications ----------------------------- */
router.get('/notifications', listNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/read-all', markAllNotificationsRead);

/* --------------------------------- Account -------------------------------- */
router.get('/account', businessAuthMiddleware, getAccount);
router.delete('/account', businessAuthMiddleware, deleteAccount);
router.post('/account/delete-request', businessAuthMiddleware, requestDeleteAccount);
router.post('/account/delete-confirm', businessAuthMiddleware, confirmDeleteAccount);

/* ------------------------ Internal (microservice-only) -------------------- */
router.post('/internal/v1/auth/verify-session', verifySession);

/* ------------------------ User Settings ----------------------------------- */
router.get('/user/settings/notifications', businessAuthMiddleware, getUserNotifications);
router.patch('/user/settings/notifications', businessAuthMiddleware, updateUserNotifications);

export default router;
