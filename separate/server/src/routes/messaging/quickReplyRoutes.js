const express = require('express');
const router = express.Router();
const quickReplyController = require('../../controllers/messaging/quickReplyController');
const auth = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/infrastructure/rbac');

// All routes require authentication
router.use(auth);

/**
 * GET /api/v1/quick-replies
 * Get all active quick replies
 */
router.get('/', quickReplyController.getQuickReplies);

/**
 * POST /api/v1/quick-replies
 * Create a new quick reply (Admin/Manager)
 */
router.post('/', 
  requirePermission('manageSettings'), 
  quickReplyController.createQuickReply
);

/**
 * PUT /api/v1/quick-replies/:id
 * Update a quick reply (Admin/Manager)
 */
router.put('/:id', 
  requirePermission('manageSettings'), 
  quickReplyController.updateQuickReply
);

/**
 * DELETE /api/v1/quick-replies/:id
 * Delete a quick reply (Admin/Manager)
 */
router.delete('/:id', 
  requirePermission('manageSettings'), 
  quickReplyController.deleteQuickReply
);

module.exports = router;
