const express = require('express');
const router = express.Router();
const appController = require('../../controllers/integration/appController');
const { protect } = require('../../middlewares/auth');

router.get('/', protect, appController.getAvailableApps);
router.post('/connect/:appSlug', protect, appController.connectApiKeyApp);
router.post('/disconnect/:appSlug', protect, appController.disconnectApp);

module.exports = router;
