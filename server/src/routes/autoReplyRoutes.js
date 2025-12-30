const express = require('express');
const router = express.Router();
const autoReplyController = require('../controllers/autoReplyController');
const authMiddleware = require('../middlewares/auth');

// All routes require authentication
router.use(authMiddleware);

// CRUD operations
router.post('/', autoReplyController.createAutoReply);
router.get('/', autoReplyController.listAutoReplies);
router.get('/:id', autoReplyController.getAutoReply);
router.put('/:id', autoReplyController.updateAutoReply);
router.delete('/:id', autoReplyController.deleteAutoReply);

// Toggle enable/disable
router.post('/:id/toggle', autoReplyController.toggleAutoReply);

module.exports = router;
