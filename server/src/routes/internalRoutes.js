const express = require('express');
const auth = require('../middlewares/auth');
const { getHealthSnapshot } = require('../services/bspHealthService');

const router = express.Router();

// Internal BSP health endpoint (protected, no tokens exposed)
router.get('/bsp/health', auth, async (req, res) => {
  try {
    const health = await getHealthSnapshot();
    return res.json({ success: true, health });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch BSP health' });
  }
});

module.exports = router;
