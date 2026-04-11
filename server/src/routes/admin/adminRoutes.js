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
  getCampaignAnalytics,
  // New upgraded endpoints
  getAllUsers,
  updateUserRole,
  updateWorkspacePlan,
  deleteUser,
  deleteWorkspace
} = require('../../controllers/admin/adminController');
const validate = require('../../middlewares/infrastructure/validate');
const auth = require('../../middlewares/auth');

const router = express.Router();

// Admin role check middleware with debug logging
const adminOnly = (req, res, next) => {
  console.log(`[Admin Guard] Path: ${req.originalUrl}, User: ${req.user?.email || 'None'}, Role: ${req.user?.role || 'None'}`);
  
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && !req.user.isSuperAdmin) {
    console.warn(`[Admin Guard] ⚠️ Access Denied for ${req.user.email} (Role: ${req.user.role})`);
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// All admin routes require authentication
router.use((req, res, next) => {
  console.log(`[Admin Access] Request to: ${req.originalUrl}, Headers: ${req.headers.authorization ? 'Token present' : 'MISSING TOKEN'}`);
  next();
}, auth, adminOnly);

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
router.patch('/workspaces/:workspaceId/plan',
  body('planId').isMongoId().withMessage('Invalid plan ID'),
  validate,
  updateWorkspacePlan
);
router.delete('/workspaces/:workspaceId', deleteWorkspace);

// ==================
// USER MANAGEMENT
// ==================
router.get('/users', getAllUsers);
router.patch('/users/:userId/role',
  body('role').optional().isIn(['owner', 'admin', 'agent']),
  body('status').optional().isIn(['active', 'disabled']),
  validate,
  updateUserRole
);
router.delete('/users/:userId', deleteUser);

// ==================
// WABA & VERIFICATION
// ==================
router.get('/whatsapp-setup-requests', getWhatsAppSetupRequests);
router.put('/whatsapp-setup-requests/:workspaceId', updateWhatsAppSetupStatus);
router.get('/verification-requests', getVerificationRequests);
router.put('/verification-requests/:workspaceId', updateVerificationStatus);
router.post('/workspaces/:workspaceId/activate-whatsapp', manuallyActivateWhatsApp);
router.post('/reinitialize-waba', reinitializeAllWABA);

// TEAM MANAGEMENT is now handled by /api/v1/team/ routes

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
