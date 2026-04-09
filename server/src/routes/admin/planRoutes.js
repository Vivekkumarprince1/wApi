const express = require('express');
const planController = require('../../controllers/admin/planController');
const auth = require('../../middlewares/auth');
const rbac = require('../../middlewares/infrastructure/rbac');

const router = express.Router();

// All plan management routes require admin role
// Auth is required for all routes
router.use(auth);

/**
 * @route   GET /api/v1/admin/plans
 * @desc    Get all plans (Used by both admin and user dashboard)
 */
router.get('/', planController.getAllPlans);

// Admin-only management routes
router.use(rbac.requireRole('admin'));


/**
 * @route   POST /api/v1/admin/plans
 * @desc    Create a new plan
 */
router.post('/', planController.createPlan);

/**
 * @route   PATCH /api/v1/admin/plans/:id
 * @desc    Update a plan
 */
router.patch('/:id', planController.updatePlan);

/**
 * @route   DELETE /api/v1/admin/plans/:id
 * @desc    Deactivate a plan
 */
router.delete('/:id', planController.deletePlan);

module.exports = router;
