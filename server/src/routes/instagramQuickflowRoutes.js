const express = require('express');
const router = express.Router();
const instagramQuickflowController = require('../controllers/instagramQuickflowController');
const authMiddleware = require('../middlewares/auth');

// All routes require authentication
router.use(authMiddleware);

// CRUD operations
router.post('/', instagramQuickflowController.createInstagramQuickflow);
router.get('/', instagramQuickflowController.listInstagramQuickflows);

// Get presets BEFORE /:id routes
router.get('/presets', instagramQuickflowController.getPresetQuickflows);
router.post('/preset/create', instagramQuickflowController.createFromPreset);

// ID-specific routes
router.get('/:id', instagramQuickflowController.getInstagramQuickflow);
router.put('/:id', instagramQuickflowController.updateInstagramQuickflow);
router.delete('/:id', instagramQuickflowController.deleteInstagramQuickflow);

// Toggle enable/disable
router.post('/:id/toggle', instagramQuickflowController.toggleInstagramQuickflow);

// Get statistics
router.get('/:id/stats', instagramQuickflowController.getInstagramQuickflowStats);

module.exports = router;

module.exports = router;
