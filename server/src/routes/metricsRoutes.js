const express = require('express');
const auth = require('../middlewares/auth');
const { getTemplateMetrics, getMessageMetrics } = require('../controllers/metricsController');

const router = express.Router();

router.use(auth);

router.get('/templates', getTemplateMetrics);
router.get('/messages', getMessageMetrics);

module.exports = router;
