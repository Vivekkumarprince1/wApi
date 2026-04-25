const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/integration/webhookController');

// Webhook endpoint does not need to be protected by user JWT since calls come from third-party services
router.post('/:appSlug/:workspaceId', express.json(), webhookController.handleIncomingWebhook);

module.exports = router;
