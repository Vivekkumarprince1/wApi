const express = require('express');
const auth = require('../middlewares/auth');
const { getUsageAndLimits, resetUsageCounters } = require('../controllers/usageController');

const router = express.Router();

router.use(auth);

router.get('/', getUsageAndLimits);
router.post('/reset', resetUsageCounters);

module.exports = router;
