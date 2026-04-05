const express = require('express');
const router = express.Router();
const controller = require('../../controllers/messaging/contactSettingsController');
const auth = require('../../middlewares/auth');

router.use(auth);

// Get and update contact settings for the workspace
router.get('/', controller.getSettings.bind(controller));
router.put('/', controller.updateSettings.bind(controller));

// Fetch and log events for a specific contact
router.get('/:contactId/events', controller.getEvents.bind(controller));
router.post('/:contactId/events', controller.logEvent.bind(controller));

module.exports = router;