const express = require('express');
const auth = require('../../middlewares/auth');
const { getDailyStats } = require('../../controllers/analytics/analyticsController');

const { requireFeature } = require('../../middlewares/infrastructure/featureGate');

const router = express.Router();
router.use(auth);
router.get('/daily', requireFeature('ANALYTICS'), getDailyStats);

module.exports = router;
