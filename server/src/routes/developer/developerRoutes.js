const express = require('express');
const developerController = require('../../controllers/developer/developerController');
const auth = require('../../middlewares/auth');

const router = express.Router();

/**
 * Internal Developer Routes (Dashboard)
 * Authenticated via USER session/token
 */

// Get current developer settings and API key
router.get('/settings', auth, developerController.getSettings);
router.patch('/settings', auth, developerController.updateSettings);

// Generate a new API key
router.post('/keys/generate', auth, developerController.generateApiKey);

// Revoke current API key
router.post('/keys/revoke', auth, developerController.revokeApiKey);

module.exports = router;
