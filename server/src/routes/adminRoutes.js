const express = require('express');
const { body } = require('express-validator');
const {
  getWhatsAppSetupRequests,
  updateWhatsAppSetupStatus,
  reinitializeAllWABA,
  getVerificationRequests,
  updateVerificationStatus,
  manuallyActivateWhatsApp,
  // New endpoints
  getAllWorkspaces,
  getWorkspaceDetails,
  suspendWorkspace,
  resumeWorkspace,
  getWABAHealth,
  getAnalytics,
  getTemplatesForApproval,
  updateTemplateStatus,
  getCampaignAnalytics
} = require('../controllers/adminController');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');

const router = express.Router();

// Admin role check middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// All admin routes require authentication
router.use(auth, adminOnly);

// ==================
// WORKSPACE MANAGEMENT
// ==================
router.get('/workspaces', getAllWorkspaces);
router.get('/workspaces/:workspaceId', getWorkspaceDetails);
router.post('/workspaces/:workspaceId/suspend', 
  body('reason').optional().isString(),
  validate,
  suspendWorkspace
);
router.post('/workspaces/:workspaceId/resume', resumeWorkspace);

// ==================
// WABA & VERIFICATION
// ==================
router.get('/whatsapp-setup-requests', getWhatsAppSetupRequests);
router.put('/whatsapp-setup-requests/:workspaceId', updateWhatsAppSetupStatus);
router.get('/verification-requests', getVerificationRequests);
router.put('/verification-requests/:workspaceId', updateVerificationStatus);
router.post('/workspaces/:workspaceId/activate-whatsapp', manuallyActivateWhatsApp);
router.post('/reinitialize-waba', reinitializeAllWABA);

// ==================
// TEAM MANAGEMENT (Week 2)
// ==================
const teamController = require('../controllers/teamController');

router.get('/team/members', teamController.listTeamMembers);
router.post('/team/invite', teamController.inviteTeamMember);
router.put('/team/members/:memberId/role', teamController.updateMemberRole);
router.delete('/team/members/:memberId', teamController.removeTeamMember);
router.get('/team/permissions', teamController.getPermissionsMatrix);

// ==================
// HEALTH & ANALYTICS
// ==================
router.get('/waba-health', getWABAHealth);
router.get('/analytics', getAnalytics);
router.get('/campaigns/analytics', getCampaignAnalytics);

// ==================
// TEMPLATE MANAGEMENT
// ==================
router.get('/templates/approval', getTemplatesForApproval);
router.put('/templates/:templateId/status',
  body('status').isIn(['approved', 'rejected']),
  body('rejectionReason').optional().isString(),
  validate,
  updateTemplateStatus
);

module.exports = router;
