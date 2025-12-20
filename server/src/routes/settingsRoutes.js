const express = require('express');
const auth = require('../middlewares/auth');
const { 
  getWhatsAppNumberStatus, 
  getWABASettings, 
  updateWABASettings, 
  createWABASettings, 
  initializeWABAFromEnv,
  testWABAConnection,
  debugMetaCredentials
} = require('../controllers/settingsController');

const router = express.Router();

router.use(auth);

router.get('/whatsapp-number', getWhatsAppNumberStatus);
router.get('/waba', getWABASettings);
router.put('/waba', updateWABASettings);
router.post('/waba', createWABASettings);
router.post('/waba/init-from-env', initializeWABAFromEnv);
router.post('/waba/test', testWABAConnection);
router.get('/waba/debug', debugMetaCredentials);

module.exports = router;