/**
 * BSP Admin Routes
 * 
 * Administrative routes for managing the BSP multi-tenant platform.
 * All routes require admin authentication.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const bspAdminController = require('../controllers/bspAdminController');

/**
 * Middleware to ensure admin access
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  
  // Check if user is admin (assuming 'admin' or 'owner' role)
  const userRole = req.user.role || 'viewer';
  if (userRole !== 'admin' && userRole !== 'owner') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  
  next();
};

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * ═══════════════════════════════════════════════════════════════════
 * PHONE NUMBER MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════
 */

// Assign a phone number to a workspace
router.post('/assign-phone', bspAdminController.assignPhoneNumber);

// Unassign a phone number from a workspace
router.post('/unassign-phone', bspAdminController.unassignPhoneNumber);

/**
 * ═══════════════════════════════════════════════════════════════════
 * TENANT MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════
 */

// List all BSP tenants
router.get('/tenants', bspAdminController.listBspTenants);

// Get tenant details
router.get('/tenants/:workspaceId', bspAdminController.getTenantDetails);

// Update tenant rate limits
router.patch('/tenants/:workspaceId/limits', bspAdminController.updateTenantLimits);

// Sync phone status from Meta
router.post('/sync-status/:workspaceId', bspAdminController.syncPhoneStatus);

// BSP instant revoke / resume
router.post('/tenants/:workspaceId/suspend', bspAdminController.suspendTenant);
router.post('/tenants/:workspaceId/resume', bspAdminController.resumeTenant);

/**
 * ═══════════════════════════════════════════════════════════════════
 * BILLING RECONCILIATION
 * ═══════════════════════════════════════════════════════════════════
 */

router.post('/billing/reconcile', bspAdminController.reconcileBilling);
router.get('/billing/ledger/:workspaceId/:period', bspAdminController.getUsageLedger);

/**
 * ═══════════════════════════════════════════════════════════════════
 * PLATFORM OVERVIEW
 * ═══════════════════════════════════════════════════════════════════
 */

// Get BSP platform overview
router.get('/overview', bspAdminController.getBspOverview);

module.exports = router;
