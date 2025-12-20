const express = require('express');
const auth = require('../middlewares/auth');
const { getDailyStats } = require('../controllers/analyticsController');

const router = express.Router();
router.use(auth);
router.get('/daily', getDailyStats);

module.exports = router;
